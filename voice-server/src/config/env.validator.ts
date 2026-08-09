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
const weakSecretRegex = /mock|placeholder|default|xxxx|temp/i;

const twilioSidSchema = z.string()
  .length(34, { message: "Twilio Account SID must be exactly 34 characters long" })
  .startsWith('AC', { message: "Twilio Account SID must start with 'AC'" })
  .refine(val => {
    const isProd = process.env['NODE_ENV'] === 'production';
    if (isProd && val === 'ACmockaccountxxxxxxxxxxxxxxxxxxxx') {
      return false;
    }
    return true;
  }, {
    message: "Production Twilio Account SID cannot use the default mock placeholder"
  });

const twilioTokenSchema = z.string()
  .min(32, { message: "Twilio Auth Token must be at least 32 characters long" })
  .refine(val => {
    const isProd = process.env['NODE_ENV'] === 'production';
    if (isProd && val === 'mockauthtokenxxxxxxxxxxxxxxxxxxx') {
      return false;
    }
    return true;
  }, {
    message: "Production Twilio Auth Token cannot use the default mock placeholder"
  });

const voiceEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : 5000),
    z.number().int().min(1).max(65535)
  ),
  TWILIO_ACCOUNT_SID: twilioSidSchema,
  TWILIO_AUTH_TOKEN: twilioTokenSchema,
  TWILIO_MEDIA_STREAM_URL: z.string().url().refine(val => {
    if (process.env['NODE_ENV'] === 'production') {
      return val.startsWith('wss://');
    }
    return val.startsWith('ws://') || val.startsWith('wss://');
  }, { message: "Twilio Media Stream URL must use ws:// or wss://" }),
  TWILIO_WEBHOOK_URL: z.string().url().refine(val => {
    if (process.env['NODE_ENV'] === 'production') {
      return val.startsWith('https://');
    }
    return val.startsWith('http://') || val.startsWith('https://');
  }, { message: "Twilio Webhook URL must use http:// or https://" }).optional(),
});

export type ValidatedVoiceEnv = z.infer<typeof voiceEnvSchema>;

export function validateEnv(): ValidatedVoiceEnv {
  if (process.env['NODE_ENV'] === 'test') {
    // Return a mocked representation for test suites
    return {
      NODE_ENV: 'test',
      PORT: 5000,
      TWILIO_ACCOUNT_SID: 'ACmockaccountxxxxxxxxxxxxxxxxxxxx',
      TWILIO_AUTH_TOKEN: 'mockauthtokenxxxxxxxxxxxxxxxxxxx',
      TWILIO_MEDIA_STREAM_URL: 'wss://localhost/voice-stream',
      TWILIO_WEBHOOK_URL: 'https://localhost/webhooks/voice',
    };
  }

  const result = voiceEnvSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.format();
    console.error('❌ FATAL: Voice Server Environment variable validation failed at startup!');
    for (const [key, val] of Object.entries(formattedErrors)) {
      if (key === '_errors') continue;
      const fieldErrors = (val as any)._errors?.join(', ');
      console.error(`  - ${key}: ${fieldErrors}`);
    }
    process.exit(1);
  }

  return result.data;
}
