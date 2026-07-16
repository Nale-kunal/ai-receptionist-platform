/**
 * Prompt Engine In-Process Event Publisher
 *
 * Mirrors the pattern of InProcessAiEngineEventPublisher exactly.
 */

import type { IPromptEngineEventPublisher } from '../interfaces/prompt-engine.interfaces';
import type { PromptEngineDomainEvent } from './prompt-engine.events';

export class InProcessPromptEngineEventPublisher implements IPromptEngineEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: PromptEngineDomainEvent) => void | Promise<void>>
  >;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: PromptEngineDomainEvent['type'],
    handler: (event: PromptEngineDomainEvent) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: PromptEngineDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // Non-fatal: log and continue
        console.error(`[PromptEngine] Error in event handler for ${event.type}:`, err);
      }
    }
  }
}
