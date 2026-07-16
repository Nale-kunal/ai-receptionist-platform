/**
 * RBAC Event Publisher
 *
 * Same pattern as auth-event.publisher.ts — in-process publisher
 * with a swappable interface. Fire-and-forget: RBAC decisions must
 * never block on audit side-effects.
 */

import type { RbacDomainEvent } from './rbac.events';

// --------------------------------------------------------------------------
// Interface
// --------------------------------------------------------------------------

export interface RbacEventPublisher {
  publish(event: RbacDomainEvent): Promise<void>;
}

// --------------------------------------------------------------------------
// In-Process Publisher
// --------------------------------------------------------------------------

export class InProcessRbacEventPublisher implements RbacEventPublisher {
  private readonly listeners: Map<string, Array<(event: RbacDomainEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(eventType: string, handler: (event: RbacDomainEvent) => void | Promise<void>): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: RbacDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.eventType) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch {
        // Swallow — authorization must never fail because an audit handler throws
      }
    }
  }
}
