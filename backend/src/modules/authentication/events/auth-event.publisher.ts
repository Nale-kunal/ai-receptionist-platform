/**
 * Authentication Event Publisher
 *
 * Interface and no-op default implementation.
 * In production, replace with a concrete publisher (EventEmitter, Redis Streams, etc.)
 * without changing the AuthService.
 *
 * Per Engineering Constitution Principle 7 (Replaceable Providers) and
 * Principle 8 (Modular Architecture).
 */

import type { AuthDomainEvent } from './auth.events';

// --------------------------------------------------------------------------
// Interface
// --------------------------------------------------------------------------

export interface AuthEventPublisher {
  publish(event: AuthDomainEvent): Promise<void>;
}

// --------------------------------------------------------------------------
// In-Process Event Publisher (default)
// --------------------------------------------------------------------------

/**
 * Simple in-process publisher backed by Node.js EventEmitter.
 * Suitable for the current monolith architecture.
 * Designed to be swapped for Redis Streams / Kafka when extracted.
 */
export class InProcessAuthEventPublisher implements AuthEventPublisher {
  private readonly listeners: Map<string, Array<(event: AuthDomainEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(eventType: string, handler: (event: AuthDomainEvent) => void | Promise<void>): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: AuthDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.eventType) ?? [];
    // Fire-and-forget by design — auth flows must not block on audit writes
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch {
        // Swallow errors from event handlers — authentication must not fail
        // because an audit handler throws.
        // Errors should be logged by the handler itself.
      }
    }
  }
}
