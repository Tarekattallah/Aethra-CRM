import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { getAuditLogs, exportAuditLogsCSV } from '../controllers/audit.controller.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

// كافة مسارات الرقابة محمية بـ authenticate ويتم فحص Admin داخل الـ Controller
router.use(authenticate);

router.get('/', getAuditLogs);
router.get('/export', exportAuditLogsCSV);

export default router;

