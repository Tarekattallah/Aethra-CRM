import { Router } from 'express';
import { getDashboardAnalytics, exportLeadsToExcel } from '../controllers/report.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/User.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

// تقارير الإدارة (للأدمن فقط)
router.get('/dashboard', authenticate, requirePermission('reports:view'), getDashboardAnalytics);
router.get('/export', authenticate, requirePermission('reports:export'), exportLeadsToExcel);

export default router;

