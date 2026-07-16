/**
 * Configuration Event Publisher
 *
 * Implements a lightweight in-process event broker for decoupled configuration audit trail hooks.
 */

import type { ConfigurationEvent } from './configuration.events';

export interface IConfigurationEventPublisher {
  publish(event: ConfigurationEvent): Promise<void>;
}

export class InProcessConfigurationEventPublisher implements IConfigurationEventPublisher {
  private readonly listeners: Map<string, Array<(event: ConfigurationEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: ConfigurationEvent['type'],
    handler: (event: any) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: ConfigurationEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // Event processing should not block the main transaction flow
        console.error(`Error in configuration event handler for ${event.type}:`, err);
      }
    }
  }
}
