import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { sseHub } from '../sse/sse.hub.js';
import { Notification } from '../models/Notification.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

import { getJwtSecret, jwtExpiresIn } from '../config.js';

/**
 * نقطة نهاية الـ SSE لبث الإشعارات اللحظية الحية
 */
export async function streamNotifications(req: AuthRequest, res: Response): Promise<void> {
  // يمكن تمرير التوكن عبر الـ Header أو الـ Query param لأن EventSource لا يدعم custom headers في المتصفحات القديمة
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ success: false, message: 'التوكن مطلوب للاتصال بالبث المباشر.' });
    return;
  }

  let userId: string;
  let expiresAt: number;
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { id: string; exp?: number };
    userId = req.user!._id.toString();
    expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 86400000;
  } catch (err) {
    res.status(403).json({ success: false, message: 'التوكن غير صالح.' });
    return;
  }

  // ضبط ترويسات الـ SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // لمنع الـ buffering في Nginx
  });

  sseHub.addClient(userId, res, expiresAt, req.user!.authVersion || 0);

  // إزالة العميل عند إغلاق الاتصال من المتصفح
  res.on('close', () => {
    sseHub.removeClient(res);
  });
}

/**
 * جلب قائمة الإشعارات السابقة للمستخدم
 */
export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const notifications = await Notification.find({ userId: req.user?._id })
      .populate('leadId', 'leadCode customerName phone')
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      userId: req.user?._id,
      isRead: false
    });

    res.json({
      success: true,
      data: { notifications, unreadCount }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب الإشعارات.' });
  }
}

/**
 * تعليم إشعار كمقروء
 */
export async function markAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await Notification.findOneAndUpdate(
      { _id: id, userId: req.user?._id },
      { $set: { isRead: true } }
    );
    res.json({ success: true, message: 'تم التحديث.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل التحديث.' });
  }
}

/**
 * تعليم كافة الإشعارات كمقروءة دفعة واحدة
 */
export async function markAllAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await Notification.updateMany(
      { userId: req.user?._id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, message: 'تم تعليم جميع الإشعارات كمقروءة.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل التحديث.' });
  }
}

