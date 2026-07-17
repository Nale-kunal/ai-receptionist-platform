import type { IOrchestratorEventPublisher, OrchestratorDomainEvent } from './conversation-orchestrator.events';

interface EnqueuedEvent {
  event: OrchestratorDomainEvent;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class InProcessOrchestratorEventPublisher implements IOrchestratorEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: any) => void | Promise<void>>
  > = new Map();

  // Explicit queue processing to guarantee priority execution
  private readonly eventQueue: EnqueuedEvent[] = [];
  private processingQueue = false;

  private readonly eventPriorities: Record<OrchestratorDomainEvent['type'], number> = {
    'conversation.failed': 1,             // Critical Failure (highest)
    'conversation.timeout': 2,            // Timeout / Disconnect
    'conversation.interrupted': 3,        // Barge-in Interruption
    'conversation.resumed': 3,
    'conversation.turn.started': 4,       // Transcript accumulation
    'conversation.turn.completed': 4,
    'conversation.context.updated': 5,
    'conversation.snapshot.restored': 5,
    'conversation.recovered': 5,
    'conversation.response.generated': 6, // Assistant responses
    'conversation.snapshot.created': 7,   // Checkpoint metrics (lowest)
    'conversation.created': 7,
    'conversation.started': 7,
    'conversation.completed': 7,
  };

  public subscribe(
    eventType: OrchestratorDomainEvent['type'],
    handler: (event: any) => void | Promise<void>
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public publish(event: OrchestratorDomainEvent): Promise<void> {
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
          console.error(`[OrchestratorPublisher] Handler failed for event ${event.type}:`, err);
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
