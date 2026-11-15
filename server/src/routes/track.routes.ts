import { Router } from 'express';
import { getTracks, createTrack, updateTrack, deleteTrack } from '../controllers/track.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/User.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

// متاح لجميع المستخدمين المسجلين رؤية التراكات لاختيارها في النماذج
router.use(authenticate);

router.get('/', getTracks);
router.post('/', requirePermission('tracks:manage'), validateBody(schemas.track), serializeLeadMutation(createTrack));
router.put('/:id', requirePermission('tracks:manage'), validateBody(schemas.track), serializeLeadMutation(updateTrack));
router.delete('/:id', requirePermission('tracks:manage'), serializeLeadMutation(deleteTrack));

export default router;

