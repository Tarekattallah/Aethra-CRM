import { Response } from 'express';
import { Lead, LeadStatus } from '../models/Lead.js';
import { LeadActivity, ActivityType } from '../models/LeadActivity.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { parseDeviceInfo } from '../utils/device.util.js';
import { logAudit } from '../services/audit.service.js';
import { hasPermission } from '../utils/permissions.js';
import { canEditLead, canViewLead, sanitizeActivity } from '../utils/access.js';
import { UserRole, isAdministrator } from '../models/User.js';

export async function addActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { leadId } = req.params;
    const {
      type,
      title,
      content,
      callOutcome,
      nextFollowUpDate,
      attachments
    } = req.body;

    if (!type || !title) {
      res.status(400).json({ success: false, message: 'نوع النشاط وعنوانه حقول مطلوبة.' });
      return;
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      res.status(404).json({ success: false, message: 'العميل غير موجود.' });
      return;
    }

    if (!canEditLead(req.user!, lead)) { res.status(403).json({ success: false, message: 'لا تملك صلاحية تعديل هذا العميل.' }); return; }
    if ([LeadStatus.CONVERTED, LeadStatus.LOST].includes(lead.status)) { res.status(400).json({success: false, message: 'الصفقة مغلقة.'}); return; }

    // احتساب أول تواصل (First-Contact SLA) عند أول مكالمة أو رسالة واتساب
    if (!lead.firstContactedAt && ((type === ActivityType.CALL && callOutcome === 'ANSWERED') || type === ActivityType.WHATSAPP_MESSAGE || type === ActivityType.EMAIL_SENT || type === ActivityType.MEETING)) {
      lead.firstContactedAt = new Date();
      lead.responseTimeMinutes = Math.round(
        (lead.firstContactedAt.getTime() - lead.createdAt.getTime()) / (1000 * 60)
      );
      if (lead.status === LeadStatus.NEW) {
        lead.status = LeadStatus.CONTACTED;
      }
    }

    if (nextFollowUpDate) {
      lead.nextFollowUpDate = new Date(nextFollowUpDate);
    }

    await lead.save();

    const devInfo = parseDeviceInfo(req);

    const activity = await LeadActivity.create({
      leadId: lead._id,
      userId: req.user?._id,
      type,
      title,
      content,
      callOutcome,
      newStatus: lead.status,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
      attachments: attachments || [],
      ipAddress: devInfo.ipAddress,
      deviceSummary: devInfo.deviceSummary
    });
    await activity.populate('userId', 'name role');
    await lead.populate([
      {path: 'assignedEngineerId', select: 'name email phone'},
      {path: 'trackId', select: 'name slug color'},
      {path: 'currentServiceId', select: 'name slug'},
      {path: 'technicalIntake.completedByUserId', select: 'name'}
    ]);

    // تسجيل في الـ Audit Log للرقابة الإدارية
    await logAudit(req, {
      action: 'ADD_ACTIVITY',
      actionTitle: `تسجيل متابعة للعميل: ${title}`,
      entityType: 'LEAD',
      entityId: lead._id.toString(),
      entityCode: lead.leadCode,
      details: content || title
    });

    res.status(201).json({
      success: true,
      message: 'تم تسجيل النشاط بنجاح في الخط الزمني للعميل.',
      data: { activity: sanitizeActivity(activity, hasPermission(req.user,'audit:view')), lead }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تسجيل النشاط.' });
  }
}

export async function getLeadActivities(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { leadId } = req.params;
    const lead = await Lead.findById(leadId);
    if (!lead) { res.status(404).json({ success: false, message: 'العميل غير موجود.' }); return; }
    if (!canViewLead(req.user!, lead)) { res.status(403).json({success: false, message: 'لا تملك صلاحية عرض هذا العميل.'}); return; }
    const activities = await LeadActivity.find({ leadId })
      .populate('userId', 'name role email')
      .sort({ createdAt: -1 });

    const isAdmin = hasPermission(req.user,'audit:view');
    // حجب معلومات الأجهزة وعناوين الـ IP عن غير الإدارة
    const sanitized = activities.map(act => {
      const obj: any = act.toObject();
      if (!isAdmin) {
        delete obj.ipAddress;
        delete obj.deviceSummary;
      }
      return obj;
    });

    res.json({
      success: true,
      data: { activities: sanitized }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب الأنشطة.' });
  }
}

