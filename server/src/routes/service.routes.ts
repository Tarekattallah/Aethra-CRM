import { Router } from 'express';
import { getActiveServices } from '../controllers/service.controller.js';
import { createLead } from '../controllers/lead.controller.js';
import { validateBody, schemas } from '../middlewares/validation.middleware.js';
import { validateAttachmentAccess } from '../services/upload.service.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';
import { phoneCountries } from '../utils/intake.util.js';

const router = Router();

router.get('/services', getActiveServices);
router.get('/countries', (_req, res) => { res.json({ success: true, data: { countries: phoneCountries } }); });
router.post('/leads', validateBody(schemas.lead), validateAttachmentAccess, serializeLeadMutation(createLead));

export default router;

