import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokenManager } from '../src/auth/tokenManager';
import { authService } from '../src/auth/authService';
import { validateEmail, validatePassword } from '../src/utils/validators';
import { axiosClient } from '../src/services/axiosClient';

// Helper to create a fake JWT access token containing a sessionId
const createFakeJwt = (payload: object) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = btoa(JSON.stringify(payload));
  const signature = 'fake-signature';
  return `${header}.${data}.${signature}`;
};

describe('Validators Unit Tests', () => {
  it('correctly validates email syntax', () => {
    expect(validateEmail('')).toBe('Email is required.');
    expect(validateEmail('invalid-email')).toBe('Please enter a valid email address.');
    expect(validateEmail('test@clinic')).toBe('Please enter a valid email address.');
    expect(validateEmail('test@clinic.com')).toBeNull();
  });

  it('enforces strict enterprise password requirements', () => {
    // Required: min 12 chars, uppercase, lowercase, number, special char
    expect(validatePassword('')).toBe('Password is required.');
    expect(validatePassword('Short1!')).toBe('Password must be at least 12 characters.');
    expect(validatePassword('nouppercase123!')).toContain('Password must contain at least one uppercase');
    expect(validatePassword('NOLOWERCASE123!')).toContain('Password must contain at least one uppercase');
    expect(validatePassword('NoDigitSpecial')).toContain('Password must contain at least one uppercase');
    expect(validatePassword('SecurPass1!')).toBe('Password must be at least 12 characters.'); // 11 chars
    expect(validatePassword('SecurePass12!')).toBeNull(); // 13 chars, valid
  });
});

describe('Token Manager Unit Tests', () => {
  beforeEach(() => {
    tokenManager.clear();
  });

  it('stores access token and resolves sessionId claim', () => {
    const fakeToken = createFakeJwt({ sub: 'user-123', sessionId: 'sess-abc-456' });
    tokenManager.setToken(fakeToken);

    expect(tokenManager.getToken()).toBe(fakeToken);
    expect(tokenManager.getSessionId()).toBe('sess-abc-456');
  });

  it('correctly clears tokens and sessionId on clear()', () => {
    const fakeToken = createFakeJwt({ sub: 'user-123', sessionId: 'sess-abc-456' });
    tokenManager.setToken(fakeToken);
    tokenManager.clear();

    expect(tokenManager.getToken()).toBeNull();
    expect(tokenManager.getSessionId()).toBeNull();
  });
});

describe('Auth Service & Axios Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tokenManager.clear();
  });

  it('saves token on login success', async () => {
    const fakeToken = createFakeJwt({ sub: 'user-123', sessionId: 'sess-abc-456' });
    const mockResponse = {
      data: {
        success: true,
        data: {
          accessToken: fakeToken,
          user: { email: 'admin@clinic.com' },
        },
      },
    };

    const postSpy = vi.spyOn(axiosClient, 'post').mockResolvedValue(mockResponse as any);

    const data = await authService.login('admin@clinic.com', 'SecurePass12!');

    expect(postSpy).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@clinic.com',
      password: 'SecurePass12!',
    });
    expect(tokenManager.getToken()).toBe(fakeToken);
    expect(tokenManager.getSessionId()).toBe('sess-abc-456');
    expect(data.user.email).toBe('admin@clinic.com');
  });

  it('clears token on logout', async () => {
    const fakeToken = createFakeJwt({ sub: 'user-123', sessionId: 'sess-abc-456' });
    tokenManager.setToken(fakeToken);

    const postSpy = vi.spyOn(axiosClient, 'post').mockResolvedValue({
      data: { success: true, message: 'Successfully logged out.' },
    } as any);

    await authService.logout();

    expect(postSpy).toHaveBeenCalledWith('/auth/logout');
    expect(tokenManager.getToken()).toBeNull();
    expect(tokenManager.getSessionId()).toBeNull();
  });

  it('performs silent token rotation using refresh()', async () => {
    const newFakeToken = createFakeJwt({ sub: 'user-123', sessionId: 'sess-xyz-789' });
    const mockResponse = {
      data: {
        success: true,
        data: {
          accessToken: newFakeToken,
        },
      },
    };

    const postSpy = vi.spyOn(axiosClient, 'post').mockResolvedValue(mockResponse as any);

    await authService.refresh('sess-abc-456');

    expect(postSpy).toHaveBeenCalledWith('/auth/refresh', { sessionId: 'sess-abc-456' });
    expect(tokenManager.getToken()).toBe(newFakeToken);
    expect(tokenManager.getSessionId()).toBe('sess-xyz-789');
  });
});
