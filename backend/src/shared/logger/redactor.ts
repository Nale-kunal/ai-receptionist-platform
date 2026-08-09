const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /\+?[0-9]{10,15}/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
const JWT_REGEX = /eyJ[a-zA-Z0-9-_=]+\.eyJ[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+/g;
const OPENAI_KEY_REGEX = /sk-[a-zA-Z0-9]{20,}/g;
const TWILIO_SID_REGEX = /AC[a-zA-Z0-9]{32}/g;
const TWILIO_TOKEN_REGEX = /\b[a-f0-9]{32}\b/g;
const POSTGRES_URL_REGEX = /postgres(ql)?:\/\/([^:]+):([^@]+)@/g;

const SENSITIVE_KEYS = new Set([
  'password', 'secret', 'key', 'token', 'authorization', 'cookie', 
  'apikey', 'authtoken', 'ssn', 'dob', 'email', 'phone', 'patientname',
  'callednumber', 'callernumber', 'caller_number', 'called_number',
  'api_key', 'api_secret', 'apisecret', 'auth_token'
]);

export function redactString(str: string): string {
  return str
    .replace(JWT_REGEX, '[JWT_REDACTED]')
    .replace(OPENAI_KEY_REGEX, '[OPENAI_KEY_REDACTED]')
    .replace(TWILIO_SID_REGEX, '[TWILIO_SID_REDACTED]')
    .replace(TWILIO_TOKEN_REGEX, '[TWILIO_TOKEN_REDACTED]')
    .replace(POSTGRES_URL_REGEX, 'postgresql://$2:[DB_PASSWORD_REDACTED]@')
    .replace(SSN_REGEX, '[SSN_REDACTED]')
    .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    .replace(PHONE_REGEX, '[PHONE_REDACTED]');
}

export function redactObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  if (typeof obj === 'object') {
    if (obj instanceof Error) {
      const redactedError = new Error(redactString(obj.message));
      redactedError.name = obj.name;
      if (obj.stack) {
        redactedError.stack = redactString(obj.stack);
      }
      return redactedError;
    }
    
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactObject(value);
      }
    }
    return redacted;
  }
  if (typeof obj === 'string') {
    return redactString(obj);
  }
  return obj;
}

export function redact(args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return redactString(arg);
    }
    return redactObject(arg);
  });
}

export function setupLogRedaction(): void {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  console.log = (...args: any[]) => {
    originalLog(...redact(args));
  };
  console.error = (...args: any[]) => {
    originalError(...redact(args));
  };
  console.warn = (...args: any[]) => {
    originalWarn(...redact(args));
  };
  console.info = (...args: any[]) => {
    originalInfo(...redact(args));
  };
  console.debug = (...args: any[]) => {
    originalDebug(...redact(args));
  };
}
