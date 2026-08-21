/**
 * Admin Backend — Bootstrap Entry Point
 *
 * Completely separate Express application from the main /backend.
 * Runs on ADMIN_PORT (default: 3001).
 * Uses separate JWT secrets, separate auth boundary.
 * Shares the same PostgreSQL database.
 */

import * as http from 'http';
import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import { validateAdminEnv } from './config/env.validator';
import { prisma } from './shared/prisma';
import { bootstrapSuperAdmin } from './modules/bootstrap/super-admin.bootstrap';

// Auth
import { AdminTokenService } from './modules/auth/admin-token.service';
import { AdminAuthService } from './modules/auth/admin-auth.service';
import { AdminAuthController } from './modules/auth/admin-auth.controller';
import { createAdminAuthRouter } from './modules/auth/admin-auth.routes';
import { createAdminAuthMiddleware } from './middleware/admin-authenticate';

// Controllers
import { AdminDashboardController } from './modules/dashboard/admin-dashboard.controller';
import { AdminClinicController } from './modules/clinics/admin-clinic.controller';
import { AdminWhatsAppController } from './modules/whatsapp/admin-whatsapp.controller';
import { AdminAuditController } from './modules/audit/admin-audit.controller';

async function bootstrap(): Promise<void> {
  const env = validateAdminEnv();

  // ── Verify DB connectivity ─────────────────────────────────────────────────
  await prisma.$queryRaw`SELECT 1`.catch((err: unknown) => {
    console.error('[admin-backend] FATAL: Cannot connect to database:', err);
    process.exit(1);
  });

  // ── Super Admin Bootstrap (idempotent) ────────────────────────────────────
  await bootstrapSuperAdmin();

  // ── Service Wiring ────────────────────────────────────────────────────────
  const tokenService = new AdminTokenService(
    env.ADMIN_JWT_ACCESS_SECRET,
    env.ADMIN_JWT_REFRESH_SECRET,
  );
  const authService = new AdminAuthService(prisma, tokenService);
  const authController = new AdminAuthController(authService);
  const adminAuthenticate = createAdminAuthMiddleware(tokenService, prisma);

  const dashboardController = new AdminDashboardController(prisma);
  const clinicController = new AdminClinicController(prisma);
  const whatsappController = new AdminWhatsAppController(prisma);
  const auditController = new AdminAuditController(prisma);

  // ── Express App ───────────────────────────────────────────────────────────
  const app = express();

  // Parse cookies (for HttpOnly refresh token)
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // CORS — only allow admin frontend origin
  app.use(cors({
    origin: env.CORS_ADMIN_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
  }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'private, no-cache');
    next();
  });

  // ── Health Probes (unauthenticated) ───────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'admin-backend', timestamp: new Date().toISOString() });
  });
  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', database: 'unavailable' });
    }
  });

  // ── Auth Routes (some public, some protected) ─────────────────────────────
  app.use('/api/v1/admin/auth', createAdminAuthRouter(authController, adminAuthenticate));

  // ── Protected Admin Routes ─────────────────────────────────────────────────
  app.use(adminAuthenticate); // All routes below require valid admin token

  // Dashboard
  app.get('/api/v1/admin/dashboard', dashboardController.getStats);

  // Clinics & Tenant Provisioning
  app.get('/api/v1/admin/clinics', clinicController.list);
  app.post('/api/v1/admin/tenants', clinicController.createTenant);
  app.get('/api/v1/admin/clinics/:id', clinicController.getById);
  app.patch('/api/v1/admin/clinics/:id', clinicController.update);
  app.post('/api/v1/admin/clinics/:id/suspend', clinicController.suspend);
  app.post('/api/v1/admin/clinics/:id/activate', clinicController.activate);
  app.get('/api/v1/admin/clinics/:id/users', clinicController.getUsers);
  app.get('/api/v1/admin/clinics/:id/doctors', clinicController.getDoctors);
  app.get('/api/v1/admin/clinics/:id/patients', clinicController.getPatients);
  app.get('/api/v1/admin/clinics/:id/appointments', clinicController.getAppointments);
  app.get('/api/v1/admin/clinics/:id/whatsapp', clinicController.getWhatsApp);
  app.get('/api/v1/admin/clinics/:id/conversations', clinicController.getConversations);

  // WhatsApp Management (full technical access)
  app.get('/api/v1/admin/whatsapp', whatsappController.list);
  app.get('/api/v1/admin/whatsapp/:id', whatsappController.getById);
  app.post('/api/v1/admin/whatsapp/provision', whatsappController.provision);
  app.patch('/api/v1/admin/whatsapp/:id', whatsappController.update);
  app.post('/api/v1/admin/whatsapp/:id/activate', whatsappController.activate);
  app.post('/api/v1/admin/whatsapp/:id/deactivate', whatsappController.deactivate);

  // Audit Logs
  app.get('/api/v1/admin/audit', auditController.list);

  // ── Global Error Handler ───────────────────────────────────────────────────
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
    const message = status < 500 && err instanceof Error ? err.message : 'An unexpected error occurred.';
    const code = (err as any)?.code ?? (status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR');

    if (status >= 500) console.error('[admin-backend] Unhandled error:', err);

    res.status(status).json({ success: false, error: { code, message } });
  });

  // 404
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // ── HTTP Server ───────────────────────────────────────────────────────────
  const server = http.createServer(app);
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  await new Promise<void>((resolve, reject) => {
    server.listen(env.ADMIN_PORT, () => resolve());
    server.once('error', reject);
  });

  console.log(`[admin-backend] ✅ Listening on port ${env.ADMIN_PORT} (${env.NODE_ENV})`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[admin-backend] Received ${signal}. Shutting down…`);
    server.close();
    await prisma.$disconnect();
    console.log('[admin-backend] Shutdown complete.');
    if (signal !== 'SIGUSR2') process.exit(0);
    else process.kill(process.pid, 'SIGUSR2');
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGUSR2', () => void shutdown('SIGUSR2'));
}

bootstrap().catch((err) => {
  console.error('[admin-backend] FATAL startup error:', err);
  process.exit(1);
});
