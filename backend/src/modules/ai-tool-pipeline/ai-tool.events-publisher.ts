import type { IAiToolEventPublisher, AiToolDomainEvent } from './ai-tool.events';

interface EnqueuedEvent {
  event: AiToolDomainEvent;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class InProcessAiToolEventPublisher implements IAiToolEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: any) => void | Promise<void>>
  > = new Map();

  private readonly eventQueue: EnqueuedEvent[] = [];
  private processingQueue = false;

  private readonly eventPriorities: Record<AiToolDomainEvent['type'], number> = {
    'tool.failed': 1,      // Critical Failure (highest)
    'tool.timedout': 2,    // Timeout
    'tool.denied': 3,      // Denied / Auth / Tenant Isolation
    'tool.retried': 4,     // Retry triggers
    'tool.completed': 5,   // Output completion
    'tool.executed': 6,    // Success execution metrics
    'tool.validated': 7,
    'tool.requested': 8,   // Setup trace (lowest)
  };

  public subscribe(
    eventType: AiToolDomainEvent['type'],
    handler: (event: any) => void | Promise<void>
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public publish(event: AiToolDomainEvent): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.eventQueue.push({ event, resolve, reject });

      // Sort queue dynamically by priority (ascending, where 1 is highest priority)
      this.eventQueue.sort((a, b) => {
        const pA = this.eventPriorities[a.event.type] ?? 99;
        const pB = this.eventPriorities[b.event.type] ?? 99;
        return pA - pB;
      });

      if (!this.processingQueue) {
        this.processingQueue = true;
        process.nextTick(async () => {
          await this.processQueue();
        });
      }
    });
  }

  private async processQueue(): Promise<void> {
    while (this.eventQueue.length > 0) {
      const { event, resolve, reject } = this.eventQueue.shift()!;
      const handlers = this.listeners.get(event.type) ?? [];

      let errorOccurred: any = null;
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err) {
          console.error(`[AiToolPublisher] Handler failed for event ${event.type}:`, err);
          errorOccurred = err;
        }
      }

      if (errorOccurred) {
        reject(errorOccurred);
      } else {
        resolve();
      }
    }

    this.processingQueue = false;
  }
}
