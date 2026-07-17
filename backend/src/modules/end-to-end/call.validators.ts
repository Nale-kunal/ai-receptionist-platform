/**
 * End-to-End Call Flow — Payload Validators
 */

import { E2eSecurityValidationError } from './end-to-end.errors';

export function validateIncomingCallPayload(body: unknown): asserts body is {
  tenantId: string;
  callerNumber: string;
  calledNumber: string;
  callSid: string;
} {
  if (typeof body !== 'object' || body === null) {
    throw new E2eSecurityValidationError('Payload must be a non-null object.');
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj['tenantId'] !== 'string' || obj['tenantId'].trim() === '') {
    throw new E2eSecurityValidationError('Missing or empty tenantId parameters.');
  }

  if (typeof obj['callerNumber'] !== 'string' || obj['callerNumber'].trim() === '') {
    throw new E2eSecurityValidationError('Missing or empty callerNumber parameters.');
  }

  if (typeof obj['calledNumber'] !== 'string' || obj['calledNumber'].trim() === '') {
    throw new E2eSecurityValidationError('Missing or empty calledNumber parameters.');
  }

  if (typeof obj['callSid'] !== 'string' || obj['callSid'].trim() === '') {
    throw new E2eSecurityValidationError('Missing or empty callSid parameters.');
  }
}
