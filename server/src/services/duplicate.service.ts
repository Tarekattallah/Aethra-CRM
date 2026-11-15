import { startOfBusinessDay } from '../utils/business-time.js';
import mongoose from 'mongoose';
import { Lead, ILead, LeadStatus } from '../models/Lead.js';
import { LeadActivity, ActivityType } from '../models/LeadActivity.js';
import { User, IUser } from '../models/User.js';
import { getSystemSettings } from '../models/SystemSettings.js';
import { normalizePhoneNumber } from '../utils/phone.util.js';
import { escapeRegex } from '../utils/input.js';
import { idOf } from '../utils/access.js';
import { resetAssignmentSla } from './lead-lifecycle.service.js';

export interface DuplicateCheckInput {
  phone: string;
  whatsappNumber?: string;
  email?: string;
  customerName?: string;
  country?: string;
  serviceId?: string;
  trackId?: string;
  projectDescription?: string;
  estimatedBudget?: number;
  currency?: string;
  leadSource?: string;
  campaignName?: string;
  initialNotes?: string;
  workingRequirements?: Record<string, any>;
  attachments?: any[];
  submittedByUserId?: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  lead?: ILead;
  previousEngineer?: IUser | null;
  isPreviousEngineerBusy: boolean;
}

/**
 * فحص تكرار العميل بأكثر من معيار (هاتف، واتساب، إيميل، أو اسم ودولة)
 */
export async function findDuplicateCustomer(input: DuplicateCheckInput): Promise<DuplicateDetectionResult> {
  const settings = await getSystemSettings();
  const phoneNormalized = normalizePhoneNumber(input.phone, input.country);
  const whatsappNormalized = input.whatsappNumber ? normalizePhoneNumber(input.whatsappNumber, input.country) : undefined;
  const emailClean = input.email ? input.email.trim().toLowerCase() : undefined;

  const orConditions: any[] = [];

  // 1. فحص الهاتف
  if (phoneNormalized && settings.duplicateCheckFields.includes('phone')) {
    orConditions.push({ phoneNormalized });
    orConditions.push({ whatsappNormalized: phoneNormalized });
  }

  // 2. فحص الواتساب إن وجد
  if (whatsappNormalized && settings.duplicateCheckFields.includes('whatsapp')) {
    orConditions.push({ phoneNormalized: whatsappNormalized });
    orConditions.push({ whatsappNormalized });
  }

  // 3. فحص البريد الإلكتروني
  if (emailClean && settings.duplicateCheckFields.includes('email')) {
    orConditions.push({ email: emailClean });
  }

  // 4. فحص تطابق الاسم مع الدولة
  if (input.customerName && input.country && settings.duplicateCheckFields.includes('name')) {
    orConditions.push({
      customerName: { $regex: new RegExp(`^${escapeRegex(input.customerName.trim())}$`, 'i') },
      country: input.country.trim()
    });
  }

  if (orConditions.length === 0) {
    return { isDuplicate: false, isPreviousEngineerBusy: false };
  }

  // البحث عن أحدث سجل للعميل
  const existingLead = await Lead.findOne({ $or: orConditions })
    .populate('assignedEngineerId', 'name email phone isActive isDeleted maxDailyLeads trackId')
    .sort({ updatedAt: -1 });

  if (!existingLead) {
    return { isDuplicate: false, isPreviousEngineerBusy: false };
  }

  // فحص حالة المهندس السابق وهل هو مشغول حالياً
  let isPreviousEngineerBusy = false;
  let previousEngineer: IUser | null = null;

  if (existingLead.assignedEngineerId) {
    previousEngineer = existingLead.assignedEngineerId as unknown as IUser;

    // إذا كان المهندس معطلاً أو محذوفاً
    if (!previousEngineer.isActive || previousEngineer.isDeleted) {
      isPreviousEngineerBusy = true;
    } else {
      // فحص هل المهندس مشغول: هل لديه عملاء في حالة NEW لم يتواصل معهم بعد؟
      const uncontactedLeadsCount = await Lead.countDocuments({
        assignedEngineerId: previousEngineer._id,
        status: LeadStatus.NEW,
        _id: { $ne: existingLead._id }
      });

      // إذا كان لديه عملاء جدد معلقين أو تجاوز سقف الاستيعاب اليومي
      const startOfToday = startOfBusinessDay();

      const todayCount = await Lead.countDocuments({
        assignedEngineerId: previousEngineer._id,
        assignedAt: { $gte: startOfToday }
      });

      if (uncontactedLeadsCount >= 1 || (previousEngineer.maxDailyLeads > 0 && todayCount >= previousEngineer.maxDailyLeads)) {
        isPreviousEngineerBusy = true;
      }
    }
  } else {
    isPreviousEngineerBusy = true;
  }

  return {
    isDuplicate: true,
    lead: existingLead,
    previousEngineer,
    isPreviousEngineerBusy
  };
}

/**
 * تحديث ملف العميل المكرر في نفس مكانه الأصلي دون فتح ملف جديد (Single Unified Profile)
 */
export async function mergeDuplicateLeadInPlace(
  lead: ILead,
  input: DuplicateCheckInput,
  newAssignedEngineerId?: mongoose.Types.ObjectId
): Promise<ILead> {
  // 1. زيادة عداد التكرار وتحديث تاريخ آخر طلب
  lead.isDuplicate = true;
  lead.repeatCount = (lead.repeatCount || 0) + 1;
  lead.lastInquiryAt = new Date();

  // 2. تحديث المتطلبات والميزانية الحالية إن أرسل العميل بيانات جديدة
  // Keep the existing contract intact. New inquiry details belong in its timeline.
  if (input.attachments && input.attachments.length > 0) {
    lead.attachments.push(...input.attachments);
  }

  // 3. إعادة التعيين لمهندس جديد إذا كان المهندس القديم مشغولاً
  let reassignedMessage = '';
  if (![LeadStatus.CONVERTED, LeadStatus.LOST].includes(lead.status) && newAssignedEngineerId && idOf(lead.assignedEngineerId) !== newAssignedEngineerId.toString()) {
    lead.assignedEngineerId = newAssignedEngineerId;
    lead.assignedAt = new Date();
    lead.isReassigned = true;
    await resetAssignmentSla(lead);
    reassignedMessage = ' (تم توجيه المتابعة لمهندس متاح لانشغال المهندس السابق).';
  }

  await lead.save();

  // 4. توثيق الاستفسار الجديد داخل الخط الزمني لنفس العميل (Timeline)
  await LeadActivity.create({
    leadId: lead._id,
    userId: input.submittedByUserId ? new mongoose.Types.ObjectId(input.submittedByUserId) : undefined,
    type: ActivityType.REPEAT_INQUIRY,
    title: `استفسار جديد من عميل مكرر (الطلب رقم ${lead.repeatCount + 1})`,
    content: `قام العميل بالتواصل مجدداً عبر [${input.leadSource || 'الويب'}] بخصوص: ${input.projectDescription || 'طلب خدمة جديدة'}. الميزانية المقترحة: ${input.estimatedBudget !== undefined ? input.estimatedBudget + ' ' + (input.currency || 'USD') : 'غير محددة'}.${reassignedMessage}\n${input.initialNotes || ''}\n${JSON.stringify(input.workingRequirements || {})}`,
    attachments: input.attachments || []
  });

  return lead;
}

