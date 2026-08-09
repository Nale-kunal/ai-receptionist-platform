/**
 * App Config Service
 *
 * Provides a single, immutable, typed configuration object for the entire application.
 * Freezes configuration on initialization to prevent runtime mutations.
 */

import { validateEnv } from './env.validator';
import { appConfigSchema, type AppConfig } from './app-config.schema';

export class AppConfigService {
  private static instance: AppConfigService | null = null;
  public readonly config: Readonly<AppConfig>;

  private constructor() {
    const rawEnv = validateEnv();

    const isProd = rawEnv.NODE_ENV === 'production';
    const isTest = rawEnv.NODE_ENV === 'test';

    const parsedConfig: AppConfig = {
      environment: rawEnv.NODE_ENV,
      port: rawEnv.PORT,
      security: {
        corsOrigin: rawEnv.CORS_ORIGIN ?? '*',
        bcryptRounds: 12,
        calendarEncryptionSecret: rawEnv.CALENDAR_ENCRYPTION_SECRET,
      },
      auth: {
        jwtAccessSecret: rawEnv.JWT_ACCESS_SECRET,
        jwtRefreshSecret: rawEnv.JWT_REFRESH_SECRET,
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 604800,
        requireEmailVerification: isProd, // Configuration-driven: mandatory in prod
      },
      database: {
        url: rawEnv.DATABASE_URL,
        logQueries: process.env['PRISMA_LOG_QUERIES'] === 'true',
      },
      logging: {
        level: (process.env['LOG_LEVEL'] as AppConfig['logging']['level']) ?? (isTest ? 'warn' : isProd ? 'info' : 'debug'),
        prettyPrint: !isProd,
        suppressPollingLogs: true,
      },
      ai: {
        openaiApiKey: rawEnv.OPENAI_API_KEY,
        geminiApiKey: process.env['GEMINI_API_KEY'],
      },
      app: {
        name: rawEnv.APP_NAME,
        appUrl: rawEnv.APP_URL,
        frontendUrl: rawEnv.FRONTEND_URL,
        backendUrl: rawEnv.BACKEND_URL,
      },
      email: {
        provider: rawEnv.EMAIL_PROVIDER,
        fromName: rawEnv.EMAIL_FROM_NAME,
        fromEmail: rawEnv.EMAIL_FROM_EMAIL,
        formattedFrom: formatSenderAddress(rawEnv.EMAIL_FROM_NAME, rawEnv.EMAIL_FROM_EMAIL),
        resendApiKey: rawEnv.RESEND_API_KEY,
        sendgridApiKey: rawEnv.SENDGRID_API_KEY,
        postmarkServerToken: rawEnv.POSTMARK_SERVER_TOKEN,
        smtpHost: rawEnv.SMTP_HOST,
        smtpPort: rawEnv.SMTP_PORT ? parseInt(rawEnv.SMTP_PORT, 10) : undefined,
        smtpUser: rawEnv.SMTP_USER,
        smtpPass: rawEnv.SMTP_PASS,
      },
    };

    // Validate structure against Zod schema
    const validated = appConfigSchema.parse(parsedConfig);

    // Deeply freeze configuration object
    this.config = Object.freeze(JSON.parse(JSON.stringify(validated)));
  }

  public static getInstance(): AppConfigService {
    if (!AppConfigService.instance) {
      AppConfigService.instance = new AppConfigService();
    }
    return AppConfigService.instance;
  }
}

export function formatSenderAddress(name: string, email: string): string {
  if (/[\r\n]/.test(name) || /[\r\n]/.test(email)) {
    throw new Error('Header injection (CRLF) detected in sender name or email');
  }
  const cleanName = name.replace(/"/g, '\\"').trim();
  const cleanEmail = email.trim();
  return cleanName ? `"${cleanName}" <${cleanEmail}>` : cleanEmail;
}

export const appConfig = AppConfigService.getInstance().config;
