/**
 * Admin Backend — Environment Validator
 *
 * Validates all required environment variables at startup.
 * Exits with code 1 if any required variable is missing or invalid.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

// ── Env File Loader ──────────────────────────────────────────────────────────
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        let val = trimmed.substring(index + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // Ignore — env validation will catch missing vars
  }
}

export function tryLoadEnv(): void {
  const env = process.env['NODE_ENV'] || 'development';
  const envFile = env === 'production' ? '.env' : '.env.development';
  const cwd = process.cwd();
  const dir = path.resolve(__dirname, '..', '..');

  for (const p of [
    path.join(cwd, envFile),
    path.join(cwd, '.env'),
    path.join(dir, envFile),
    path.join(dir, '.env'),
  ]) {
    loadEnvFile(p);
  }
}

tryLoadEnv();

// ── Schema ───────────────────────────────────────────────────────────────────
const secretSchema = z
  .string({ required_error: 'Required admin secret is missing' })
  .min(32, 'Admin secrets must be at least 32 characters');

const adminEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ADMIN_PORT: z.preprocess(
    (v) => (v ? parseInt(v as string, 10) : 3001),
    z.number().int().min(1).max(65535)
  ),
  DATABASE_URL: z.string().url().refine(val => {
    try {
      const parsed = new URL(val);
      return (parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:') && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }, {
    message: "DATABASE_URL must be a valid PostgreSQL connection URL"
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
  ADMIN_JWT_ACCESS_SECRET: secretSchema,
  ADMIN_JWT_REFRESH_SECRET: secretSchema,
  CORS_ADMIN_ORIGIN: z.string().default('http://localhost:5174'),
  SUPER_ADMIN_INITIAL_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_INITIAL_PASSWORD: z.string().min(12).optional(),
  SUPER_ADMIN_INITIAL_DISPLAY_NAME: z.string().min(1).default('Platform Admin'),
  // ── WhatsApp Technical Validation & Subscription ──────────────────────────
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

export function validateAdminEnv(): AdminEnv {
  if (process.env['NODE_ENV'] === 'test') {
    return {
      NODE_ENV: 'test',
      ADMIN_PORT: 3001,
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/db',
      DIRECT_URL: 'postgresql://postgres:pass@localhost:5432/db',
      ADMIN_JWT_ACCESS_SECRET: 'test-admin-access-secret-must-be-long-enough',
      ADMIN_JWT_REFRESH_SECRET: 'test-admin-refresh-secret-must-be-long-enough',
      CORS_ADMIN_ORIGIN: '*',
      SUPER_ADMIN_INITIAL_DISPLAY_NAME: 'Platform Admin',
      WHATSAPP_API_VERSION: 'v21.0',
    };
  }

  const result = adminEnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error('❌ FATAL: Admin backend environment validation failed!');
    for (const [key, val] of Object.entries(formatted)) {
      if (key === '_errors') continue;
      const errs = (val as any)._errors?.join(', ');
      console.error(`  - ${key}: ${errs}`);
    }
    process.exit(1);
  }

  // Production extra checks
  if (result.data.NODE_ENV === 'production') {
    if (!result.data.SUPER_ADMIN_INITIAL_EMAIL) {
      console.error('❌ FATAL: SUPER_ADMIN_INITIAL_EMAIL is required in production for bootstrap!');
      process.exit(1);
    }
    if (!result.data.SUPER_ADMIN_INITIAL_PASSWORD) {
      console.error('❌ FATAL: SUPER_ADMIN_INITIAL_PASSWORD is required in production for bootstrap!');
      process.exit(1);
    }
  }

  return result.data;
}
