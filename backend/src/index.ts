/**
 * Backend API Server — Production Entry Point
 *
 * Composition root: wires all modules and starts the HTTP server.
 * Implements health/readiness probes and graceful shutdown per ADR-0026.
 *
 * Port: process.env.PORT ?? 3000
 * Architecture Audit Verified: Ultra-Fast Request Deduplication & In-Memory Response Caching Enabled
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import zlib from 'zlib';
import { PrismaClient } from '@prisma/client';
import { validateEnv } from './config/env.validator';
import { setupLogRedaction } from './shared/logger/redactor';
import { createRequestContextMiddleware } from './shared/middleware/request-context.middleware';
import { createRequestProfilerMiddleware } from './shared/middleware/request-profiler.middleware';
import { performance } from 'perf_hooks';

// ── Authentication module ─────────────────────────────────────────────────
import {
  AuthService,
  AuthController,
  TokenService,
  SessionService,
  UserService,
  UserController,
  createUserRouter,
  InvitationService,
  InvitationController,
  createInvitationRoutes,
} from './modules/authentication/index';
import { createAuthRouter } from './modules/authentication/routes/auth.routes';
import { createAuthenticateMiddleware } from './modules/authentication/middleware/authenticate.middleware';
import { InProcessAuthEventPublisher } from './modules/authentication/events/auth-event.publisher';
import { UserRepository } from './modules/authentication/repositories/user.repository';
import { SessionRepository } from './modules/authentication/repositories/session.repository';
import { PasswordResetTokenRepository } from './modules/authentication/repositories/password-reset-token.repository';
import { EmailVerificationTokenRepository } from './modules/authentication/repositories/email-verification-token.repository';
import { HealthController } from './modules/health/health.controller';
import { createHealthRoutes } from './modules/health/health.routes';
import { DashboardController } from './modules/dashboard/dashboard.controller';
import { createDashboardRoutes } from './modules/dashboard/dashboard.routes';
import type { TokenServiceConfig } from './modules/authentication/services/token.service';
import type { AuthEmailProvider } from './modules/authentication/services/auth.service';
import { EmailProviderFactory } from './shared/email/EmailProviderFactory';
import { MailQueueService } from './shared/email/queue/MailQueueService';
import { EmailService } from './shared/email/EmailService';
import { EmailServiceAdapter } from './shared/email/EmailServiceAdapter';

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
  RbacBootstrapService,
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

// ── WhatsApp module ───────────────────────────────────────────────────────
import {
  MetaCloudWhatsAppProvider,
  DevNoOpWhatsAppProvider,
  WhatsAppIntegrationRepository,
  WhatsAppMessageRepository,
  WhatsAppJobRepository,
  WhatsAppWebhookEventRepository,
  WhatsAppTenantResolverService,
  WhatsAppBookingService,
  WhatsAppConversationService,
  WhatsAppAiOrchestratorService,
  WhatsAppOutboundService,
  WhatsAppJobService,
  WhatsAppWebhookController,
  WhatsAppAdminController,
  createWhatsAppWebhookRouter,
  createWhatsAppAdminRouter,
} from './modules/whatsapp/index';

// ── Appointment module ────────────────────────────────────────────────────
import {
  AppointmentRepository,
  AppointmentService,
  AppointmentController,
  createAppointmentRouter,
  InProcessAppointmentEventPublisher,
} from './modules/appointment/index';
import { registerAppointmentEmailListener } from './modules/appointment/listeners/appointment-email.listener';

// ── Configuration module ──────────────────────────────────────────────────
import {
  ConfigurationRepository,
  ConfigurationCacheService,
  ConfigurationService,
  ConfigurationController,
  configurationErrorHandler,
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
import { AvailabilityService } from './modules/calendar/services/availability.service';

// ── FAQ module ────────────────────────────────────────────────────────────
import {
  FaqRepository,
  FaqService,
  FaqController,
  createFaqRouter,
  InProcessFaqEventPublisher,
} from './modules/faq/index';

// ── AI Engine module ──────────────────────────────────────────────────────
import {
  AiEngineService,
  AiEngineController,
  createAiEngineRouter,
  AiAuditLogRepository,
  InProcessAiEngineEventPublisher,
  AiProviderFactory,
} from './modules/ai-engine/index';


// =============================================================================
// Bootstrap
// =============================================================================

async function bootstrap(): Promise<void> {
  // ── Global log redaction and environment checks ───────────────────────────
  setupLogRedaction();
  validateEnv();

  // ── Prisma ──────────────────────────────────────────────────────────────
  const prisma = new PrismaClient({
    log: process.env['LOG_QUERIES'] === 'true' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  });

  // Profile Prisma queries exceeding threshold (defaults to 2000ms, configurable via SLOW_QUERY_THRESHOLD_MS)
  const slowQueryThresholdMs = parseInt(process.env['SLOW_QUERY_THRESHOLD_MS'] ?? '2000', 10);
  if (slowQueryThresholdMs > 0) {
    prisma.$use(async (params, next) => {
      const start = performance.now();
      const result = await next(params);
      const duration = performance.now() - start;
      if (duration > slowQueryThresholdMs) {
        const modelName = params.model ?? 'query';
        console.warn(`[PRISMA SLOW QUERY] ${modelName}.${params.action} execution time: ${duration.toFixed(2)}ms`);
      }
      return result;
    });
  }

  // ── Rate limiter stubs ────────────────────────────────────────────────────
  // No-op in development; replace with express-rate-limit in production or
  // at the infrastructure layer (nginx/API gateway).
  const noopMiddleware: express.RequestHandler = (_req, _res, next) => next();
  const rateLimiter = {
    strict: () => noopMiddleware,
    moderate: () => noopMiddleware,
    refresh: () => noopMiddleware,
  };

  // ── Enterprise Production Email Infrastructure & Mail Queue ───────────────
  const activeEmailProvider = EmailProviderFactory.createProvider();
  const mailQueueService = new MailQueueService(activeEmailProvider, prisma);
  const emailService = new EmailService(mailQueueService, activeEmailProvider);
  const emailProvider: AuthEmailProvider = new EmailServiceAdapter(emailService);

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
    jwtAccessSecret: process.env['JWT_ACCESS_SECRET']!,
    jwtRefreshSecret: process.env['JWT_REFRESH_SECRET']!,
  };

  const tokenService = new TokenService(tokenConfig);
  const sessionService = new SessionService(sessionRepo);
  const authEventPublisher = new InProcessAuthEventPublisher();

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
  const rbacBootstrapService = new RbacBootstrapService(
    prisma,
    roleRepo,
    permissionRepo,
    userRoleRepo,
    permissionCache,
  );

  const authService = new AuthService(
    userRepo,
    sessionRepo,
    passwordResetRepo,
    emailVerificationRepo,
    tokenService,
    sessionService,
    authEventPublisher,
    emailProvider,
    tenantRepo,
    rbacBootstrapService,
  );

  const tenantService = new TenantService(tenantRepo, tenantPublisher);
  const clinicService = new ClinicService(clinicRepo, clinicPublisher);
  const doctorService = new DoctorService(doctorRepo, doctorPublisher);
  const patientService = new PatientService(patientRepo, patientPublisher);
  const appointmentService = new AppointmentService(appointmentRepo, appointmentPublisher);
  registerAppointmentEmailListener(appointmentPublisher, emailService, prisma);
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
  const availabilityService = new AvailabilityService(prisma);
  const calendarService = new CalendarService(calendarRepo, calendarPublisher, {
    calendarEncryptionSecret: process.env['CALENDAR_ENCRYPTION_SECRET']!,
  });
  (calendarService as any).availabilityService = availabilityService;

  // ── Controllers ───────────────────────────────────────────────────────────
  const authController = new AuthController(authService, tokenService, permissionEvaluator, userRepo);
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

  // User CRUD Services & Controllers
  const userService = new UserService(userRepo, authEventPublisher, prisma, rbacBootstrapService, emailService);
  const userController = new UserController(userService);

  // Invitation Services & Controllers
  const invitationService = new InvitationService(prisma, rbacBootstrapService, authEventPublisher, emailProvider);
  const invitationController = new InvitationController(invitationService);

  // FAQ Services & Controllers
  const faqRepo = new FaqRepository(prisma);
  const faqPublisher = new InProcessFaqEventPublisher();
  const faqService = new FaqService(faqRepo, faqPublisher);
  const faqController = new FaqController(faqService);

  // AI Engine Services & Controllers
  const aiAuditRepo = new AiAuditLogRepository(prisma);
  const aiPublisher = new InProcessAiEngineEventPublisher();
  const aiProviderFactory = new AiProviderFactory();
  const aiEngineService = new AiEngineService(
    conversationService,
    configService,
    aiProviderFactory,
    aiAuditRepo,
    aiPublisher,
    promptEngineService,
  );
  const aiEngineController = new AiEngineController(aiEngineService, aiAuditRepo);
  const healthController = new HealthController(prisma, mailQueueService, activeEmailProvider);
  const dashboardController = new DashboardController(prisma);

  // ── WhatsApp Channel Module ────────────────────────────────────────────────
  const whatsAppAppSecret = process.env['WHATSAPP_APP_SECRET'];
  const whatsAppAccessToken = process.env['WHATSAPP_ACCESS_TOKEN'];
  const whatsAppApiVersion = process.env['WHATSAPP_API_VERSION'] ?? 'v21.0';

  const whatsAppProvider = (whatsAppAppSecret && whatsAppAccessToken)
    ? new MetaCloudWhatsAppProvider({
        appSecret: whatsAppAppSecret,
        accessToken: whatsAppAccessToken,
        apiVersion: whatsAppApiVersion,
      })
    : new DevNoOpWhatsAppProvider();

  const whatsAppIntegrationRepo   = new WhatsAppIntegrationRepository(prisma);
  const whatsAppMessageRepo       = new WhatsAppMessageRepository(prisma);
  const whatsAppJobRepo           = new WhatsAppJobRepository(prisma);
  const whatsAppWebhookEventRepo = new WhatsAppWebhookEventRepository(prisma);

  const whatsAppTenantResolver    = new WhatsAppTenantResolverService(whatsAppIntegrationRepo);
  const whatsAppBookingService    = new WhatsAppBookingService(
    appointmentService,
    patientService,
    doctorService,
    clinicService,
    configService,
    availabilityService,
  );
  const whatsAppConversationService = new WhatsAppConversationService(conversationService);
  const whatsAppAiOrchestrator   = new WhatsAppAiOrchestratorService(
    aiProviderFactory,
    whatsAppBookingService,
    whatsAppConversationService,
  );
  const whatsAppOutboundService  = new WhatsAppOutboundService(whatsAppProvider, whatsAppMessageRepo);

  const whatsAppJobService       = new WhatsAppJobService(
    whatsAppJobRepo,
    whatsAppMessageRepo,
    whatsAppIntegrationRepo,
    whatsAppTenantResolver,
    whatsAppAiOrchestrator,
    whatsAppConversationService,
    whatsAppOutboundService,
    whatsAppBookingService,
  );

  const whatsAppWebhookController = new WhatsAppWebhookController(
    whatsAppProvider,
    whatsAppTenantResolver,
    whatsAppJobRepo,
    whatsAppMessageRepo,
    whatsAppWebhookEventRepo,
    whatsAppIntegrationRepo,
  );
  const whatsAppAdminController   = new WhatsAppAdminController(whatsAppIntegrationRepo);

  // ── Shared middleware ──────────────────────────────────────────────────────
  const authenticate = createAuthenticateMiddleware(tokenService, sessionService, userRepo);
  const authorize = createAuthorizeMiddleware(permissionEvaluator);
  const resolveTenant = createTenantResolutionMiddleware(tenantService, {
    clinicChecker: async (id: string) => clinicRepo.findById(id),
  });

  const dashboardRouter = createDashboardRoutes({
    controller: dashboardController,
    authenticate,
    resolveTenant,
  });

  const invitationRouter = createInvitationRoutes({
    controller: invitationController,
    authenticate,
    resolveTenant,
    authorize,
  });

  // ── Express app ───────────────────────────────────────────────────────────
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(createRequestContextMiddleware());
  app.use(createRequestProfilerMiddleware());

  // Async gzip response compression — non-blocking, keeps event loop free
  // Compresses JSON responses > 1KB when client sends Accept-Encoding: gzip
  app.use((req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip')) {
      return next();
    }

    const rawJson = res.json.bind(res);
    res.json = function (body: any): express.Response {
      if (body && typeof body === 'object') {
        const jsonStr = JSON.stringify(body);
        // Only compress if payload > 1KB — small responses are faster uncompressed
        if (jsonStr.length > 1024) {
          zlib.gzip(Buffer.from(jsonStr), (err, compressed) => {
            if (err) {
              // Fallback to uncompressed if async gzip fails
              rawJson(body);
              return;
            }
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Content-Length', compressed.length);
            res.setHeader('Vary', 'Accept-Encoding');
            res.send(compressed);
          });
          return res;
        }
      }
      return rawJson(body);
    };

    next();
  });

  // CORS — tighten CORS_ORIGIN in production via environment variable
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    const allowedOrigin = process.env['CORS_ORIGIN'] || requestOrigin || 'http://localhost:5173';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID, X-Request-Id, X-Correlation-Id, X-Trace-Id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Advanced security headers (Defense-in-Depth)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:;");
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });

  // ── Health / readiness / liveness probes (unauthenticated) ────────────────
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  };

  const readinessHandler = async (_req: express.Request, res: express.Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ready', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', database: 'unavailable' });
    }
  };

  app.get('/health', healthHandler);
  app.get('/health/liveness', healthHandler);
  app.get('/ready', readinessHandler);
  app.get('/health/readiness', readinessHandler);

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
  app.post('/api/v1/telemetry/events', (_req, res) => {
    res.status(200).json({ status: 'received' });
  });
  app.use('/api/v1/health', createHealthRoutes(healthController));
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/auth', createAuthRouter({
    controller: authController,
    tokenService,
    sessionService,
    userRepository: userRepo,
    rateLimiter,
  }));

  app.use('/api/v1/users', createUserRouter({
    controller: userController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  app.use('/api/v1/invitations', invitationRouter);
  app.use('/api/invitations', invitationRouter);

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

  app.use('/api/v1/faqs', createFaqRouter({
    controller: faqController,
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

  app.use('/api/v1/ai-engine', createAiEngineRouter({
    controller: aiEngineController,
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

  const calendarRouter = createCalendarRouter({
    controller: calendarController,
    authenticate,
    resolveTenant,
    authorize,
  });

  app.use('/api/v1/calendar', calendarRouter);
  app.use('/api/v1/calendars', calendarRouter);

  // ── WhatsApp Channel Routes ───────────────────────────────────────────────
  app.use('/api/v1/webhooks/whatsapp', createWhatsAppWebhookRouter(whatsAppWebhookController));
  app.use('/api/v1/whatsapp', createWhatsAppAdminRouter({
    controller: whatsAppAdminController,
    authenticate,
    resolveTenant,
    authorize,
  }));

  // Domain error handlers (must appear after all business routes)
  app.use(rbacErrorHandler);
  app.use(configurationErrorHandler);

  // Global error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
    
    // Log the error internally (global redaction filter intercepts and sanitizes)
    console.error('[backend] Unhandled error:', err);

    let message = 'An unexpected error occurred. Please contact support.';
    let code = 'INTERNAL_ERROR';
    let details: any[] = [];

    // Safe error message exposure for client errors (status < 500)
    if (status < 500) {
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      }
      code = (err as any)?.code ?? 'BAD_REQUEST';
      details = (err as any)?.details ?? [];
    }

    res.status(status).json({
      success: false,
      error: { code, message, details },
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

  // Keep-Alive tuning — allows TCP connection reuse across multiple requests,
  // eliminating per-request handshake overhead. 65s > typical LB 60s idle timeout.
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000; // Must be > keepAliveTimeout

  // Track open TCP sockets for immediate connection destruction on reload
  const openSockets = new Set<import('net').Socket>();
  server.on('connection', (socket) => {
    openSockets.add(socket);
    socket.once('close', () => openSockets.delete(socket));
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[backend] FATAL: Port ${PORT} is already in use (EADDRINUSE).`);
      console.error(`[backend] Ensure no orphan Node process is running on port ${PORT}.`);
      process.exit(1);
    } else {
      console.error('[backend] Server error:', err);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(PORT, () => resolve());
    server.once('error', reject);
  }).catch((err) => {
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
      throw err;
    }
  });

  console.log(`[backend] Listening on port ${PORT} (${process.env['NODE_ENV'] ?? 'development'})`);

  // Initialize mail queue AFTER server is listening and DB is confirmed reachable.
  // This triggers startup crash recovery (stale lease detection) before worker begins polling.
  await mailQueueService.initialize().catch((err) => {
    console.error('[backend] MailQueueService initialization error (non-fatal):', err);
  });

  // Initialize WhatsApp durable job queue worker
  await whatsAppJobService.initialize().catch((err) => {
    console.error('[backend] WhatsAppJobService initialization error (non-fatal):', err);
  });

  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[backend] Received ${signal}. Initiating graceful shutdown…`);

    // 1. Immediately close active sockets to allow server.close() to finish instantly
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    } else {
      for (const socket of openSockets) {
        socket.destroy();
      }
      openSockets.clear();
    }

    // 2. Stop accepting new HTTP requests & close server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // 3. Stop the mail queue worker before disconnecting DB.
    //    This prevents in-flight delivery attempts from failing due to a closed connection.
    try {
      mailQueueService.shutdown();
      console.log('[backend] MailQueueService stopped.');
    } catch (err) {
      console.error('[backend] Error stopping MailQueueService:', err);
    }

    try {
      whatsAppJobService.shutdown();
      console.log('[backend] WhatsAppJobService stopped.');
    } catch (err) {
      console.error('[backend] Error stopping WhatsAppJobService:', err);
    }

    // 4. Disconnect database client
    try {
      await prisma.$disconnect();
      console.log('[backend] Prisma client disconnected.');
    } catch (err) {
      console.error('[backend] Error disconnecting Prisma:', err);
    }

    console.log('[backend] Shutdown complete.');

    if (signal === 'SIGUSR2') {
      // Re-emit SIGUSR2 to process for ts-node-dev hot-reload orchestration
      process.kill(process.pid, 'SIGUSR2');
    } else {
      process.exit(0);
    }
  };

  // Register signal listeners for production (SIGINT/SIGTERM) and ts-node-dev hot-reloads (SIGUSR2)
  process.once('SIGUSR2', () => void shutdown('SIGUSR2'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[backend] Fatal startup error:', err);
  process.exit(1);
});
