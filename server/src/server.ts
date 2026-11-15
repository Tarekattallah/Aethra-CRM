import executionRoutes from './routes/execution.routes.js';
import clientBrandRoutes from './routes/client-brand.routes.js';
import workOrderRoutes from './routes/work-order.routes.js';
import { upgradePermissionCatalog } from './services/permission-catalog.service.js';
import workRoutes from './routes/work.routes.js';
import intakeManagementRoutes from './routes/intake-management.routes.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';
import './models/index.js';
import authRoutes from './routes/auth.routes.js';
import leadRoutes from './routes/lead.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import serviceRoutes from './routes/service.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import reportRoutes from './routes/report.routes.js';
import adminRoutes from './routes/admin.routes.js';
import roleRoutes from './routes/role.routes.js';
import trackRoutes from './routes/track.routes.js';
import auditRoutes from './routes/audit.routes.js';
import customerRoutes from './routes/customer.routes.js';
import { backfillCustomerProfiles } from './services/customer.service.js';
import { getJwtSecret } from './config.js';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import mongoose from 'mongoose';
import { authenticate, browserSession } from './middlewares/auth.middleware.js';
import { canDownload } from './services/upload.service.js';
import { checkAndReassignStaleLeads } from './services/sla.service.js';
import { sendStoredUpload } from './services/file-storage.service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) throw new Error('Invalid TRUST_PROXY_HOPS');
if (proxyHops) app.set('trust proxy', proxyHops);

// الحماية والـ Middlewares الأساسية
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (Object.values(req.query).some(v => typeof v !== 'string')) {
    res.status(400).json({ success: false, message: 'معاملات البحث يجب أن تكون نصوصاً مفردة.' }); return;
  }
  if (['trackId', 'serviceId', 'userId', 'customerId'].some(key => req.query[key] && !mongoose.isObjectIdOrHexString(req.query[key]))) {
    res.status(400).json({success: false, message: 'معرف الفلتر غير صالح.'}); return;
  }
  next();
});
const limiter = (limit: number) => rateLimit({ windowMs: 15 * 60000, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'طلبات كثيرة، يرجى المحاولة لاحقاً.' } });
const publicLeadLimiter = limiter(60);
app.use('/api/auth/login', limiter(30));
app.use('/api/auth/forgot-password', limiter(10));
app.use('/api/upload', limiter(60));
app.use(['/api/leads', '/api/public/leads'], (req, res, next) => req.method === 'POST' && ['/', '/staff'].includes(req.path) ? publicLeadLimiter(req, res, next) : next());

// مجلد المرفقات والملفات
app.get('/api/files/:filename', browserSession, authenticate, async (req, res, next) => {
  try {
    const filename = req.params.filename;
    if (!/^[\w-]+\.[a-z\d]+$/i.test(filename) || !await canDownload(req, filename)) {
      res.status(404).json({ success: false, message: 'الملف غير موجود أو غير متاح لك.' }); return;
    }
    await sendStoredUpload(req, res, filename);
  } catch (error) { next(error); }
});

// فحص صحة الخادم (Health Check)
app.get('/api/health', (req, res) => {
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    status: mongoose.connection.readyState === 1 ? 'online' : 'offline',
    timestamp: new Date().toISOString(),
    service: 'Aethra CRM API'
  });
});

// المسارات
app.use('/api', clientBrandRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/work', workRoutes);
app.use('/api/manage', intakeManagementRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/public', serviceRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use('/api', (_req, res) => { res.status(404).json({success: false, message: 'المسار غير موجود.'}); });
app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) { next(error); return; }
  const status = error instanceof multer.MulterError ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400) :
    ['ValidationError', 'CastError'].includes(error.name) || error.type === 'entity.parse.failed' ? 400 :
    error.code === 11000 ? 409 : error.status || 500;
  res.status(status).json({ success: false, message: status >= 500 ? 'حدث خطأ داخلي في الخادم.' :
    error instanceof multer.MulterError ? 'الملف أو عدد المرفقات يتجاوز الحدود المسموحة.' : 'تعذر تنفيذ الطلب؛ تحقق من البيانات المدخلة.' });
});

// بدء الخادم والاتصال بقاعدة البيانات
async function startServer() {
  try {
    getJwtSecret();
    await connectDB();
    await upgradePermissionCatalog();
    await backfillCustomerProfiles();
    const slaTimer = setInterval(() => {
      void checkAndReassignStaleLeads().catch(error => console.error('SLA check failed:', error));
    }, 30000);
    slaTimer.unref();
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    });
    let stopping = false;
    const shutdown = () => {
      if (stopping) return; stopping = true;
      clearInterval(slaTimer);
      server.close();
      server.closeAllConnections();
      void mongoose.disconnect().finally(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// تشغيل الخادم إن تم استدعاؤه مباشرة
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
