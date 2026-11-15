import { receiverQuery } from '../utils/permissions.js';
import { Track } from '../models/Track.js';
import { startOfBusinessDay } from '../utils/business-time.js';
import mongoose from 'mongoose';
import { User, UserRole, IUser } from '../models/User.js';
import { Lead, AssignmentMethod, LeadStatus } from '../models/Lead.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { RoutingPointer } from '../models/RoutingPointer.js';
import { getSystemSettings, RoutingMode } from '../models/SystemSettings.js';

export interface AssignmentOptions {
  serviceCategoryId?: string;
  trackId?: string;
  excludeEngineerIds?: string[];
  forceMethod?: AssignmentMethod;
}

export interface AssignmentResult {
  engineerId: mongoose.Types.ObjectId | null;
  trackId?: mongoose.Types.ObjectId | null;
  method: AssignmentMethod;
  notes?: string;
}

/**
 * المحرك الذكي لتوزيع العملاء بناءً على إعدادات الأدمن، تراك التخصص، وحالة انشغال المهندسين
 */
export async function assignLeadSmart(options: AssignmentOptions = {}): Promise<AssignmentResult> {
  const settings = await getSystemSettings();
  const excludeIds = (options.excludeEngineerIds || []).map(id => id.toString());

  // تحديد التراك من نوع الخدمة إن لم يُمرر صراحة
  let determinedTrackId = options.trackId ? new mongoose.Types.ObjectId(options.trackId) : null;
  if (!determinedTrackId && options.serviceCategoryId) {
    const service = await ServiceCategory.findById(options.serviceCategoryId).lean();
    if (service?.trackId) {
      determinedTrackId = service.trackId as mongoose.Types.ObjectId;
    }
  }

  // 1. إذا كان التوزيع يدوياً بقرار الأدمن
  if (settings.routingMode === RoutingMode.MANUAL && !options.forceMethod) {
    return {
      engineerId: null,
      trackId: determinedTrackId,
      method: AssignmentMethod.MANUAL_ADMIN,
      notes: 'تم التحويل لطابور التوزيع اليدوي للأدمن.'
    };
  }

  if (!determinedTrackId || !await Track.exists({_id: determinedTrackId, isActive: true})) return {engineerId: null, trackId: determinedTrackId, method: AssignmentMethod.UNASSIGNED_QUEUE, notes: 'يلزم تحديد تراك نشط قبل التوزيع.'};
  const startOfToday = startOfBusinessDay();

  // 2. استعلام جلب المهندسين النشطين
  const query: any = {
    ...receiverQuery,
    isActive: true,
    isDeleted: false
  };

  if (excludeIds.length > 0) {
    query._id = { $nin: excludeIds.map(id => new mongoose.Types.ObjectId(id)) };
  }

  // فلترة حسب التراك أولاً (برمجة، تسويق، مونتاج، تصميم...)
  if (determinedTrackId) {
    query.trackId = determinedTrackId;
  }

  const isSkillBased = Boolean(options.serviceCategoryId) && 
    (settings.routingMode === RoutingMode.AUTO_SKILL_BASED || options.forceMethod === AssignmentMethod.SKILL_BASED);

  if (isSkillBased) {
    query.specializations = new mongoose.Types.ObjectId(options.serviceCategoryId);
  }

  let candidates: any[] = await User.find(query).lean();

  // في حال لم نجد مهندساً متخصصاً بالمهارة الدقيقة داخل التراك، نرجع لجميع مهندسي التراك
  if (candidates.length === 0 && isSkillBased) {
    delete query.specializations;
    candidates = await User.find(query).lean();
  }

  if (candidates.length === 0) {
    return {
      engineerId: null,
      trackId: determinedTrackId,
      method: AssignmentMethod.UNASSIGNED_QUEUE,
      notes: 'لا يوجد مهندسون نشطون متاحون حالياً في التراك المحدد.'
    };
  }

  // 3. حساب عبء العمل لكل مهندس لتحديد من هو مشغول ومن هو متاح
  const workloads = await Lead.aggregate([
    { $match: { assignedEngineerId: { $in: candidates.map(c => c._id) } } },
    { $group: {
      _id: '$assignedEngineerId',
      todayCount: { $sum: { $cond: [{ $gte: ['$assignedAt', startOfToday] }, 1, 0] } },
      activeLeadsCount: { $sum: { $cond: [{ $in: ['$status', [LeadStatus.CONVERTED, LeadStatus.LOST]] }, 0, 1] } },
      uncontactedNewCount: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.NEW] }, 1, 0] } }
    } }
  ]);
  const byEngineer = new Map(workloads.map(w => [w._id.toString(), w]));
  const engineersWithWorkload = candidates.map(user => {
    const work = byEngineer.get(user._id.toString());
    const todayCount = work?.todayCount || 0;
    return { user, todayCount, activeLeadsCount: work?.activeLeadsCount || 0,
      uncontactedNewCount: work?.uncontactedNewCount || 0,
      hasReachedDailyLimit: user.maxDailyLeads > 0 && todayCount >= user.maxDailyLeads,
      isBusy: (work?.uncontactedNewCount || 0) > 0 };
  });

  // استبعاد من تجاوز الحد اليومي
  let eligible = engineersWithWorkload.filter(e => !e.hasReachedDailyLimit);

  if (eligible.length === 0) {
    return {
      engineerId: null,
      trackId: determinedTrackId,
      method: AssignmentMethod.UNASSIGNED_QUEUE,
      notes: 'جميع مهندسي التراك وصلوا لسقف استيعابهم اليومي.'
    };
  }

  // تفضيل المهندسين غير المشغولين أولاً
  if (settings.skipBusyEngineers) {
    const freeEngineers = eligible.filter(e => !e.isBusy);
    if (freeEngineers.length > 0) {
      eligible = freeEngineers;
    }
  }

  // 4. تطبيق استراتيجية التوزيع المختارة
  let selectedEngineerId: mongoose.Types.ObjectId;
  let appliedMethod: AssignmentMethod = AssignmentMethod.ROUND_ROBIN;

  if (settings.routingMode === RoutingMode.AUTO_LEAST_BUSY || options.forceMethod === AssignmentMethod.LEAST_BUSY) {
    eligible.sort((a, b) => a.activeLeadsCount - b.activeLeadsCount || a.todayCount - b.todayCount);
    selectedEngineerId = eligible[0].user._id as mongoose.Types.ObjectId;
    appliedMethod = AssignmentMethod.LEAST_BUSY;
  } else {
    const scope = determinedTrackId ? `TRACK_${determinedTrackId.toString()}` : isSkillBased ? `SERVICE_${options.serviceCategoryId}` : 'GENERAL';
    eligible.sort((a, b) => a.user._id.toString().localeCompare(b.user._id.toString()));
    let pointer;
    try {
      pointer = await RoutingPointer.findOneAndUpdate({ scope }, { $inc: { sequence: 1 } }, { upsert: true, new: true });
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      pointer = await RoutingPointer.findOneAndUpdate({ scope }, { $inc: { sequence: 1 } }, { new: true });
    }
    selectedEngineerId = eligible[((pointer?.sequence || 1) - 1) % eligible.length].user._id;
    appliedMethod = isSkillBased ? AssignmentMethod.SKILL_BASED : AssignmentMethod.ROUND_ROBIN;
  }

  return {
    engineerId: selectedEngineerId,
    trackId: determinedTrackId,
    method: appliedMethod,
    notes: `تم الإسناد وفق وضع [${settings.routingMode}] لتراك التخصص.`
  };
}
