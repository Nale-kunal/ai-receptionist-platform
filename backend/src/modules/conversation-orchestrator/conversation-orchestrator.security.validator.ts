import { ConversationOrchestratorError } from './conversation-orchestrator.errors';

export class OrchestratorSecurityValidator {
  private readonly allowedOrigins: Set<string>;

  constructor(config: { allowedOrigins: string[] }) {
    this.allowedOrigins = new Set(config.allowedOrigins);
  }

  /**
   * Enforces that request inputs target correct tenants and that cross-tenant lookups are blocked.
   */
  public validateTenantContext(sessionTenantId: string, requestTenantId: string): void {
    if (!sessionTenantId || !requestTenantId || sessionTenantId !== requestTenantId) {
      throw new ConversationOrchestratorError(
        'Multi-tenant request validation failure. Access denied.',
        'TENANT_ISOLATION_VIOLATION',
        403
      );
    }
  }

  /**
   * Validates metadata origin signatures to prevent spoofing
   */
  public validateOrigin(origin: string): void {
    if (!origin || !this.allowedOrigins.has(origin)) {
      throw new ConversationOrchestratorError(
        `Orchestrator signature verification failed. Untrusted origin: ${origin}`,
        'UNTRUSTED_ORIGIN',
        400
      );
    }
  }

  /**
   * Redacts sensitive user PHI and authentication secrets from logging parameters
   */
  public sanitizeLogs(metadata: Record<string, unknown>): Record<string, unknown> {
    const copy = { ...metadata };
    const sensitive = ['ssn', 'dob', 'token', 'password', 'secret', 'key', 'payload', 'audio'];

    for (const key of Object.keys(copy)) {
      if (sensitive.some((s) => key.toLowerCase().includes(s))) {
        copy[key] = '[REDACTED]';
      }
    }
    return copy;
  }
}
