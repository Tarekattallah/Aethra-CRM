import { Response } from 'express';
import { SystemSettings, getSystemSettings } from '../models/SystemSettings.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { checkAndReassignStaleLeads } from '../services/sla.service.js';
import { logAudit } from '../services/audit.service.js';

export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await getSystemSettings();
    res.json({ success: true, data: { settings } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب إعدادات النظام.' });
  }
}

export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      routingMode,
      slaTimeoutMinutes,
      slaAcknowledgeMinutes,
      slaContactMinutes,
      autoReassignOnTimeout,
      skipBusyEngineers,
      duplicateCheckFields
    } = req.body;

    const settings = await getSystemSettings();

    if (routingMode) settings.routingMode = routingMode;
    if (slaTimeoutMinutes !== undefined) settings.slaTimeoutMinutes = Number(slaTimeoutMinutes);
    if (slaAcknowledgeMinutes !== undefined) settings.slaAcknowledgeMinutes = Number(slaAcknowledgeMinutes);
    if (slaContactMinutes !== undefined) settings.slaContactMinutes = Number(slaContactMinutes);
    if (autoReassignOnTimeout !== undefined) settings.autoReassignOnTimeout = Boolean(autoReassignOnTimeout);
    if (skipBusyEngineers !== undefined) settings.skipBusyEngineers = Boolean(skipBusyEngineers);
    if (duplicateCheckFields) settings.duplicateCheckFields = duplicateCheckFields;
    
    settings.updatedBy = req.user?._id;
    await settings.save();
    await logAudit(req, {action: 'SETTINGS_UPDATED', actionTitle: 'تعديل سياسة التوزيع والمهل', entityType: 'SETTINGS', entityId: settings._id.toString()});

    res.json({
      success: true,
      message: 'تم تحديث إعدادات النظام وسياسة التوزيع بنجاح.',
      data: { settings }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تحديث الإعدادات.' });
  }
}

export async function triggerSlaCheckNow(req: AuthRequest, res: Response): Promise<void> {
  try {
    const count = await checkAndReassignStaleLeads();
    res.json({
      success: true,
      message: `تم فحص العملاء المعلقين بنجاح. تم تحويل [${count}] عملاء تجاوزوا مهلة الرد.`,
      reassignedCount: count
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل فحص مهلة الرد.' });
  }
}

