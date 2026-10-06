/**
 * Environment Validator — Production Security Unit Tests
 *
 * Verifies strict validation rules:
 * 1. Missing secret rejection in production mode
 * 2. Rejection of weak / placeholder / dev secrets in production
 * 3. Secret length enforcement (min 32 chars)
 * 4. Production Resend domain restrictions (onboarding@resend.dev prohibited)
 * 5. Production mock email provider rejection
 * 6. OpenAI key production format validation
 * 7. Acceptance of cryptographically strong production secrets
 */

import { validateEnv } from '../env.validator';

describe('Environment Validator - Production Security Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function getValidProdEnv() {
    return {
      NODE_ENV: 'production',
      PORT: '3000',
      DATABASE_URL: 'postgresql://prod_user:aK9%23mP9%24vL2@prod-db.example.com:5432/receptionist?sslmode=require',
      JWT_ACCESS_SECRET: 'c8f93a10b42e7d6152839401abef49c18273645091a2b3c4d5e6f7a8b9c0d1e2',
      JWT_REFRESH_SECRET: 'd9e87f6a5b4c3d2e1f0987654321fedcba9876543210abcdef9876543210abcd',
      CALENDAR_ENCRYPTION_SECRET: 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2',
      OPENAI_API_KEY: 'sk-proj-prod123456789012345678901234567890',
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM_NAME: 'Dental AI Receptionist',
      EMAIL_FROM_EMAIL: 'no-reply@clinicdomain.com',
      RESEND_API_KEY: 're_1234567890abcdef1234567890',
      CORS_ORIGIN: 'https://dental-ai-frontend.vercel.app',
      APP_NAME: 'Dental AI Receptionist',
      APP_URL: 'https://dental-ai-frontend.vercel.app',
      FRONTEND_URL: 'https://dental-ai-frontend.vercel.app',
      BACKEND_URL: 'https://dental-ai-backend-gy1y.onrender.com',
      WHATSAPP_ACCESS_TOKEN: 'EAAB_test_mock_token_for_validation_testing_12345',
      WHATSAPP_APP_SECRET: '0123456789abcdef0123456789abcdef',
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test_verify_token_123456789',
      WHATSAPP_API_VERSION: 'v21.0',
    };
  }

  it('should pass validation with complete, strong production configuration', () => {
    process.env = getValidProdEnv() as any;
    const config = validateEnv();
    expect(config.NODE_ENV).toBe('production');
    expect(config.JWT_ACCESS_SECRET).toBe('c8f93a10b42e7d6152839401abef49c18273645091a2b3c4d5e6f7a8b9c0d1e2');
  });

  it('should fail when JWT_ACCESS_SECRET is missing', () => {
    const env = getValidProdEnv();
    delete (env as any).JWT_ACCESS_SECRET;
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');
    expect(mockConsole).toHaveBeenCalledWith(expect.stringContaining('FATAL'));

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should fail when JWT_ACCESS_SECRET is shorter than 32 characters', () => {
    const env = getValidProdEnv();
    env.JWT_ACCESS_SECRET = 'short_secret_12345';
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should fail in production when JWT_ACCESS_SECRET uses a weak/development word like "development"', () => {
    const env = getValidProdEnv();
    env.JWT_ACCESS_SECRET = 'development_access_secret_32_characters';
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should fail in production when JWT_ACCESS_SECRET contains "secret" or "password"', () => {
    const env = getValidProdEnv();
    env.JWT_ACCESS_SECRET = 'super_secret_password_for_prod_123456789';
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should pass in production when EMAIL_PROVIDER is set to "disabled"', () => {
    const env = getValidProdEnv();
    env.EMAIL_PROVIDER = 'disabled';
    delete (env as any).RESEND_API_KEY;
    process.env = env as any;

    const config = validateEnv();
    expect(config.NODE_ENV).toBe('production');
    expect(config.EMAIL_PROVIDER).toBe('disabled');
  });

  it('should pass in production when EMAIL_PROVIDER is "disabled" even with onboarding@resend.dev sender', () => {
    const env = getValidProdEnv();
    env.EMAIL_PROVIDER = 'disabled';
    env.EMAIL_FROM_EMAIL = 'onboarding@resend.dev';
    delete (env as any).RESEND_API_KEY;
    process.env = env as any;

    const config = validateEnv();
    expect(config.NODE_ENV).toBe('production');
    expect(config.EMAIL_PROVIDER).toBe('disabled');
  });

  it('should fail in production when EMAIL_PROVIDER is "resend" and RESEND_API_KEY is missing', () => {
    const env = getValidProdEnv();
    env.EMAIL_PROVIDER = 'resend';
    delete (env as any).RESEND_API_KEY;
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should fail in production when EMAIL_PROVIDER is invalid or unknown', () => {
    const env = getValidProdEnv();
    env.EMAIL_PROVIDER = 'unsupported_provider' as any;
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should fail in production when EMAIL_FROM_EMAIL uses onboarding@resend.dev with a live provider', () => {
    const env = getValidProdEnv();
    env.EMAIL_PROVIDER = 'resend';
    env.EMAIL_FROM_EMAIL = 'onboarding@resend.dev';
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should fail in production when EMAIL_PROVIDER is set to "mock"', () => {
    const env = getValidProdEnv();
    env.EMAIL_PROVIDER = 'mock';
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should fail in production when OPENAI_API_KEY does not start with sk-', () => {
    const env = getValidProdEnv();
    env.OPENAI_API_KEY = 'invalid_key_prefix_123456789012345';
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should accept valid pooled DATABASE_URL and direct DIRECT_URL', () => {
    const env = getValidProdEnv();
    env.DATABASE_URL = 'postgresql://prod_user:aK9%23mP9%24vL2@ep-test-pooler.c-11.us-east-1.aws.neon.tech:5432/neondb?sslmode=require&connect_timeout=15&pool_timeout=15&connection_limit=10';
    (env as any).DIRECT_URL = 'postgresql://prod_user:aK9%23mP9%24vL2@ep-test.c-11.us-east-1.aws.neon.tech:5432/neondb?sslmode=require&connect_timeout=15';
    process.env = env as any;

    const config = validateEnv();
    expect(config.DATABASE_URL).toContain('-pooler');
  });

  it('should reject malformed or non-postgresql DATABASE_URL', () => {
    const env = getValidProdEnv();
    env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';
    process.env = env as any;

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv()).toThrow('process.exit: 1');

    mockExit.mockRestore();
    mockConsole.mockRestore();
  });
});
