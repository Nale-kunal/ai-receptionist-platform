import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ── Dependency-Free Env File Loader ─────────────────────────────────────────
function loadEnvFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index > 0) {
          const key = trimmed.substring(0, index).trim();
          let val = trimmed.substring(index + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {
      // Ignore reading issues, rely on validation to fail if variables are missing
    }
  }
}

export function tryLoadEnv(): void {
  const env = process.env['NODE_ENV'] || 'development';
  const envFile = env === 'production' ? '.env' : '.env.development';
  
  // Try various path resolutions for safety
  const pathsToTry = [
    path.join(process.cwd(), envFile),
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '..', envFile),
    path.join(__dirname, '..', '..', '.env'),
    path.join(__dirname, '..', '..', '..', envFile),
    path.join(__dirname, '..', '..', '..', '.env'),
  ];

  for (const p of pathsToTry) {
    loadEnvFile(p);
  }
}

// Load env files before validation runs
tryLoadEnv();

// ── Zod Validation Schemas ──────────────────────────────────────────────────
const prodWeakSecretRegex = /mock|placeholder|default|xxxx|temp|development|secret|password|changeme|example|123456|admin/i;
const devWeakSecretRegex = /mock|placeholder|default|xxxx|temp/i;

const secretSchema = z.string({
  required_error: "Required secret environment variable is missing",
})
.min(32, { message: "Secret must be at least 32 characters long" })
.refine(val => {
  const isProd = process.env['NODE_ENV'] === 'production';
  const regex = isProd ? prodWeakSecretRegex : devWeakSecretRegex;
  return !regex.test(val);
}, {
  message: "Weak, default, dev, or placeholder secrets are not allowed for production security"
});

const backendEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : 3000),
    z.number().int().min(1).max(65535)
  ),
  DATABASE_URL: z.string().url().refine(val => {
    try {
      const parsed = new URL(val);
      if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
        return false;
      }
      if (!parsed.hostname || parsed.hostname.trim() === '') {
        return false;
      }
    } catch {
      return false;
    }
    const isProd = process.env['NODE_ENV'] === 'production';
    if (isProd && val.includes('receptionist_secret_password')) {
      return false;
    }
    return true;
  }, {
    message: "DATABASE_URL must be a valid PostgreSQL connection URL with protocol postgresql:// or postgres://"
  }),
  DIRECT_URL: z.string().url().optional().refine(val => {
    if (!val) return true;
    try {
      const parsed = new URL(val);
      return (parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:') && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }, {
    message: "DIRECT_URL must be a valid PostgreSQL connection URL"
  }),
  JWT_ACCESS_SECRET: secretSchema,
  JWT_REFRESH_SECRET: secretSchema,
  CALENDAR_ENCRYPTION_SECRET: secretSchema,
  CORS_ORIGIN: z.string().default('*'),
  OPENAI_API_KEY: z.string().min(20).refine(val => {
    const isProd = process.env['NODE_ENV'] === 'production';
    if (isProd) {
      // Must start with sk- and not be a mock placeholder
      return val.startsWith('sk-') && !val.includes('mock');
    }
    return true;
  }, {
    message: "Production OpenAI API key must start with 'sk-' and cannot be a mock placeholder"
  }),
  // ── Email Infrastructure Configuration ─────────────────────────────────────
  EMAIL_PROVIDER: z.enum(['resend', 'smtp', 'sendgrid', 'postmark', 'mock', 'disabled']).default('resend'),
  EMAIL_FROM_NAME: z
    .string()
    .min(1, 'EMAIL_FROM_NAME cannot be empty')
    .refine((val) => !/[\r\n]/.test(val), 'Header injection (CRLF) detected in EMAIL_FROM_NAME')
    .default('Dental AI'),
  EMAIL_FROM_EMAIL: z
    .string()
    .email('EMAIL_FROM_EMAIL must be a valid email address')
    .refine((val) => !/[\r\n]/.test(val), 'Header injection (CRLF) detected in EMAIL_FROM_EMAIL')
    .default('onboarding@resend.dev'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  POSTMARK_SERVER_TOKEN: z.string().optional(),

  // ── App & Frontend Branding URLs ─────────────────────────────────────────
  APP_NAME: z.string().min(1).default('Dental AI Receptionist'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  BACKEND_URL: z.string().url().default('http://localhost:3000'),

  // ── WhatsApp Cloud API (Meta) ────────────────────────────────────────────
  // WHATSAPP_APP_SECRET: used for X-Hub-Signature-256 verification (HMAC-SHA256)
  //   Required in production; optional in development (mock mode skips verification)
  WHATSAPP_APP_SECRET: z.string().optional(),
  // WHATSAPP_ACCESS_TOKEN: Meta system user permanent access token
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  // WHATSAPP_WEBHOOK_VERIFY_TOKEN: Platform Meta Webhook GET verification token
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(8).optional(),
  // WHATSAPP_API_VERSION: Meta Graph API version, e.g. 'v21.0'
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
});

export type ValidatedBackendEnv = z.infer<typeof backendEnvSchema>;

export function validateEnv(): ValidatedBackendEnv {
  if (process.env['NODE_ENV'] === 'test') {
    // Return a mocked representation for test suites so they won't fail because of mock envs
    return {
      NODE_ENV: 'test',
      PORT: 3000,
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/db',
      DIRECT_URL: 'postgresql://postgres:pass@localhost:5432/db',
      JWT_ACCESS_SECRET: 'test-secret-access-token-must-be-long-enough',
      JWT_REFRESH_SECRET: 'test-secret-refresh-token-must-be-long-enough',
      CALENDAR_ENCRYPTION_SECRET: 'test-secret-calendar-token-must-be-long',
      CORS_ORIGIN: '*',
      OPENAI_API_KEY: 'sk-testmockopenaiapi',
      EMAIL_PROVIDER: 'mock',
      EMAIL_FROM_NAME: 'Dental AI',
      EMAIL_FROM_EMAIL: 'onboarding@resend.dev',
      APP_NAME: 'Dental AI Receptionist',
      APP_URL: 'http://localhost:5173',
      FRONTEND_URL: 'http://localhost:5173',
      BACKEND_URL: 'http://localhost:3000',
      WHATSAPP_API_VERSION: 'v21.0',
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test_verify_token_12345',
    };
  }

  const result = backendEnvSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.format();
    console.error('❌ FATAL: Environment variable validation failed at startup!');
    for (const [key, val] of Object.entries(formattedErrors)) {
      if (key === '_errors') continue;
      const fieldErrors = (val as any)._errors?.join(', ');
      console.error(`  - ${key}: ${fieldErrors}`);
    }
    process.exit(1);
  }

  // Production Strict Security Validation
  if (result.data.NODE_ENV === 'production') {
    if (result.data.EMAIL_PROVIDER === 'mock') {
      console.error('❌ FATAL: EMAIL_PROVIDER cannot be set to "mock" in production mode!');
      process.exit(1);
    }
    if (result.data.EMAIL_PROVIDER !== 'disabled') {
      if (result.data.EMAIL_FROM_EMAIL === 'onboarding@resend.dev' || result.data.EMAIL_FROM_EMAIL.endsWith('@resend.dev')) {
        console.error('❌ FATAL: Resend onboarding domain (onboarding@resend.dev) is prohibited in production!');
        console.error('   Please set EMAIL_FROM_EMAIL to a verified custom domain address (e.g. no-reply@yourdomain.com).');
        process.exit(1);
      }
      if (result.data.EMAIL_FROM_EMAIL.includes('localhost')) {
        console.error('❌ FATAL: EMAIL_FROM_EMAIL cannot be a localhost address in production!');
        process.exit(1);
      }
    }
    if (result.data.EMAIL_PROVIDER === 'resend' && !result.data.RESEND_API_KEY) {
      console.error('❌ FATAL: RESEND_API_KEY environment variable is required in production when EMAIL_PROVIDER=resend!');
      process.exit(1);
    }
    if (!result.data.WHATSAPP_ACCESS_TOKEN) {
      console.error('❌ FATAL: WHATSAPP_ACCESS_TOKEN is required in production mode!');
      process.exit(1);
    }
    if (!result.data.WHATSAPP_APP_SECRET) {
      console.error('❌ FATAL: WHATSAPP_APP_SECRET is required in production mode!');
      process.exit(1);
    }
    if (!result.data.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      console.error('❌ FATAL: WHATSAPP_WEBHOOK_VERIFY_TOKEN is required in production mode!');
      process.exit(1);
    }
  }

  return result.data;
}
