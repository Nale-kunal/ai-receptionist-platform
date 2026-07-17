/**
 * End-to-End Call Flow — Domain Event Publisher
 */

import { EventEmitter } from 'events';
import type { E2eEventEnvelope } from './end-to-end.events';

export class E2eEventPublisher extends EventEmitter {
  private static instance: E2eEventPublisher;

  private constructor() {
    super();
  }

  public static getInstance(): E2eEventPublisher {
    if (!E2eEventPublisher.instance) {
      E2eEventPublisher.instance = new E2eEventPublisher();
    }
    return E2eEventPublisher.instance;
  }

  public publish(envelope: E2eEventEnvelope): void {
    this.emit(envelope.type, envelope);
    this.emit('*', envelope);
  }
}
export const eventPublisher = E2eEventPublisher.getInstance();
