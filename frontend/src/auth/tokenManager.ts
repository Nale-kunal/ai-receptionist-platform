let inMemoryToken: string | null = null;
let inMemorySessionId: string | null = null;

const getAtob = (): ((str: string) => string) => {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob.bind(window);
  }
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return (str: string) => (globalThis as any).Buffer.from(str, 'base64').toString('binary');
  }
  return (str: string) => str;
};

const atobFn = getAtob();

export function decodeTokenPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atobFn(base64);
    const jsonPayload = decodeURIComponent(
      binaryString
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const tokenManager = {
  getToken: (): string | null => inMemoryToken,
  getAccessToken: (): string | null => inMemoryToken,
  setToken: (token: string | null): void => {
    inMemoryToken = token;
    if (token) {
      const payload = decodeTokenPayload(token);
      if (payload && payload.sessionId) {
        inMemorySessionId = payload.sessionId;
      }
    }
  },
  setAccessToken: (token: string | null): void => {
    inMemoryToken = token;
    if (token) {
      const payload = decodeTokenPayload(token);
      if (payload && payload.sessionId) {
        inMemorySessionId = payload.sessionId;
      }
    }
  },
  getSessionId: (): string | null => inMemorySessionId,
  setSessionId: (sessionId: string | null): void => {
    inMemorySessionId = sessionId;
  },
  clear: (): void => {
    inMemoryToken = null;
    inMemorySessionId = null;
  },
};
