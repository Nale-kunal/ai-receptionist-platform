import type { IVoiceAuditLogger } from '../interfaces/voice-server.interfaces';

export class VoiceAuditLogger implements IVoiceAuditLogger {
  public logSessionCreated(
    sessionId: string,
    tenantId: string,
    provider: string,
    callId: string
  ): void {
    this.writeAudit('SESSION_CREATED', sessionId, tenantId, { provider, providerCallId: callId });
  }

  public logSessionConnected(sessionId: string, tenantId: string): void {
    this.writeAudit('SESSION_CONNECTED', sessionId, tenantId);
  }

  public logSessionDisconnected(sessionId: string, tenantId: string, reason?: string): void {
    this.writeAudit('SESSION_DISCONNECTED', sessionId, tenantId, { reason });
  }

  public logProviderConnected(sessionId: string, tenantId: string, provider: string): void {
    this.writeAudit('PROVIDER_CONNECTED', sessionId, tenantId, { provider });
  }

  public logProviderDisconnected(sessionId: string, tenantId: string, provider: string, reason?: string): void {
    this.writeAudit('PROVIDER_DISCONNECTED', sessionId, tenantId, { provider, reason });
  }

  public logError(
    sessionId: string,
    tenantId: string,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    // Redact any possible PHI/secrets inside the details
    const sanitizedDetails = this.sanitizeDetails(details);
    this.writeAudit('ERROR', sessionId, tenantId, { code, message, ...sanitizedDetails });
  }

  public logTimeout(sessionId: string, tenantId: string, type: 'heartbeat' | 'idle'): void {
    this.writeAudit('TIMEOUT', sessionId, tenantId, { timeoutType: type });
  }

  // ---------------------------------------------------------------------------
  // Internal Logger
  // ---------------------------------------------------------------------------

  private writeAudit(
    event: string,
    sessionId: string,
    tenantId: string,
    metadata: Record<string, unknown> = {}
  ): void {
    const record = {
      timestamp: new Date().toISOString(),
      service: 'VoiceServer',
      event,
      sessionId,
      tenantId,
      metadata,
    };
    
    // In standard node output, we log JSON lines for auditing
    console.log(JSON.stringify(record));
  }

  private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> {
    if (!details) return {};
    const copy = { ...details };
    
    // List of keys to redact
    const redactKeys = ['payload', 'audio', 'token', 'secret', 'password', 'key', 'apiKey', 'ssn', 'dob', 'name', 'phone'];
    
    for (const key of Object.keys(copy)) {
      if (redactKeys.some((r) => key.toLowerCase().includes(r))) {
        copy[key] = '[REDACTED]';
      }
    }
    return copy;
  }
}
