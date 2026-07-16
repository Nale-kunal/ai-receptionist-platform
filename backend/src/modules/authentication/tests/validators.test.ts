/**
 * Zod Validator Unit Tests
 *
 * Tests all Zod schemas used in authentication:
 *   - RegisterSchema: password policy, email normalization, confirmation match
 *   - LoginSchema: basic email + password bounds
 *   - ForgotPasswordSchema: email validation
 *   - ResetPasswordSchema: password policy + token presence
 *   - VerifyEmailSchema: token presence
 */

import { RegisterSchema } from '../validators/register.validator';
import { LoginSchema } from '../validators/login.validator';
import { ForgotPasswordSchema } from '../validators/forgot-password.validator';
import { ResetPasswordSchema } from '../validators/reset-password.validator';
import { VerifyEmailSchema } from '../validators/verify-email.validator';
import { ResendVerificationSchema } from '../validators/resend-verification.validator';

// --------------------------------------------------------------------------
// RegisterSchema
// --------------------------------------------------------------------------

describe('RegisterSchema', () => {
  const validPayload = {
    email: 'User@Example.COM',
    password: 'SecurePass1!',
    confirmPassword: 'SecurePass1!',
    firstName: 'Jane',
    lastName: 'Doe',
  };

  it('should accept a valid registration payload', () => {
    const result = RegisterSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should normalize email to lowercase', () => {
    const result = RegisterSchema.safeParse(validPayload);
    expect(result.success && result.data.email).toBe('user@example.com');
  });

  it('should reject an invalid email', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('should reject a password shorter than 12 characters', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, password: 'Short1!', confirmPassword: 'Short1!' });
    expect(result.success).toBe(false);
  });

  it('should reject a password without uppercase', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, password: 'alllower1!aaa', confirmPassword: 'alllower1!aaa' });
    expect(result.success).toBe(false);
  });

  it('should reject a password without a digit', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, password: 'NoDigitHere!!!', confirmPassword: 'NoDigitHere!!!' });
    expect(result.success).toBe(false);
  });

  it('should reject a password without a special character', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, password: 'NoSpecial1234567', confirmPassword: 'NoSpecial1234567' });
    expect(result.success).toBe(false);
  });

  it('should reject when passwords do not match', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, confirmPassword: 'DifferentPass1!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.errors.find((e) => e.path.includes('confirmPassword'));
      expect(confirmError).toBeDefined();
    }
  });

  it('should reject missing first name', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('should accept an optional valid tenantId UUID', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, tenantId: '123e4567-e89b-12d3-a456-426614174000' });
    expect(result.success).toBe(true);
  });

  it('should reject an invalid tenantId format', () => {
    const result = RegisterSchema.safeParse({ ...validPayload, tenantId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// LoginSchema
// --------------------------------------------------------------------------

describe('LoginSchema', () => {
  it('should accept valid credentials', () => {
    const result = LoginSchema.safeParse({ email: 'Test@Example.COM', password: 'AnyPassword' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe('test@example.com');
  });

  it('should reject missing email', () => {
    const result = LoginSchema.safeParse({ password: 'AnyPassword' });
    expect(result.success).toBe(false);
  });

  it('should reject missing password', () => {
    const result = LoginSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = LoginSchema.safeParse({ email: 'test@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// ForgotPasswordSchema
// --------------------------------------------------------------------------

describe('ForgotPasswordSchema', () => {
  it('should accept a valid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'USER@EXAMPLE.COM' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe('user@example.com');
  });

  it('should reject an invalid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'invalid' });
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// ResetPasswordSchema
// --------------------------------------------------------------------------

describe('ResetPasswordSchema', () => {
  const validReset = {
    token: 'valid-reset-token-abc123',
    newPassword: 'NewSecurePass1!',
    confirmPassword: 'NewSecurePass1!',
  };

  it('should accept a valid reset payload', () => {
    const result = ResetPasswordSchema.safeParse(validReset);
    expect(result.success).toBe(true);
  });

  it('should reject when passwords do not match', () => {
    const result = ResetPasswordSchema.safeParse({ ...validReset, confirmPassword: 'WrongPass1!' });
    expect(result.success).toBe(false);
  });

  it('should reject a weak new password', () => {
    const result = ResetPasswordSchema.safeParse({ ...validReset, newPassword: 'weak', confirmPassword: 'weak' });
    expect(result.success).toBe(false);
  });

  it('should reject a missing token', () => {
    const result = ResetPasswordSchema.safeParse({ ...validReset, token: '' });
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// VerifyEmailSchema
// --------------------------------------------------------------------------

describe('VerifyEmailSchema', () => {
  it('should accept a non-empty token', () => {
    const result = VerifyEmailSchema.safeParse({ token: 'abc123token' });
    expect(result.success).toBe(true);
  });

  it('should reject an empty token', () => {
    const result = VerifyEmailSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a missing token', () => {
    const result = VerifyEmailSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// ResendVerificationSchema
// --------------------------------------------------------------------------

describe('ResendVerificationSchema', () => {
  it('should accept a valid email', () => {
    const result = ResendVerificationSchema.safeParse({ email: 'Test@Example.COM' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe('test@example.com');
  });

  it('should reject an invalid email', () => {
    const result = ResendVerificationSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });
});
