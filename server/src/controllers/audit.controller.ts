import { leadScope,isTrackBound } from '../utils/access.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
async function auditScope(req:AuthRequest){if(!isTrackBound(req.user!))return {};const [leads,users]=await Promise.all([Lead.find(leadScope(req.user!)).distinct('_id'),User.find({trackId:req.user!.trackId}).distinct('_id')]);return {$or:[{entityId:{$in:leads.map(String)}},{userId:{$in:users}}]};}
import { hasPermission } from '../utils/permissions.js';
import { Response } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { escapeRegex, positiveInteger, csvCell } from '../utils/input.js';
import { UserRole, isAdministrator } from '../models/User.js';

/**
 * جلب سجلات الرقابة والتدقيق (خاص بمدير النظام Admin فقط)
 */
export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    // التحقق الأمني الصارم: مدير النظام فقط
    if (!hasPermission(req.user,'audit:view')) {
      res.status(403).json({
        success: false,
        message: 'غير مصرح لك. سجلات الرقابة وتتبع الأجهزة (Audit Logs) متاحة لمدير النظام فقط.'
      });
      return;
    }

    const { 
      page = '1', 
      limit = '50', 
      entityType, 
      action, 
      userId, 
      search 
    } = req.query as Record<string, string>;

    const boundary=await auditScope(req);
    const query: any = req.user?.role === UserRole.SUPER_ADMIN ? {} : {userRole: {$ne: UserRole.SUPER_ADMIN}, action: {$ne:'SUPER_ADMIN_BOOTSTRAPPED'}};

    if (entityType && entityType !== 'ALL') {
      query.entityType = entityType;
    }

    if (action && action !== 'ALL') {
      query.$and = [{action}, ...(req.user?.role === UserRole.SUPER_ADMIN ? [] : [{action:{$ne:'SUPER_ADMIN_BOOTSTRAPPED'}}])];
    }

    if (userId) {
      query.userId = userId;
    }

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim().slice(0, 200)), 'i');
      query.$or = [
        { userName: regex },
        { userEmail: regex },
        { actionTitle: regex },
        { action: regex },
        { details: regex },
        { entityCode: regex },
        { ipAddress: regex },
        { deviceSummary: regex },
        { os: regex },
        { browser: regex }
      ];
    }

    query.$and=[...(query.$and||[]),boundary];
    const pageNum = positiveInteger(page, 1, 1000000);
    const limitNum = positiveInteger(limit, 50);
    const skip = (pageNum - 1) * limitNum;

    let [logs, total, desktopCount, mobileCount, tabletCount] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query),
      AuditLog.countDocuments({ ...query, deviceType: 'DESKTOP' }),
      AuditLog.countDocuments({ ...query, deviceType: 'MOBILE' }),
      AuditLog.countDocuments({ ...query, deviceType: 'TABLET' })
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        stats: {
          desktopCount,
          mobileCount,
          tabletCount,
          totalAll: desktopCount + mobileCount + tabletCount
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'فشل جلب سجلات الرقابة والتدقيق.'
    });
  }
}

/**
 * تصدير سجلات الرقابة وتتبع الأجهزة بتنسيق CSV (للأدمن فقط)
 */
export async function exportAuditLogsCSV(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!hasPermission(req.user,'audit:view')) {
      res.status(403).json({ success: false, message: 'متاح للإدارة فقط.' });
      return;
    }

    const logs = await AuditLog.find({$and:[await auditScope(req),req.user?.role === UserRole.SUPER_ADMIN ? {} : {userRole:{$ne:UserRole.SUPER_ADMIN},action:{$ne:'SUPER_ADMIN_BOOTSTRAPPED'}}]}).sort({ createdAt: -1 }).limit(1000).lean();

    const headers = [
      'التاريخ والوقت',
      'المستخدم',
      'البريد الإلكتروني',
      'الرتبة',
      'نوع الإجراء',
      'عنوان العملية',
      'الكيان المرتبط',
      'كود الكيان',
      'نوع الجهاز',
      'ملخص الجهاز',
      'عنوان الـ IP',
      'نظام التشغيل',
      'المتصفح',
      'التفاصيل'
    ];

    const rows = logs.map(l => [
      new Date(l.createdAt).toLocaleString('ar-EG'), l.userName, l.userEmail, l.userRole, l.action, l.actionTitle,
      l.entityType, l.entityCode, l.deviceTypeAr || l.deviceType, l.deviceSummary, l.ipAddress, l.os, l.browser, l.details
    ].map(csvCell));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=aethra_audit_logs_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تصدير سجل الرقابة.' });
  }
}
