import { Router } from 'express';
import {
  streamNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead
} from '../controllers/notification.controller.js';
import { authenticate, browserSession } from '../middlewares/auth.middleware.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

// مسار البث المباشر (يتصل عبر EventSource)
router.get('/stream', browserSession, authenticate, streamNotifications);

// مسارات إدارة الإشعارات (تتطلب تسجيل دخول)
router.get('/', authenticate, getNotifications);
router.patch('/:id/read', authenticate, markAsRead);
router.patch('/read-all', authenticate, markAllAsRead);

export default router;

