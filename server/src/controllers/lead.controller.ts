import { syncExecutionRoom,refreshBundleParent } from '../services/execution.service.js';
import { hasPermission } from '../utils/permissions.js';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Lead, LeadStatus, AssignmentMethod, ILead } from '../models/Lead.js';
import { LeadActivity, ActivityType } from '../models/LeadActivity.js';
import { Notification, NotificationType } from '../models/Notification.js';
import { getNextSequence } from '../models/Counter.js';
import { User, UserRole, isAdministrator } from '../models/User.js';
import { Track } from '../models/Track.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { getSystemSettings } from '../models/SystemSettings.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { normalizePhoneNumber } from '../utils/phone.util.js';
import { referralLabel } from '../utils/intake.util.js';
import { resolveCustomer } from '../services/customer.service.js';
import { validateIntakeSelection } from '../services/intake.service.js';
import { assignLeadSmart } from '../services/assignment.service.js';
import { validateStatusTransition } from '../utils/stateMachine.js';
import { sseHub } from '../sse/sse.hub.js';
import { logAudit } from '../services/audit.service.js';
import { leadScope, canViewLead, canEditLead, sanitizeActivity, idOf,isTrackBound } from '../utils/access.js';
import { escapeRegex, positiveInteger } from '../utils/input.js';
import { resetAssignmentSla } from '../services/lead-lifecycle.service.js';
import { parseDeviceInfo } from '../utils/device.util.js';

/**
 * 1. تسجيل عميل جديد (سواء من البوابة العامة أو الموظف الداخلي) مع كشف التكرار المتعدد والتوزيع الذكي
 */
export async function createLead(req: AuthRequest, res: Response): Promise<void> {
  try {
    if(req.user&&!hasPermission(req.user,'leads:create_marketing')){res.status(403).json({success:false,message:'تسجيل عميل بالنيابة غير متاح لدورك.'});return;}
    const {
      customerName,
      phone,
      whatsappNumber,
      email,
      country,
      city,
      preferredContactMethod,
      preferredLanguage,
      leadSource,
      campaignName,
      initialNotes,
      initialServiceId,
      initialRequirements,
      projectDescription,
      estimatedBudget,
      currency,
      priority,
      attachments,
      trackId: inputTrackId
    } = req.body;

    if (!customerName || !phone || !country) {
      res.status(400).json({
        success: false,
        message: 'بيانات ناقصة: الاسم ورقم الهاتف والدولة حقول إلزامية.'
      });
      return;
    }

    const settings = await getSystemSettings();
    const phoneCountry = req.body.phoneCountryCode || country;
    const phoneNormalized = normalizePhoneNumber(phone, phoneCountry);
    const whatsappNormalized = whatsappNumber ? normalizePhoneNumber(whatsappNumber, phoneCountry) : phoneNormalized;
    if (!phoneNormalized || !whatsappNormalized) { res.status(400).json({ success: false, message: 'رقم الهاتف أو الواتساب غير صالح للدولة المحددة.' }); return; }

    const selection = await validateIntakeSelection(req.body, !!req.user);
    const trackId = selection.primaryTrackId;
    const primaryServiceId = selection.primaryServiceId;
    const customer = await resolveCustomer({
      customerName, phone, phoneNormalized, country, whatsappNumber, email,
      companyName: req.body.companyName, websiteUrl: req.body.websiteUrl,
      socialLinks: req.body.socialLinks, position: req.body.position
    });
    const isReturningCustomer = await Lead.exists({ customerId: customer!._id });

    // B. العميل جديد تماماً: توليد كود متسلسل فريد #LD-XXXXX
    const seq = await getNextSequence('leadCode');
    const leadCode = `#LD-${seq}`;

    // C. التوزيع الذكي على المهندسين التابعين للتراك
    const routingResult = selection.needsAssessment || req.body.intakeMode === 'VOICE'
      ? { engineerId: null, method: AssignmentMethod.MANUAL_ADMIN, notes: 'الطلب ينتظر مراجعة الإدارة لتحديد المسؤول الرئيسي.' }
      : await assignLeadSmart({ serviceCategoryId: primaryServiceId, trackId });

    // حساب مهلة الرد SLA
    const slaTimeoutAt = new Date();
    slaTimeoutAt.setMinutes(slaTimeoutAt.getMinutes() + (settings.slaTimeoutMinutes || 120));

    // مهلة تأكيد استلام الطلب من المهندس (افتراضياً 10 دقائق)
    const slaAcknowledgeMinutes = settings.slaAcknowledgeMinutes || 10;
    const slaAcknowledgeDeadline = new Date();
    slaAcknowledgeDeadline.setMinutes(slaAcknowledgeDeadline.getMinutes() + slaAcknowledgeMinutes);

    const newLead = await Lead.create({
      leadCode,
      customerId: customer!._id,
      intakeVersion: req.body.intakeVersion,
      intakeMode: req.body.intakeMode,
      voiceRecording: req.body.intakeMode === 'VOICE' ? req.body.voiceRecording : undefined,
      voiceReviewStatus: req.body.intakeMode === 'VOICE' ? 'PENDING' : undefined,
      phoneCountryCode: req.body.phoneCountryCode,
      referralSource: req.body.referralSource,
      referralDetails: req.body.referralDetails,
      campaignAttribution: req.body.campaignAttribution,
      companyName: req.body.companyName, websiteUrl: req.body.websiteUrl,
      socialLinks: req.body.socialLinks || [], position: req.body.position,
      serviceIds: selection.serviceIds, departmentIds: selection.departmentIds,
      serviceQuestionsSnapshot:Object.fromEntries((await ServiceCategory.find({_id:{$in:selection.serviceIds}})).map(service=>[service.id,service.dynamicFormFields])),
      serviceRequirements: selection.serviceRequirements,
      serviceSelection: primaryServiceId ? req.body.serviceSelection || 'SELECTED' : req.body.serviceSelection === 'OTHER' ? 'OTHER' : 'NOT_SURE',
      otherService: req.body.otherService, projectTypes: req.body.projectTypes || [],
      projectName: req.body.projectName, mainGoal: req.body.mainGoal,
      targetAudience: req.body.targetAudience, hasExistingProject: req.body.hasExistingProject,
      problemToSolve: req.body.problemToSolve, expectedResults: req.body.expectedResults,
      referenceLinks: req.body.referenceLinks || [], budgetRange: req.body.budgetRange,
      preferredStartDate: req.body.preferredStartDate, expectedDeadline: req.body.expectedDeadline,
      paymentPreference: req.body.paymentPreference,
      privacyAcceptedAt: req.body.privacyAccepted ? new Date() : undefined,
      contactAcceptedAt: req.body.contactAccepted ? new Date() : undefined,
      needsAssessment: selection.needsAssessment || req.body.intakeMode === 'VOICE',
      intakeChannel: req.user ? 'INTERNAL_STAFF' : 'PUBLIC_CUSTOMER_PORTAL',
      submittedByUserId: req.user?._id,
      trackId: trackId ? new mongoose.Types.ObjectId(trackId) : undefined,
      customerName: customerName.trim(),
      phone: phone.trim(),
      phoneNormalized,
      whatsappNumber: whatsappNumber?.trim() || phone.trim(),
      whatsappNormalized,
      email: email?.trim().toLowerCase(),
      country: country.trim(),
      city: city?.trim(),
      preferredContactMethod: preferredContactMethod || 'WHATSAPP',
      preferredLanguage: preferredLanguage || 'AR',

      marketingEmployeeName: req.user?.name || 'عميل مباشر من الويب',
      leadSource: leadSource || referralLabel(req.body.referralSource) || req.body.campaignAttribution?.utmSource || (req.user ? 'إدخال موظف' : 'بوابة الويب المباشرة'),
      campaignName: campaignName || req.body.campaignAttribution?.utmCampaign,
      initialNotes,
      initialServiceId: primaryServiceId,
      initialRequirements: initialRequirements || {},

      // المرحلة الفنية الأولية (تنتظر اعتماد المهندس بعد أول تواصل)
      technicalIntake: {
        isCompleted: false,
        currency: currency || 'USD'
      },

      currentServiceId: primaryServiceId,
      projectDescription,
      estimatedBudget,
      currency: currency || 'USD',
      workingRequirements: initialRequirements || {},
      attachments: attachments || [],

      assignedEngineerId: routingResult.engineerId,
      assignedAt: routingResult.engineerId ? new Date() : undefined,
      assignmentMethod: routingResult.method,

      status: LeadStatus.NEW,
      priority: priority || 'MEDIUM',
      slaTimeoutAt: routingResult.engineerId ? slaTimeoutAt : undefined,
      slaAcknowledgeDeadline: routingResult.engineerId ? slaAcknowledgeDeadline : undefined
    });

    // إضافة أول نشاط في الـ Timeline
    await LeadActivity.create({
      leadId: newLead._id,
      userId: req.user?._id,
      type: ActivityType.NOTE,
      title: 'تسجيل طلب جديد للعميل',
      content: `تم استقبال طلب العميل عبر [${newLead.leadSource}]. طريقة التوزيع: [${routingResult.method}]. ${routingResult.notes || ''}`
    });

    // إشعار المهندس المستلم
    if (routingResult.engineerId) {
      await Notification.create({
        userId: routingResult.engineerId,
        leadId: newLead._id,
        type: NotificationType.NEW_LEAD_ASSIGNED,
        title: 'تم إسناد عميل جديد إليك',
        message: `تم إسناد العميل [${newLead.customerName}] (${newLead.leadCode}) لمتابعة طلبه.`
      });

      sseHub.sendToUser(routingResult.engineerId.toString(), {
        type: 'NEW_LEAD_ASSIGNED',
        title: 'تم إسناد عميل جديد إليك',
        message: `تم إسناد العميل [${newLead.customerName}] (${newLead.leadCode}) لمتابعة طلبه.`,
        lead: newLead
      });
    }

    if(newLead.voiceReviewStatus==='PENDING'){
      const reviewers=(await User.find({isActive:true,isDeleted:false,$or:[{role:{$in:['STAFF','MARKETING','ADMIN','SUPER_ADMIN']}},{permissions:'voice:review'}]})).filter(user=>hasPermission(user,'voice:review'));
      for(const reviewer of reviewers){await Notification.create({userId:reviewer._id,leadId:newLead._id,type:NotificationType.UNASSIGNED_LEAD_ALERT,title:'تسجيل صوتي جديد يحتاج تنسيقًا',message:`طلب ${newLead.leadCode} ينتظر سماع التسجيل وتنسيق احتياج العميل.`});sseHub.sendToUser(reviewer.id,{type:'VOICE_REVIEW_PENDING',title:'تسجيل صوتي جديد يحتاج تنسيقًا'});}
    }
    sseHub.broadcast({type:'LEAD_UPDATED'});
    await newLead.populate('assignedEngineerId', 'name email phone');
    await newLead.populate('trackId', 'name slug color');

    if (!req.user || !canViewLead(req.user,newLead)) {
      res.status(201).json({ success: true, message: 'تم استقبال طلبكم بنجاح.', data: { lead: { leadCode: newLead.leadCode } } }); return;
    }
    res.status(201).json({
      success: true,
      isReturningCustomer: !!isReturningCustomer,
      message: 'تم تسجيل طلب مستقل وربطه بملف العميل.',
      data: { 
        lead: newLead,
        assignedEngineer: newLead.assignedEngineerId
      }
    });
  } catch (error: any) {
    console.error('Create Lead Error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status === 400 ? error.message : 'حدث خطأ أثناء معالجة وتسجيل الطلب.'
    });
  }
}

/**
 * 2. جلب قائمة العملاء مع الفلاتر والبحث والترقيم (Pagination & Data Scoping)
 */
export async function getLeads(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      page = '1',
      limit = '25',
      status,
      search,
      priority,
      serviceId,
      trackId,
      unassignedOnly,
      customerId
    } = req.query;

    const pageNum = positiveInteger(page, 1, 1000000);
    const limitNum = positiveInteger(limit, 25);
    const skip = (pageNum - 1) * limitNum;

    const filters: any = {};
    const scope = leadScope(req.user!);
    const query: any = { $and: [scope, filters] };
    if (trackId) query.$and.push({ $or: [{ trackId }, { departmentIds: trackId }] });
    if (customerId) filters.customerId = customerId;
    if (req.query.assignedToMe === 'true') filters.assignedEngineerId = req.user!._id;
    if (req.query.submittedByMe === 'true') query.$and.push({$or:[{submittedByUserId:req.user!._id},{voiceReviewedBy:req.user!._id}]});
    if (req.query.voicePending === 'true') filters.voiceReviewStatus = 'PENDING';
    if (unassignedOnly === 'true') {filters.assignedEngineerId = null;filters.isBundleParent={$ne:true};}
    if(req.query.parentRequestId){if(!mongoose.isValidObjectId(String(req.query.parentRequestId))){res.status(400).json({success:false});return;}filters.parentRequestId=req.query.parentRequestId;}

    // فلتر الحالة
    if (status && Object.values(LeadStatus).includes(status as LeadStatus)) {
      filters.status = status;
    }

    // فلتر الأولوية
    if (priority) {
      filters.priority = priority;
    }

    // فلتر الخدمة
    if (serviceId) {
      query.$and.push({ $or: [{ currentServiceId: serviceId }, { initialServiceId: serviceId }, { serviceIds: serviceId }] });
    }

    // البحث السريع بالاسم أو الهاتف أو كود العميل
    if (search) {
      const searchClean = escapeRegex((search as string).trim().slice(0, 200));
      filters.$or = [
        { customerName: { $regex: searchClean, $options: 'i' } },
        { phone: { $regex: searchClean, $options: 'i' } },
        { phoneNormalized: { $regex: searchClean, $options: 'i' } },
        { leadCode: { $regex: searchClean, $options: 'i' } },
        { email: { $regex: searchClean, $options: 'i' } },
        { projectName: { $regex: searchClean, $options: 'i' } },
        { companyName: { $regex: searchClean, $options: 'i' } }
      ];
    }

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('assignedEngineerId', 'name email phone')
        .populate('currentServiceId', 'name slug')
        .populate('serviceIds', 'name slug')
        .populate('departmentIds', 'name slug color')
        .populate('trackId', 'name slug color')
        .populate('submittedByUserId', 'name')
        .populate('technicalIntake.completedByUserId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Lead.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب العملاء.' });
  }
}

/**
 * 3. جلب تفاصيل عميل بالكامل مع الـ Timeline والمرفقات
 */
export async function getLeadById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id)
      .populate('assignedEngineerId', 'name email phone maxDailyLeads')
      .populate('currentServiceId')
      .populate('initialServiceId')
      .populate('serviceIds', 'name slug trackId dynamicFormFields')
      .populate('departmentIds', 'name slug color')
      .populate('trackId', 'name slug color')
      .populate('submittedByUserId', 'name email')
      .populate('voiceReviewedBy','name')
      .populate('technicalIntake.completedByUserId', 'name email');

    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    if (!canViewLead(req.user!, lead)) {
      res.status(403).json({ success: false, message: 'لا تملك صلاحية عرض بيانات هذا العميل.' }); return;
    }

    // جلب الخط الزمني للأنشطة
    const activities = await LeadActivity.find({ leadId: lead._id })
      .populate('userId', 'name role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { lead, activities: activities.map(a => sanitizeActivity(a, hasPermission(req.user,'audit:view'))) }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب بيانات العميل.' });
  }
}

/**
 * 4. اعتذار المهندس عن استلام العميل (Decline Lead with Reason)
 */
export async function declineLead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'يرجى كتابة سبب الاعتذار عن العميل.' });
      return;
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    // التأكد من أن المستخدم هو المهندس المسؤول أو الأدمن
    if(lead.isBundleParent || !lead.assignedEngineerId || lead.voiceReviewStatus==='PENDING'){res.status(409).json({success:false,message:'لا يمكن الاعتذار عن طلب لم تتم مراجعته وإسناده.'});return;}
    if (!canEditLead(req.user!, lead)) {
      res.status(403).json({ success: false, message: 'غير مصرح لك بالاعتذار عن هذا العميل.' });
      return;
    }

    const decliningEngineerName = req.user?.name || 'المهندس';
    if ([LeadStatus.CONVERTED, LeadStatus.LOST].includes(lead.status)) { res.status(400).json({success: false, message: 'لا يمكن الاعتذار عن صفقة مغلقة.'}); return; }
    const decliningEngineerId = req.user?._id;

    // توثيق الاعتذار في قائمة المستبعدين للعميل
    lead.rejectedByEngineers.push({
      engineerId: decliningEngineerId!,
      reason: reason.trim(),
      rejectedAt: new Date()
    });

    // استبعاد المهندس السابق وكافة من اعتذروا عن هذا العميل
    const excludeIds = lead.rejectedByEngineers.map(r => r.engineerId.toString());

    // البحث عن المهندس التالي المتاح (الفاضي)
    const routingResult = await assignLeadSmart({
      serviceCategoryId: lead.currentServiceId?.toString() || lead.initialServiceId?.toString(),
      trackId: lead.trackId?.toString(),
      excludeEngineerIds: excludeIds
    });

    const oldEngineerId = lead.assignedEngineerId;
    lead.assignedEngineerId = routingResult.engineerId || undefined;
    lead.assignedAt = routingResult.engineerId ? new Date() : undefined;
    lead.assignmentMethod = AssignmentMethod.REASSIGNED_AFTER_DECLINE;
    lead.isReassigned = true;
    if (![LeadStatus.CONVERTED, LeadStatus.LOST].includes(lead.status)) lead.status = LeadStatus.NEW;
    await resetAssignmentSla(lead);

    await lead.save();
    await syncExecutionRoom(lead);
    await refreshBundleParent(lead);

    // توثيق في الـ Timeline
    await LeadActivity.create({
      leadId: lead._id,
      userId: decliningEngineerId,
      type: ActivityType.ENGINEER_DECLINED,
      title: 'اعتذار مهندس عن استلام العميل',
      content: `اعتذر المهندس [${decliningEngineerName}] عن استلام العميل. السبب: "${reason.trim()}". ${routingResult.engineerId ? 'تم تحويل العميل تلقائياً للمهندس التالي المتاح.' : 'تم تحويل العميل لطابور الانتظار لعدم توفر بديل حالياً.'}`
    });

    // إشعار للمهندس الجديد إن وجد
    if (routingResult.engineerId) {
      await Notification.create({
        userId: routingResult.engineerId,
        leadId: lead._id,
        type: NotificationType.NEW_LEAD_ASSIGNED,
        title: 'تم تحويل عميل إليك بعد اعتذار زميلك',
        message: `تم إسناد العميل [${lead.customerName}] إليك للمتابعة.`
      });

      sseHub.sendToUser(routingResult.engineerId.toString(), {
        type: 'NEW_LEAD_ASSIGNED',
        title: 'تم تحويل عميل إليك بعد اعتذار زميلك',
        message: `تم إسناد العميل [${lead.customerName}] إليك للمتابعة.`,
        lead
      });
    }

    res.json({
      success: true,
      message: 'تم تسجيل الاعتذار ونقل العميل بنجاح للمهندس التالي.',
      data: { lead }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تسجيل الاعتذار.' });
  }
}

/**
 * 5. تحديث حالة العميل ومراقبة الـ State Machine واحتساب سرعة الرد SLA
 */
export async function updateLeadStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, lostReason, conversionValue, notes } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    // التحقق من الصلاحية: المهندس المسند له العميل أو الأدمن فقط (التيم ليدر للمراقبة فقط "يبص بس")
    const isAssigned = canEditLead(req.user!, lead);
    const isAdmin = isAdministrator(req.user?.role) && hasPermission(req.user,'leads:edit_technical');
    if (!isAssigned && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'فقط المهندس المسند له العميل أو الإدارة يمتلكون صلاحية تعديل الحالة.'
      });
      return;
    }

    // التحقق من قواعد الـ State Machine
    const validation = validateStatusTransition(
      lead.status,
      status as LeadStatus,
      isAdmin
    );

    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }

    const oldStatus = lead.status;
    lead.status = status;

    if (status === LeadStatus.LOST) {
      if (!lostReason?.trim()) {
        res.status(400).json({ success: false, message: 'يرجى توضيح سبب إلغاء الصفقة (Lost Reason).' });
        return;
      }
      lead.lostReason = lostReason;
    }

    if (status === LeadStatus.CONVERTED) {
      if (!lead.paymentReceipt?.isReceived || lead.paymentReceipt.paymentType === 'DEPOSIT') {
        res.status(400).json({ 
          success: false, 
          message: 'لا يمكن تحويل حالة العميل إلى [ناجحة CONVERTED] إلا بعد تأكيد استلام الدفعة ورفع إيصال التحويل المالي عبر المرحلة 4.' 
        });
        return;
      }
      if (!conversionValue && !lead.conversionValue) {
        lead.conversionValue = lead.paymentReceipt.amount;
      }
    }

    if (conversionValue !== undefined && status === LeadStatus.CONVERTED) lead.conversionValue = conversionValue;

    // احتساب أول تواصل (First Contact Latency)
    if (!lead.firstContactedAt && status === LeadStatus.CONTACTED) {
      lead.firstContactedAt = new Date();
      lead.responseTimeMinutes = Math.round(
        (lead.firstContactedAt.getTime() - lead.createdAt.getTime()) / (1000 * 60)
      );
    }

    await lead.save();
    await syncExecutionRoom(lead);
    await refreshBundleParent(lead);

    const devInfo = parseDeviceInfo(req);

    // توثيق في الـ Timeline
    await LeadActivity.create({
      leadId: lead._id,
      userId: req.user?._id,
      type: ActivityType.STATUS_CHANGE,
      title: `تغيير الحالة إلى [${status}]`,
      oldStatus,
      newStatus: status,
      content: notes || (status === LeadStatus.LOST ? `السبب: ${lostReason}` : status === LeadStatus.CONVERTED ? `القيمة: ${conversionValue}` : undefined),
      ipAddress: devInfo.ipAddress,
      deviceSummary: devInfo.deviceSummary
    });

    // تسجيل رقابي للإدارة
    await logAudit(req, {
      action: 'STATUS_CHANGE',
      actionTitle: `تغيير حالة العميل إلى [${status}]`,
      entityType: 'LEAD',
      entityId: lead._id.toString(),
      entityCode: lead.leadCode,
      details: `تم تغيير حالة العميل ${lead.customerName} من [${oldStatus}] إلى [${status}]`,
      oldValues: { status: oldStatus },
      newValues: { status }
    });

    res.json({
      success: true,
      message: 'تم تحديث حالة العميل بنجاح.',
      data: { lead }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تحديث الحالة.' });
  }
}

/**
 * 6. إعادة تعيين عميل لمهندس آخر يدوياً بواسطة الأدمن
 */
export async function reassignLead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { targetEngineerId, reason } = req.body;

    if (!targetEngineerId || !reason) {
      res.status(400).json({ success: false, message: 'يرجى تحديد المهندس المستهدف وتوثيق سبب النقل.' });
      return;
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    if(!canViewLead(req.user!,lead)){res.status(403).json({success:false});return;}
    if(lead.isBundleParent || lead.departmentIds.length>1){res.status(409).json({success:false,message:'افصل الطلب متعدد التراكات أولًا، ثم اسند كل جزء لتراكه.'});return;}
    if (lead.voiceReviewStatus === 'PENDING') { res.status(409).json({success:false,message:'يلزم تنسيق التسجيل الصوتي قبل إسناده للمهندس.'}); return; }
    const targetEngineer = await User.findById(targetEngineerId);
    if (!targetEngineer || !targetEngineer.trackId || !await Track.exists({_id:targetEngineer.trackId,isActive:true}) || !targetEngineer.isActive || targetEngineer.isDeleted || ['ADMIN','SUPER_ADMIN'].includes(targetEngineer.role) || !hasPermission(targetEngineer, 'routing:receive') || (lead.trackId && idOf(targetEngineer.trackId) !== idOf(lead.trackId)) || (!lead.trackId && lead.departmentIds.length>0 && !lead.departmentIds.some(id=>idOf(id)===idOf(targetEngineer.trackId)))) {
      res.status(400).json({ success: false, message: 'المهندس المختار غير متاح حالياً.' });
      return;
    }

    if(isTrackBound(req.user!)&&idOf(targetEngineer.trackId)!==idOf(req.user!.trackId)){res.status(403).json({success:false});return;}
    lead.trackId=targetEngineer.trackId;
    lead.assignedEngineerId = targetEngineer._id;
    lead.assignedAt = new Date();
    lead.isReassigned = true;
    lead.assignmentMethod = AssignmentMethod.MANUAL_ADMIN;
    await resetAssignmentSla(lead);
    await lead.save();
    await syncExecutionRoom(lead);
    await refreshBundleParent(lead);

    // توثيق النقل
    const devInfo = parseDeviceInfo(req);
    await LeadActivity.create({
      leadId: lead._id,
      userId: req.user?._id,
      type: ActivityType.REASSIGNED,
      title: 'إعادة تعيين يدوي من الإدارة',
      content: `قام الأدمن بنقل العميل إلى المهندس [${targetEngineer.name}]. السبب: ${reason}`,
      ipAddress: devInfo.ipAddress,
      deviceSummary: devInfo.deviceSummary
    });

    await logAudit(req, {
      action: 'LEAD_REASSIGNED',
      actionTitle: 'إعادة إسناد العميل يدوياً',
      entityType: 'LEAD',
      entityId: lead._id.toString(),
      entityCode: lead.leadCode,
      details: `قام الأدمن بنقل العميل [${lead.customerName}] إلى المهندس [${targetEngineer.name}]. السبب: ${reason}`
    });

    // إشعار
    await Notification.create({
      userId: targetEngineer._id,
      leadId: lead._id,
      type: NotificationType.LEAD_REASSIGNED,
      title: 'تم إسناد عميل جديد إليك من الإدارة',
      message: `تم إسناد العميل [${lead.customerName}] (${lead.leadCode}) إليك.`
    });

    sseHub.sendToUser(targetEngineer._id.toString(), {
      type: 'LEAD_REASSIGNED',
      title: 'تم إسناد عميل جديد إليك من الإدارة',
      message: `تم إسناد العميل [${lead.customerName}] (${lead.leadCode}) إليك.`,
      lead
    });

    res.json({
      success: true,
      message: 'تمت إعادة تعيين العميل بنجاح.',
      data: { lead }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل إعادة التعيين.' });
  }
}

/**
 * 7. تأكيد استلام الطلب من المهندس (SLA 1: افتراضياً 10 دقائق)
 */
export async function acknowledgeLead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lead = await Lead.findById(id).populate('trackId');
    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    if(lead.isBundleParent || !lead.assignedEngineerId || lead.voiceReviewStatus==='PENDING'){res.status(409).json({success:false,message:'يلزم مراجعة الطلب وإسناده قبل بدء مراحل عمل المهندس.'});return;}
    const isAssigned = canEditLead(req.user!, lead);
    const isAdmin = isAdministrator(req.user?.role) && hasPermission(req.user,'leads:edit_technical');
    if (!isAssigned && !isAdmin) {
      res.status(403).json({ success: false, message: 'فقط المهندس المسند له الطلب أو الإدارة يمكنهم تأكيد الاستلام.' });
      return;
    }

    if (lead.acknowledgedAt) {
      res.status(400).json({ success: false, message: 'تم تأكيد استلام هذا الطلب مسبقاً.' });
      return;
    }

    const settings = await getSystemSettings();
    const now = new Date();
    lead.acknowledgedAt = now;

    // بدء مهلة التواصل (SLA 2: افتراضياً 5 دقائق)
    const contactMinutes = settings.slaContactMinutes || 5;
    const slaContactDeadline = new Date(now.getTime() + contactMinutes * 60000);
    lead.slaContactDeadline = slaContactDeadline;

    await lead.save();
    await syncExecutionRoom(lead);
    await refreshBundleParent(lead);

    const devInfo = parseDeviceInfo(req);

    // توثيق في الخط الزمني
    await LeadActivity.create({
      leadId: lead._id,
      userId: req.user?._id,
      type: ActivityType.LEAD_ACKNOWLEDGED,
      title: 'تأكيد استلام الطلب ⚡',
      content: `قام المهندس [${req.user?.name}] بتأكيد استلام الطلب وبدء مهلة التواصل المحددة (${contactMinutes} دقائق).`,
      ipAddress: devInfo.ipAddress,
      deviceSummary: devInfo.deviceSummary
    });

    await logAudit(req, {
      action: 'LEAD_ACKNOWLEDGED',
      actionTitle: 'تأكيد استلام الطلب',
      entityType: 'LEAD',
      entityId: lead._id.toString(),
      entityCode: lead.leadCode,
      details: `قام المهندس [${req.user?.name}] بتأكيد استلام الطلب [${lead.customerName}]`
    });

    sseHub.broadcast({
      type: 'LEAD_UPDATED'
    });

    const updatedLead = await Lead.findById(id)
      .populate('assignedEngineerId', 'name email phone')
      .populate('currentServiceId', 'name slug')
      .populate('trackId', 'name slug color');

    res.json({
      success: true,
      message: `تم تأكيد استلام الطلب بنجاح. بدأت الآن مهلة التواصل مع العميل (${contactMinutes} دقائق).`,
      data: { lead: updatedLead }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تأكيد استلام الطلب.' });
  }
}

/**
 * 8. تأكيد أول تواصل مع العميل (SLA 2: افتراضياً 5 دقائق)
 */
export async function confirmContact(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lead = await Lead.findById(id).populate('trackId');
    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    if(lead.isBundleParent || !lead.assignedEngineerId || lead.voiceReviewStatus==='PENDING'){res.status(409).json({success:false,message:'يلزم مراجعة الطلب وإسناده قبل بدء مراحل عمل المهندس.'});return;}
    const isAssigned = canEditLead(req.user!, lead);
    const isAdmin = isAdministrator(req.user?.role) && hasPermission(req.user,'leads:edit_technical');
    if (!isAssigned && !isAdmin) {
      res.status(403).json({ success: false, message: 'فقط المهندس المسند له الطلب أو الإدارة يمكنهم تأكيد التواصل.' });
      return;
    }

    if (!lead.acknowledgedAt) { res.status(400).json({ success: false, message: 'يجب تأكيد الاستلام أولاً.' }); return; }
    if (lead.contactConfirmedAt) { res.status(409).json({ success: false, message: 'تم تأكيد التواصل مسبقاً.' }); return; }
    const now = new Date();
    lead.contactConfirmedAt = now;
    if (!lead.firstContactedAt) {
      lead.firstContactedAt = now;
      lead.responseTimeMinutes = Math.round((now.getTime() - lead.createdAt.getTime()) / 60000);
    }
    if (lead.status === LeadStatus.NEW) {
      lead.status = LeadStatus.CONTACTED;
    }

    await lead.save();
    await syncExecutionRoom(lead);
    await refreshBundleParent(lead);

    const devInfo = parseDeviceInfo(req);

    // توثيق في الخط الزمني
    await LeadActivity.create({
      leadId: lead._id,
      userId: req.user?._id,
      type: ActivityType.FIRST_CONTACT_CONFIRMED,
      title: 'تأكيد التواصل مع العميل 📞',
      content: `قام المهندس [${req.user?.name}] بتأكيد إتمام أول تواصل مع العميل والبدء في استكشاف تفاصيل المشروع.`,
      ipAddress: devInfo.ipAddress,
      deviceSummary: devInfo.deviceSummary
    });

    await logAudit(req, {
      action: 'FIRST_CONTACT_CONFIRMED',
      actionTitle: 'تأكيد أول تواصل مع العميل',
      entityType: 'LEAD',
      entityId: lead._id.toString(),
      entityCode: lead.leadCode,
      details: `قام المهندس [${req.user?.name}] بتأكيد التواصل مع العميل [${lead.customerName}]`
    });

    sseHub.broadcast({
      type: 'LEAD_UPDATED'
    });

    const updatedLead = await Lead.findById(id)
      .populate('assignedEngineerId', 'name email phone')
      .populate('currentServiceId', 'name slug')
      .populate('trackId', 'name slug color');

    res.json({
      success: true,
      message: 'تم تأكيد التواصل مع العميل بنجاح. يمكنك الآن توثيق تفاصيل المحادثة والمواصفات الفنية.',
      data: { lead: updatedLead }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تأكيد التواصل مع العميل.' });
  }
}

/**
 * 10. اعتماد وتوثيق المواصفات الفنية للمشروع وتفاصيل محادثة العميل
 */
export async function updateTechnicalIntake(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      communicationMethod,
      clientDiscussionNotes,
      chatTranscript,
      chatAttachments,
      clientRequirements,
      projectScope,
      deliverables,
      agreedBudget,
      currency,
      estimatedDuration,
      toolsOrTechStack,
      technicalNotes
    } = req.body;

    const lead = await Lead.findById(id).populate('trackId');
    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    // التحقق من الصلاحية: المهندس المسند له، أو الأدمن (أما التيم ليدر فله حق المراقبة فقط "يبص بس")
    if(lead.isBundleParent || !lead.assignedEngineerId || lead.voiceReviewStatus==='PENDING'){res.status(409).json({success:false,message:'يلزم مراجعة الطلب وإسناده قبل بدء مراحل عمل المهندس.'});return;}
    const isAssignedEngineer = canEditLead(req.user!, lead);
    const isAdmin = isAdministrator(req.user?.role) && hasPermission(req.user,'leads:edit_technical');
    if (!isAssignedEngineer && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'فقط المهندس المسند له العميل أو الإدارة يمكنهم توثيق واعتماد المواصفات الفنية للمشروع.'
      });
      return;
    }

    // تجميد الوثيقة التعاقدية بعد نجاح الصفقة وإثبات الدفع (CONVERTED)
    if ((lead.status === LeadStatus.CONVERTED || lead.paymentReceipt?.isReceived) && !isAdmin) {
      res.status(400).json({
        success: false,
        message: 'تم تجميد وثيقة المواصفات الفنية والمتطلبات رسمياً بعد إتمام التعاقد واستلام الدفعة المالية (CONVERTED) لضمان حماية حقوق العميل والشركة ومنع أي تعديل في نطاق العمل.'
      });
      return;
    }

    if (communicationMethod) lead.communicationMethod = communicationMethod;
    if (clientDiscussionNotes !== undefined) lead.clientDiscussionNotes = clientDiscussionNotes;
    if (chatTranscript !== undefined) lead.chatTranscript = chatTranscript;
    if (chatAttachments !== undefined && Array.isArray(chatAttachments)) lead.chatAttachments = chatAttachments;
    if (clientRequirements !== undefined && Array.isArray(clientRequirements)) lead.clientRequirements = clientRequirements;

    // استكمال تأكيد الاستلام والتواصل تلقائياً إذا كان المهندس يوثق المواصفات مباشرة
    if (!lead.acknowledgedAt) {
      lead.acknowledgedAt = new Date();
    }
    if (!lead.contactConfirmedAt) {
      lead.contactConfirmedAt = new Date();
      if (!lead.firstContactedAt) {
        lead.firstContactedAt = new Date();
        lead.responseTimeMinutes = Math.round((lead.firstContactedAt.getTime() - lead.createdAt.getTime()) / 60000);
      }
    }

    lead.technicalIntake = {
      isCompleted: true,
      completedAt: new Date(),
      completedByUserId: req.user?._id,
      projectScope: projectScope?.trim(),
      deliverables: Array.isArray(deliverables) ? deliverables.filter((d: string) => d.trim().length > 0) : [],
      agreedBudget: agreedBudget ?? lead.estimatedBudget ?? 0,
      currency: currency || lead.currency || 'USD',
      estimatedDuration: estimatedDuration?.trim(),
      toolsOrTechStack: toolsOrTechStack?.trim(),
      technicalNotes: technicalNotes?.trim()
    };

    // تحديث البيانات العملية للمشروع
    if (projectScope) lead.projectDescription = projectScope;
    if (agreedBudget !== undefined) lead.estimatedBudget = Number(agreedBudget);
    if (currency) lead.currency = currency;

    // ترقية حالة العميل تلقائياً إلى مؤهل QUALIFIED إذا كان جديداً أو تم التواصل
    if (lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED) {
      lead.status = LeadStatus.QUALIFIED;
    }

    await lead.save();
    await syncExecutionRoom(lead);
    await refreshBundleParent(lead);

    const devInfo = parseDeviceInfo(req);

    // إضافة نشاط في الخط الزمني (Timeline)
    await LeadActivity.create({
      leadId: lead._id,
      userId: req.user?._id,
      type: ActivityType.TECHNICAL_INTAKE_COMPLETED,
      title: 'توثيق واعتماد المواصفات الفنية ومتطلبات العميل',
      content: `قام المهندس [${req.user?.name}] بتوثيق تفاصيل النقاش، المتطلبات الفنية، والميزانية المتفق عليها (${lead.technicalIntake.agreedBudget} ${lead.technicalIntake.currency})، والمرفقات.`,
      ipAddress: devInfo.ipAddress,
      deviceSummary: devInfo.deviceSummary
    });

    await logAudit(req, {
      action: 'TECHNICAL_INTAKE_COMPLETED',
      actionTitle: 'اعتماد المواصفات الفنية للمشروع',
      entityType: 'LEAD',
      entityId: lead._id.toString(),
      entityCode: lead.leadCode,
      details: `تم توثيق المواصفات الفنية ونطاق العمل للعميل [${lead.customerName}] والميزانية (${lead.technicalIntake.agreedBudget} ${lead.technicalIntake.currency})`
    });

    // إشعار التيم ليدر الخاص بالتراك
    const trackDoc: any = lead.trackId;
    if (trackDoc && trackDoc.teamLeaderId) {
      const leaderId = trackDoc.teamLeaderId._id ? trackDoc.teamLeaderId._id : trackDoc.teamLeaderId;
      await Notification.create({
        userId: leaderId,
        leadId: lead._id,
        type: NotificationType.TECHNICAL_INTAKE_COMPLETED,
        title: `اكتملت المواصفات الفنية للعميل [${lead.customerName}]`,
        message: `المهندس [${req.user?.name}] قام بتوثيق المتطلبات الفنية والميزانية في تراك [${trackDoc.name}].`
      });

      sseHub.sendToUser(leaderId.toString(), {
        type: 'TECHNICAL_INTAKE_COMPLETED',
        title: `اكتملت المواصفات الفنية للعميل [${lead.customerName}]`,
        message: `المهندس [${req.user?.name}] قام بتوثيق المتطلبات الفنية في تراك [${trackDoc.name}].`,
        leadId: lead._id
      });
    }

    // إشعار الـ SSE
    sseHub.broadcast({
      type: 'LEAD_UPDATED'
    });

    const updatedLead = await Lead.findById(id)
      .populate('assignedEngineerId', 'name email phone')
      .populate('currentServiceId', 'name slug')
      .populate('trackId', 'name slug color')
      .populate('technicalIntake.completedByUserId', 'name email');

    res.json({
      success: true,
      message: 'تم اعتماد وتوثيق المواصفات الفنية والمتطلبات بنجاح.',
      data: { lead: updatedLead }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل توثيق المواصفات الفنية.' });
  }
}

/**
 * 11. إثبات الدفع ورفع الإيصال وإغلاق التعاقد (Step 4)
 */
export async function confirmPayment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { amount, currency, paymentType, paymentMethod, receiptUrl, receiptFilename, notes } = req.body;

    if (!amount || !receiptUrl) {
      res.status(400).json({ success: false, message: 'المبلغ المدفوع وإيصال/وصل الدفع حقول إلزامية لتأكيد إتمام التعاقد.' });
      return;
    }

    const lead = await Lead.findById(id).populate('trackId');
    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    if(lead.isBundleParent || !lead.assignedEngineerId || lead.voiceReviewStatus==='PENDING'){res.status(409).json({success:false,message:'يلزم مراجعة الطلب وإسناده قبل بدء مراحل عمل المهندس.'});return;}
    const isAssigned = hasPermission(req.user,'payments:record') && canViewLead(req.user!,lead);
    const isAdmin = isAdministrator(req.user?.role) && hasPermission(req.user,'payments:record') && canViewLead(req.user!,lead);
    if (!isAssigned && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'تسجيل الدفعة يحتاج صلاحية مالية مع السماح بعرض هذا الطلب.'
      });
      return;
    }

    // التحقق من تسلسل البزنس: لا يمكن تأكيد دفع لعميل ملغي أو لم يتم استلامه
    if (lead.status === LeadStatus.LOST) {
      res.status(400).json({
        success: false,
        message: 'لا يمكن تأكيد الدفع لعميل ملغي (Lost). يجب إعادة تفعيل العميل أولاً.'
      });
      return;
    }

    const finalizingDeposit=lead.paymentReceipt?.isReceived && lead.paymentReceipt.paymentType==='DEPOSIT' && paymentType==='FINAL';
    if(finalizingDeposit && (currency||lead.currency)!==lead.paymentReceipt!.currency){res.status(400).json({success:false,message:'الدفعة النهائية يجب أن تكون بنفس عملة العربون.'});return;}
    if (lead.paymentReceipt?.isReceived && !finalizingDeposit) {
      res.status(409).json({ success: false, message: 'تم توثيق هذه الدفعة بالفعل؛ لا يمكن استبدال الإيصال المسجل.' }); return;
    }
    if (!lead.technicalIntake?.isCompleted) {
      res.status(400).json({ success: false, message: 'يجب اعتماد المواصفات الفنية قبل توثيق الدفع.' }); return;
    }
    const now = new Date();

    // استكمال المراحل الأولية إذا لم تكن موثقة
    if (!lead.acknowledgedAt) lead.acknowledgedAt = now;
    if (!lead.contactConfirmedAt) {
      lead.contactConfirmedAt = now;
      if (!lead.firstContactedAt) lead.firstContactedAt = now;
    }

    if(finalizingDeposit)lead.paymentHistory=[...(lead.paymentHistory||[]),JSON.parse(JSON.stringify(lead.paymentReceipt))];
    lead.paymentReceipt = {
      isReceived: true,
      amount: Number(amount),
      currency: currency || lead.currency || 'USD',
      paymentType: paymentType || 'FULL',
      paymentMethod: paymentMethod || 'تحويل بنكي / إلكتروني',
      receiptUrl,
      receiptFilename: receiptFilename || 'receipt',
      receivedAt: now,
      notes: notes?.trim()
    };

    lead.currency = currency || lead.currency;
    lead.conversionValue = paymentType==='DEPOSIT'?undefined:Number(amount)+(lead.paymentHistory||[]).reduce((sum,receipt)=>sum+receipt.amount,0);
    lead.status = paymentType==='DEPOSIT'?LeadStatus.NEGOTIATION:LeadStatus.CONVERTED;

    await lead.save();
    await syncExecutionRoom(lead);
    await refreshBundleParent(lead);

    const devInfo = parseDeviceInfo(req);

    // توثيق في الخط الزمني
    await LeadActivity.create({
      leadId: lead._id,
      userId: req.user?._id,
      type: ActivityType.PAYMENT_RECEIVED,
      title: paymentType==='DEPOSIT'?'تسجيل عربون مع استمرار التنفيذ':'اكتمال تسوية مستحقات الجزء',
      content: `قام المهندس [${req.user?.name}] بتأكيد استلام دفعة بقيمة (${amount} ${currency || lead.currency || 'USD'}) عبر [${paymentMethod || 'تحويل'}] وإرفاق إيصال الدفع.`,
      ipAddress: devInfo.ipAddress,
      deviceSummary: devInfo.deviceSummary
    });

    // تسجيل رقابي مالي
    await logAudit(req, {
      action: 'PAYMENT_RECEIVED',
      actionTitle: paymentType==='DEPOSIT'?'تسجيل عربون':'اكتمال سداد المستحقات',
      entityType: 'PAYMENT',
      entityId: lead._id.toString(),
      entityCode: lead.leadCode,
      details: `تم استلام دفعة بقيمة ${amount} ${currency || lead.currency || 'USD'} عبر [${paymentMethod}]؛ حالة الطلب ${lead.status}`,
      newValues: { amount, currency, paymentMethod, paymentType }
    });

    // إشعار الأدمن والتيم ليدر
    const trackDoc: any = lead.trackId;
    if (trackDoc && trackDoc.teamLeaderId) {
      const leaderId = trackDoc.teamLeaderId._id ? trackDoc.teamLeaderId._id : trackDoc.teamLeaderId;
      await Notification.create({
        userId: leaderId,
        leadId: lead._id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: paymentType==='DEPOSIT'?`تم تسجيل عربون للعميل [${lead.customerName}]`:`اكتمل دفع مستحقات [${lead.customerName}]`,
        message: `المهندس [${req.user?.name}] أكد استلام مبلغ (${amount} ${currency || 'USD'}) ورفع إيصال الدفع في تراك [${trackDoc.name}].`
      });
    }

    sseHub.broadcast({
      type: 'LEAD_UPDATED'
    });

    const updatedLead = await Lead.findById(id)
      .populate('assignedEngineerId', 'name email phone')
      .populate('currentServiceId', 'name slug')
      .populate('trackId', 'name slug color')
      .populate('technicalIntake.completedByUserId', 'name email');

    res.json({
      success: true,
      message: paymentType==='DEPOSIT'?'تم تسجيل العربون. التنفيذ والمحادثة يظلان مفتوحين حتى تسوية الباقي.':'تم توثيق اكتمال الدفع. المحادثة تؤرشف بعد اعتماد انتهاء التنفيذ.',
      data: { lead: updatedLead }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تأكيد استلام الدفعة.' });
  }
}
