import { z } from 'zod';

export const appConfigSchema = z.object({
  environment: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().int().min(1).max(65535).default(3000),
  
  security: z.object({
    corsOrigin: z.string().default('*'),
    bcryptRounds: z.number().int().default(12),
    calendarEncryptionSecret: z.string().min(32),
  }),

  auth: z.object({
    jwtAccessSecret: z.string().min(32),
    jwtRefreshSecret: z.string().min(32),
    accessTokenTtlSeconds: z.number().int().default(900), // 15 mins
    refreshTokenTtlSeconds: z.number().int().default(604800), // 7 days
    requireEmailVerification: z.boolean().default(false),
  }),

  database: z.object({
    url: z.string().url(),
    logQueries: z.boolean().default(false),
  }),

  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    prettyPrint: z.boolean().default(true),
    suppressPollingLogs: z.boolean().default(true),
  }),

  ai: z.object({
    openaiApiKey: z.string().optional(),
    geminiApiKey: z.string().optional(),
  }),

  app: z.object({
    name: z.string().default('Dental AI Receptionist'),
    appUrl: z.string().url().default('http://localhost:5173'),
    frontendUrl: z.string().url().default('http://localhost:5173'),
    backendUrl: z.string().url().default('http://localhost:3000'),
  }),

  email: z.object({
    provider: z.enum(['resend', 'smtp', 'sendgrid', 'postmark', 'mock', 'disabled']).default('resend'),
    fromName: z.string().default('Dental AI'),
    fromEmail: z.string().email(),
    formattedFrom: z.string(),
    resendApiKey: z.string().optional(),
    sendgridApiKey: z.string().optional(),
    postmarkServerToken: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.number().int().optional(),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional(),
  }),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
