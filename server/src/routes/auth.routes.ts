import { serializeLeadMutation } from '../services/mutation-queue.service.js';
import { forgotPassword } from './work.routes.js';
import { z } from 'zod';
import { Router } from 'express';
import { login, getCurrentUser } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';

const router = Router();
router.param('id', validateObjectId);
router.param('leadId', validateObjectId);

router.post('/forgot-password', validateBody(z.object({email:z.string().trim().email().max(254)})), serializeLeadMutation(forgotPassword));
router.post('/login', validateBody(schemas.login), login);
router.post('/logout', (_req, res) => { res.clearCookie('crm_session', { path: '/api', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' }); res.json({ success: true }); });
router.get('/me', authenticate, getCurrentUser);

export default router;

