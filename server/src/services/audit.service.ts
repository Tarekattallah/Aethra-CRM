import { Request } from 'express';
import { AuditLog, IAuditLog } from '../models/AuditLog.js';
import { parseDeviceInfo } from '../utils/device.util.js';

export interface CreateAuditOptions {
  action: string;
  actionTitle: string;
  entityType: 'LEAD' | 'USER' | 'AUTH' | 'ROUTING' | 'SETTINGS' | 'PAYMENT' | 'SERVICE';
  entityId?: string;
  entityCode?: string;
  details?: string;
  oldValues?: any;
  newValues?: any;
  userId?: any;
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export async function logAudit(req: Request | null, options: CreateAuditOptions): Promise<IAuditLog | null> {
  try {
    const user = (req as any)?.user;
    const deviceInfo = req ? parseDeviceInfo(req) : null;

    const audit = new AuditLog({
      userId: options.userId || user?._id || user?.id,
      userName: options.userName || user?.name || 'النظام السحابي',
      userEmail: options.userEmail || user?.email,
      userRole: options.userRole || user?.role || (options.userId ? undefined : 'SYSTEM'),
      action: options.action,
      actionTitle: options.actionTitle,
      entityType: options.entityType,
      entityId: options.entityId,
      entityCode: options.entityCode,
      details: options.details,
      oldValues: options.oldValues,
      newValues: options.newValues,
      ipAddress: deviceInfo?.ipAddress || '127.0.0.1',
      userAgent: deviceInfo?.userAgent,
      deviceType: deviceInfo?.deviceType || 'UNKNOWN',
      deviceTypeAr: deviceInfo?.deviceTypeAr || 'نظام آلي',
      os: deviceInfo?.os,
      browser: deviceInfo?.browser,
      deviceSummary: deviceInfo?.deviceSummary || '⚙️ خادم النظام الآلي'
    });

    await audit.save();
    return audit;
  } catch (err) {
    console.error('Failed to create audit log:', err);
    return null;
  }
}
