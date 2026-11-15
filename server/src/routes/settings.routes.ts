import { Router } from 'express';
import { getSettings, updateSettings, triggerSlaCheckNow } from '../controllers/settings.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/User.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

router.get('/', authenticate, getSettings);
router.patch('/', authenticate, requirePermission('settings:manage'), validateBody(schemas.settings), updateSettings);
router.post('/check-sla', authenticate, requirePermission('settings:manage'), triggerSlaCheckNow);

export default router;

