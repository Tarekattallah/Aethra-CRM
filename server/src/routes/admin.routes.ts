import { Router } from 'express';
import {
  toggleEngineerStatus,
  updateDailyLimit,
  bulkReassignLeads,
  getAllUsers,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser
} from '../controllers/admin.controller.js';
import { authenticate, requirePermission, requireAnyPermission } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/User.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

router.use(authenticate);


// إدارة المهندسين القديمة
router.patch('/engineers/:id/toggle-active', requirePermission('users:manage'), serializeLeadMutation(toggleEngineerStatus));
router.patch('/engineers/:id/daily-limit', requirePermission('users:manage'), validateBody(schemas.limit), serializeLeadMutation(updateDailyLimit));
router.post('/leads/bulk-reassign', requirePermission('leads:assign'), validateBody(schemas.bulk), serializeLeadMutation(bulkReassignLeads));

// إدارة المستخدمين الشاملة (إنشاء وتعديل وتعيين الرتب والتراكات)
router.get('/users', requireAnyPermission('users:manage','leads:assign','tracks:manage','passwords:reset'), getAllUsers);
router.post('/users', requirePermission('users:manage'), validateBody(schemas.user), serializeLeadMutation(createManagedUser));
router.put('/users/:id', requirePermission('users:manage'), validateBody(schemas.user), serializeLeadMutation(updateManagedUser));
router.delete('/users/:id', requirePermission('users:manage'), serializeLeadMutation(deleteManagedUser));

export default router;

