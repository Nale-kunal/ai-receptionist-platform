/**
 * Backend API Server — Production Entry Point
 *
 * Composition root: wires all modules and starts the HTTP server.
 * Implements health/readiness probes and graceful shutdown per ADR-0026.
 *
 * Port: process.env.PORT ?? 3000
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import { PrismaClient } from '@prisma/client';

// ── Authentication module ─────────────────────────────────────────────────
import { AuthService, AuthController, TokenService, SessionService } from './modules/authentication/index';
import { createAuthRouter } from './modules/authentication/routes/auth.routes';
import { createAuthenticateMiddleware } from './modules/authentication/middleware/authenticate.middleware';
import { InProcessAuthEventPublisher } from './modules/authentication/events/auth-event.publisher';
import { UserRepository } from './modules/authentication/repositories/user.repository';
import { SessionRepository } from './modules/authentication/repositories/session.repository';
import { PasswordResetTokenRepository } from './modules/authentication/repositories/password-reset-token.repository';
import { EmailVerificationTokenRepository } from './modules/authentication/repositories/email-verification-token.repository';
import type { TokenServiceConfig } from './modules/authentication/services/token.service';
import type { AuthEmailProvider } from './modules/authentication/services/auth.service';

// ── RBAC module ───────────────────────────────────────────────────────────
import {
  RoleRepository,
  PermissionRepository,
  UserRoleRepository,
  PermissionCacheService,
  PermissionEvaluatorService,
  RbacService,
  RbacController,
  rbacErrorHandler,
  createAuthorizeMiddleware,
  InProcessRbacEventPublisher,
  createRbacRouter,
} from './modules/rbac/index';

// ── Tenant module ─────────────────────────────────────────────────────────
import {
  TenantRepository,
  TenantService,
  TenantController,
  createTenantRouter,
  createTenantResolutionMiddleware,
  InProcessTenantEventPublisher,
} from './modules/tenant/index';

// ── Clinic module ─────────────────────────────────────────────────────────
import {
  ClinicRepository,
  ClinicService,
  ClinicController,
  createClinicRouter,
  InProcessClinicEventPublisher,
} from './modules/clinic/index';

// ── Doctor module ─────────────────────────────────────────────────────────
import {
  DoctorRepository,
  DoctorService,
  DoctorController,
  createDoctorRouter,
  InProcessDoctorEventPublisher,
} from './modules/doctor/index';

// ── Patient module ────────────────────────────────────────────────────────
import {
  PatientRepository,
  PatientService,
  PatientController,
  createPatientRouter,
  InProcessPatientEventPublisher,
} from './modules/patient/index';

// ── Appointment module ────────────────────────────────────────────────────
import {
  AppointmentRepository,
  AppointmentService,
  AppointmentController,
  createAppointmentRouter,
  InProcessAppointmentEventPublisher,
} from './modules/appointment/index';

// ── Configuration module ──────────────────────────────────────────────────
import {
  ConfigurationRepository,
  ConfigurationCacheService,
  ConfigurationService,
  ConfigurationController,
  createConfigurationRouter,
  InProcessConfigurationEventPublisher,
} from './modules/configuration/index';

// ── Prompt Engine module ──────────────────────────────────────────────────
import {
  PromptTemplateRepository,
  PromptAuditLogRepository,
  PromptEngineService,
  PromptEngineController,
  createPromptEngineRouter,
  PromptCacheService,
  PromptComposerService,
  PromptVariableResolverService,
  InProcessPromptEngineEventPublisher,
} from './modules/prompt-engine/index';

// ── Notification module ───────────────────────────────────────────────────
import {
  NotificationRepository,
  NotificationService,
  NotificationController,
  createNotificationRouter,
  InProcessNotificationEventPublisher,
} from './modules/notification/index';

// ── Conversation module ───────────────────────────────────────────────────
import {
  ConversationRepository,
  ConversationService,
  ConversationController,
  createConversationRouter,
  InProcessConversationEventPublisher,
} from './modules/conversation/index';

// ── Calendar module ───────────────────────────────────────────────────────
import {
  CalendarRepository,
  CalendarService,
  CalendarController,
  createCalendarRouter,
  InProcessCalendarEventPublisher,
} from './modules/calendar/index';

// =============================================================================
// Bootstrap
// =============================================================================

async function bootstrap(): Promise<void> {
  // ── Prisma ──────────────────────────────────────────────────────────────
  const prisma = new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // ── Rate limiter stubs ────────────────────────────────────────────────────
  // No-op in development; replace with express-rate-limit in production or
  // at the infrastructure layer (nginx/API gateway).
  const noopMiddleware: express.RequestHandler = (_req, _res, next) => next();
  const rateLimiter = {
    strict: () => noopMiddleware,
    moderate: () => noopMiddleware,
    refresh: () => noopMiddleware,
  };

  // ── No-op email provider stub ─────────────────────────────────────────────
  // Production: swap with a real email provider (SendGrid, Postmark, etc.)
  const emailProvider: AuthEmailProvider = {
    sendEmailVerification: async (_params) => { /* no-op */ },
    sendPasswordReset: async (_params) => { /* no-op */ },
  };

  // ── Repositories ──────────────────────────────────────────────────────────
  const userRepo = new UserRepository(prisma);
  const sessionRepo = new SessionRepository(prisma);
  const passwordResetRepo = new PasswordResetTokenRepository(prisma);
  const emailVerificationRepo = new EmailVerificationTokenRepository(prisma);
  const roleRepo = new RoleRepository(prisma);
  const permissionRepo = new PermissionRepository(prisma);
  const userRoleRepo = new UserRoleRepository(prisma);
  const tenantRepo = new TenantRepository(prisma);
  const clinicRepo = new ClinicRepository(prisma);
  const doctorRepo = new DoctorRepository(prisma);
  const patientRepo = new PatientRepository(prisma);
  const appointmentRepo = new AppointmentRepository(prisma);
  const configRepo = new ConfigurationRepository(prisma);
  const promptTemplateRepo = new PromptTemplateRepository(prisma);
  const promptAuditRepo = new PromptAuditLogRepository(prisma);
  const notificationRepo = new NotificationRepository(prisma);
  const conversationRepo = new ConversationRepository(prisma);
  const calendarRepo = new CalendarRepository(prisma);

  // ── Event Publishers & Helper Services ────────────────────────────────────
  const tenantPublisher = new InProcessTenantEventPublisher();
  const clinicPublisher = new InProcessClinicEventPublisher();
  const doctorPublisher = new InProcessDoctorEventPublisher();
  const patientPublisher = new InProcessPatientEventPublisher();
  const appointmentPublisher = new InProcessAppointmentEventPublisher();
  const configPublisher = new InProcessConfigurationEventPublisher();

  const promptCache = new PromptCacheService();
  const promptPublisher = new InProcessPromptEngineEventPublisher();
  const promptResolver = new PromptVariableResolverService();
  const promptComposer = new PromptComposerService(promptResolver);

  const notificationPublisher = new InProcessNotificationEventPublisher();
  const conversationPublisher = new InProcessConversationEventPublisher();
  const calendarPublisher = new InProcessCalendarEventPublisher();

  // ── Services ──────────────────────────────────────────────────────────────
  const tokenConfig: TokenServiceConfig = {
    jwtAccessSecret: process.env['JWT_ACCESS_SECRET'] ?? 'dev-access-secret-must-be-32-chars!!',
    jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'] ?? 'dev-refresh-secret-must-be-32-chars!',
  };

  const tokenService = new TokenService(tokenConfig);
  const sessionService = new SessionService(sessionRepo);
  const authEventPublisher = new InProcessAuthEventPublisher();

  const authService = new AuthService(
    userRepo,
    sessionRepo,
    passwordResetRepo,
    emailVerificationRepo,
    tokenService,
    sessionService,
    authEventPublisher,
    emailProvider,
  );

  const rbacEventPublisher = new InProcessRbacEventPublisher();
  const permissionCache = new PermissionCacheService();
  const permissionEvaluator = new PermissionEvaluatorService(
    userRoleRepo,
    permissionRepo,
    permissionCache,
    rbacEventPublisher,
  );
  const rbacService = new RbacService(
    roleRepo,
    permissionRepo,
    userRoleRepo,
    permissionCache,
    rbacEventPublisher,
  );

  const tenantService = new TenantService(tenantRepo, tenantPublisher);
  const clinicService = new ClinicService(clinicRepo, clinicPublisher);
  const doctorService = new DoctorService(doctorRepo, doctorPublisher);
  const patientService = new PatientService(patientRepo, patientPublisher);
  const appointmentService = new AppointmentService(appointmentRepo, appointmentPublisher);
  const configCache = new ConfigurationCacheService();
  const configService = new ConfigurationService(configRepo, configCache, configPublisher);
  const promptEngineService = new PromptEngineService(
    promptTemplateRepo,
    promptAuditRepo,
    promptCache,
    promptPublisher,
    promptComposer,
    promptResolver,
  );
  const notificationService = new NotificationService(notificationRepo, notificationPublisher);
  const conversationService = new ConversationService(conversationRepo, conversationPublisher);
  const calendarService = new CalendarService(calendarRepo, calendarPublisher, {
    calendarEncryptionSecret: process.env['CALENDAR_ENCRYPTION_SECRET'] ?? 'dev-calendar-secret-32-chars-long!',
  });

  // ── Controllers ───────────────────────────────────────────────────────────
  const authController = new AuthController(authService, tokenService);
  const rbacController = new RbacController(rbacService);
  const tenantController = new TenantController(tenantService);
  const clinicController = new ClinicController(clinicService);
  const doctorController = new DoctorController(doctorService);
  const patientController = new PatientController(patientService);
  const appointmentController = new AppointmentController(appointmentService);
  const configController = new ConfigurationController(configService);
  const promptController = new PromptEngineController(promptEngineService, promptAuditRepo);
  const notificationController = new NotificationController(notificationService);
  const conversationController = new ConversationController(conversationService);
  const calendarController = new CalendarController(calendarService);

  // ── Shared middleware ──────────────────────────────────────────────────────
  const authenticate = createAuthenticateMiddleware(tokenService, sessionService, userRepo);
  const authorize = createAuthorizeMiddleware(permissionEvaluator);
  const resolveTenant = createTenantResolutionMiddleware(tenantService);

  // ── Express app ───────────────────────────────────────────────────────────
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // Request ID injection (before all routes)
  app.use((req, _res, next) => {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    next();
  });

  // CORS — tighten CORS_ORIGIN in production via environment variable
  app.use((_req, res, next) => {
    const origin = process.env['CORS_ORIGIN'] ?? '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Request-ID');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  // ── Health / readiness probes (unauthenticated) ───────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ready', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', database: 'unavailable' });
    }
  });

  // ── Prometheus metrics endpoint ───────────────────────────────────────────
  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send([
      '# HELP process_uptime_seconds Node.js process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime().toFixed(3)}`,
      '',
      '# HELP process_heap_bytes Node.js heap usage in bytes',
      '# TYPE process_heap_bytes gauge',
      `process_heap_bytes ${process.memoryUsage().heapUsed}`,
      '',
      '# HELP nodejs_version_info Node.js version info',
      '# TYPE nodejs_version_info gauge',
      `nodejs_version_info{version="${process.version}"} 1`,
    ].join('\n'));
  });

  // ── API v1 routes ──────────────────────────────────────────────────────────
  app.use('/api/v1/auth', createAuthRouter({
    controller: authController,
    tokenService,
    sessionService,
    userRepository: userRepo,
    rateLimiter,
  }));

  app.use('/api/v1/rbac', createRbacRouter({
    controller: rbacController,
    authorize,
    authenticate,
  }));

  app.use('/api/v1/tenants', createTenantRouter({
    controller: tenantController,
    authenticate,
    authorize,
  }));

  app.use('/api/v1/clinics', createClinicRouter({
    controller: clinicController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/doctors', createDoctorRouter({
    controller: doctorController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/patients', createPatientRouter({
    controller: patientController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/appointments', createAppointmentRouter({
    controller: appointmentController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/configurations', createConfigurationRouter({
    controller: configController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/prompts', createPromptEngineRouter({
    controller: promptController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/notifications', createNotificationRouter({
    controller: notificationController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/conversations', createConversationRouter({
    controller: conversationController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/calendar', createCalendarRouter({
    controller: calendarController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  // RBAC domain error handler (must appear after all business routes)
  app.use(rbacErrorHandler);

  // Global error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
    console.error('[backend] Unhandled error:', err);
    res.status(status).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message, details: [] },
    });
  });

  // 404 catch-all
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
  });

  // ── HTTP server & graceful shutdown per ADR-0026 ───────────────────────────
  const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`[backend] Listening on port ${PORT} (${process.env['NODE_ENV'] ?? 'development'})`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[backend] Received ${signal}. Initiating graceful shutdown…`);

    server.close(async () => {
      console.log('[backend] HTTP server closed. Disconnecting Prisma…');
      await prisma.$disconnect();
      console.log('[backend] Shutdown complete.');
      process.exit(0);
    });

    // Force exit after 30 s to prevent hang
    setTimeout(() => {
      console.error('[backend] Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, 30_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[backend] Fatal startup error:', err);
  process.exit(1);
});
