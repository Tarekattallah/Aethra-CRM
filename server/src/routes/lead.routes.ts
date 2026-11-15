import { Router } from 'express';
import {
  createLead,
  getLeads,
  getLeadById,
  declineLead,
  updateLeadStatus,
  reassignLead,
  updateTechnicalIntake,
  acknowledgeLead,
  confirmContact,
  confirmPayment
} from '../controllers/lead.controller.js';
import { addActivity, getLeadActivities } from '../controllers/activity.controller.js';
import { authenticate, optionalAuthenticate, requirePermission } from '../middlewares/auth.middleware.js';
import { validateAttachmentAccess } from '../services/upload.service.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';
import { UserRole } from '../models/User.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

// مسار تسجيل عميل جديد (مفتوح للعملاء والمسوقين)
router.post('/', optionalAuthenticate, validateBody(schemas.lead), validateAttachmentAccess, serializeLeadMutation(createLead));
router.post('/staff', authenticate, requirePermission('leads:create_marketing'), validateBody(schemas.lead), validateAttachmentAccess, serializeLeadMutation(createLead));

// مسارات إدارة ومتابعة العملاء (تتطلب تسجيل دخول)
router.get('/', authenticate, getLeads);
router.get('/:id', authenticate, getLeadById);
router.patch('/:id/status', authenticate, validateBody(schemas.status), serializeLeadMutation(updateLeadStatus));

// اعتذار المهندس عن العميل
router.post('/:id/decline', authenticate, validateBody(schemas.decline), serializeLeadMutation(declineLead));

// المرحلة 1: تأكيد استلام الطلب من المهندس (SLA 10 دقائق)
router.post('/:id/acknowledge', authenticate, serializeLeadMutation(acknowledgeLead));

// المرحلة 2: تأكيد أول تواصل مع العميل (SLA 5 دقائق)
router.post('/:id/confirm-contact', authenticate, serializeLeadMutation(confirmContact));

// المرحلة 3: اعتماد وتوثيق المواصفات الفنية وتفاصيل المحادثة
router.post('/:id/technical-intake', authenticate, validateBody(schemas.technical), validateAttachmentAccess, serializeLeadMutation(updateTechnicalIntake));

// المرحلة 4: تأكيد استلام الدفعة ورفع الإيصال وإغلاق الصفقة
router.post('/:id/confirm-payment', authenticate, requirePermission('payments:record'), validateBody(schemas.payment), validateAttachmentAccess, serializeLeadMutation(confirmPayment));

// إعادة تعيين العميل (للأدمن)
router.post('/:id/reassign', authenticate, requirePermission('leads:assign'), validateBody(schemas.reassign), serializeLeadMutation(reassignLead));

// سجل الأنشطة والـ Timeline
router.post('/:leadId/activities', authenticate, validateBody(schemas.activity), validateAttachmentAccess, serializeLeadMutation(addActivity));
router.get('/:leadId/activities', authenticate, getLeadActivities);

export default router;

