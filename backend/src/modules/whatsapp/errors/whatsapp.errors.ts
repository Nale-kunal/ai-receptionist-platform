/**
 * WhatsApp Module Errors
 */

export class WhatsAppError extends Error {
  public readonly code: string;
  public readonly status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = 'WhatsAppError';
    this.code = code;
    this.status = status;
  }
}

export class WhatsAppIntegrationNotFoundError extends WhatsAppError {
  constructor(phoneNumber?: string) {
    super(
      phoneNumber
        ? `No active WhatsApp integration found for phone number ${phoneNumber}.`
        : 'WhatsApp integration not found.',
      'WHATSAPP_INTEGRATION_NOT_FOUND',
      404,
    );
  }
}

export class WhatsAppIntegrationDisabledError extends WhatsAppError {
  constructor() {
    super('WhatsApp integration is currently disabled.', 'WHATSAPP_INTEGRATION_DISABLED', 409);
  }
}

export class WhatsAppSignatureVerificationError extends WhatsAppError {
  constructor() {
    super('Webhook signature verification failed.', 'WHATSAPP_SIGNATURE_INVALID', 401);
  }
}

export class WhatsAppDuplicateMessageError extends WhatsAppError {
  constructor(wamid: string) {
    super(`Message ${wamid} has already been processed.`, 'WHATSAPP_DUPLICATE_MESSAGE', 200);
  }
}

export class WhatsAppRateLimitError extends WhatsAppError {
  constructor() {
    super('Rate limit exceeded for this WhatsApp conversation.', 'WHATSAPP_RATE_LIMIT', 429);
  }
}

export class WhatsAppMaxTurnsExceededError extends WhatsAppError {
  constructor() {
    super('Maximum conversation turns reached. Escalating to human agent.', 'WHATSAPP_MAX_TURNS', 200);
  }
}

export class WhatsAppPatientIdentificationError extends WhatsAppError {
  constructor() {
    super('Unable to identify patient for this request.', 'WHATSAPP_PATIENT_NOT_IDENTIFIED', 200);
  }
}

export class WhatsAppIsolationViolationError extends WhatsAppError {
  constructor() {
    super('Tenant isolation violation detected.', 'WHATSAPP_ISOLATION_VIOLATION', 403);
  }
}

export class WhatsAppWabaMismatchError extends WhatsAppError {
  constructor(expectedWabaId: string, receivedWabaId: string) {
    super(
      `WABA ID mismatch: expected ${expectedWabaId}, received ${receivedWabaId}.`,
      'WHATSAPP_WABA_MISMATCH',
      403,
    );
  }
}

