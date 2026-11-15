import { Router } from 'express';
import { getRoles, createRole, updateRole, deleteRole } from '../controllers/role.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/User.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

// مسارات الرتب والصلاحيات (للمدراء)
router.use(authenticate);

router.get('/', getRoles);
router.post('/', requirePermission('roles:manage'), validateBody(schemas.role), serializeLeadMutation(createRole));
router.put('/:id', requirePermission('roles:manage'), validateBody(schemas.role), serializeLeadMutation(updateRole));
router.delete('/:id', requirePermission('roles:manage'), serializeLeadMutation(deleteRole));

export default router;

