import { Lead, LeadStatus, AssignmentMethod } from '../models/Lead.js';
import { LeadActivity, ActivityType } from '../models/LeadActivity.js';
import { Notification, NotificationType } from '../models/Notification.js';
import { getSystemSettings } from '../models/SystemSettings.js';
import { assignLeadSmart } from './assignment.service.js';
import { acquireLeadMutation } from './mutation-queue.service.js';
import { idOf } from '../utils/access.js';
import { sseHub } from '../sse/sse.hub.js';

/**
 * فحص العملاء المعلقين وتجاوزوا مهلة الاستجابة ونقلهم آلياً للمهندس التالي الفاضي
 */
export async function checkAndReassignStaleLeads(): Promise<number> {
  const release = await acquireLeadMutation();
  try {
    const settings = await getSystemSettings();
    if (!settings.autoReassignOnTimeout) {
      return 0;
    }

    const now = new Date();

    // جلب العملاء الذين تجاوزوا مهلة تأكيد الاستلام (SLA 1) أو مهلة تأكيد التواصل (SLA 2) أو المهلة العامة
    const staleLeads = await Lead.find({
      status: { $in: [LeadStatus.NEW, LeadStatus.CONTACTED] },
      firstContactedAt: { $exists: false },
      assignedEngineerId: { $ne: null },
      $or: [
        // 1. تجاوز مهلة تأكيد استلام الطلب (افتراضياً 10 دقائق)
        { acknowledgedAt: { $exists: false }, slaAcknowledgeDeadline: { $lte: now } },
        // 2. تم الاستلام لكن تجاوز مهلة تأكيد التواصل الأولي (افتراضياً 5 دقائق)
        { acknowledgedAt: { $exists: true }, contactConfirmedAt: { $exists: false }, slaContactDeadline: { $lte: now } },
        // 3. تجاوز مهلة الـ SLA العامة إذا كانت مفعلة
        { slaTimeoutAt: { $lte: now } }
      ]
    }).populate('assignedEngineerId', 'name');

    let reassignedCount = 0;

    for (const lead of staleLeads) {
      const oldEngineerId = idOf(lead.assignedEngineerId);
      if (!oldEngineerId) continue;
      const missedAcknowledgement = !lead.acknowledgedAt;
      const missedContact = !lead.contactConfirmedAt;
      const oldEngineerName = (lead.assignedEngineerId as any)?.name || 'المهندس السابق';

      // استبعاد المهندس السابق حتى لا يرجع له العميل المعلق
      const excludeIds = [oldEngineerId!.toString()];
      if (lead.rejectedByEngineers) {
        excludeIds.push(...lead.rejectedByEngineers.map(r => r.engineerId.toString()));
      }

      // البحث عن المهندس التالي المتاح في نفس التراك
      const result = await assignLeadSmart({
        serviceCategoryId: lead.currentServiceId?.toString() || lead.initialServiceId?.toString(),
        trackId: lead.trackId?.toString(),
        excludeEngineerIds: excludeIds
      });

      if (result.engineerId && result.engineerId.toString() !== oldEngineerId!.toString()) {
        lead.assignedEngineerId = result.engineerId;
        lead.assignedAt = new Date();
        lead.isReassigned = true;
        lead.assignmentMethod = AssignmentMethod.AUTO_TIMEOUT_ESCALATION;

        // إعادة تعيين مراحل الاستلام والتواصل للمهندس الجديد
        lead.acknowledgedAt = undefined;
        lead.contactConfirmedAt = undefined;

        // منح المهندس الجديد مهلة الاستلام الجديدة (SLA 1: مثلاً 10 دقائق)
        const ackMinutes = settings.slaAcknowledgeMinutes || 10;
        const newAckDeadline = new Date();
        newAckDeadline.setMinutes(newAckDeadline.getMinutes() + ackMinutes);
        lead.slaAcknowledgeDeadline = newAckDeadline;
        lead.slaContactDeadline = undefined;

        // تجديد مهلة الرد العامة للمهندس الجديد
        const newTimeout = new Date();
        newTimeout.setMinutes(newTimeout.getMinutes() + (settings.slaTimeoutMinutes || 120));
        lead.slaTimeoutAt = newTimeout;

        await lead.save();

        // تحديد سبب التصعيد بدقة
        let reasonText = `تم تحويل العميل تلقائياً من [${oldEngineerName}] لتجاوزه مهلة الرد.`;
        if (missedAcknowledgement) {
          reasonText = `تم تحويل العميل تلقائياً من [${oldEngineerName}] لتجاوزه مهلة تأكيد استلام الطلب (${ackMinutes} دقائق).`;
        } else if (missedContact) {
          reasonText = `تم تحويل العميل تلقائياً من [${oldEngineerName}] لتجاوزه مهلة التواصل مع العميل (${settings.slaContactMinutes || 5} دقائق).`;
        }

        // توثيق في الخط الزمني
        await LeadActivity.create({
          leadId: lead._id,
          type: ActivityType.SLA_TIMEOUT_TRANSFER,
          title: 'تحويل تلقائي لتجاوز مهلة الـ SLA',
          content: reasonText
        });

        // إشعار للمهندس الجديد
        await Notification.create({
          userId: result.engineerId,
          leadId: lead._id,
          type: NotificationType.NEW_LEAD_ASSIGNED,
          title: 'تم تحويل عميل إليك لسرعة المتابعة',
          message: `تم إسناد العميل [${lead.customerName}] (${lead.leadCode}) إليك تلقائياً لسرعة التواصل.`
        });

        reassignedCount++;
        sseHub.sendToUser(result.engineerId.toString(), { type: 'LEAD_REASSIGNED', leadId: lead._id, title: 'تم تحويل عميل إليك', message: `العميل ${lead.leadCode} بحاجة للمتابعة.` });
      }
    }

    return reassignedCount;
  } finally { release(); }
}

