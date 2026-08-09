/**
 * Real-Time Availability Event Bus
 * Synchronizes availability state across open components, modals, and screens.
 */

export type AvailabilityEventPayload = { doctorId?: string; date?: string; timestamp: number };
type AvailabilityEventListener = (event: AvailabilityEventPayload) => void;

class AvailabilityEventBus {
  private static instance: AvailabilityEventBus;
  private listeners: Set<AvailabilityEventListener> = new Set();

  private constructor() {}

  public static getInstance(): AvailabilityEventBus {
    if (!AvailabilityEventBus.instance) {
      AvailabilityEventBus.instance = new AvailabilityEventBus();
    }
    return AvailabilityEventBus.instance;
  }

  public subscribe(listener: AvailabilityEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyInvalidated(details?: { doctorId?: string; date?: string }): void {
    const payload = { ...details, timestamp: Date.now() };
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.warn('[AvailabilityBus] Error in availability listener:', err);
      }
    });
  }
}

export const availabilityBus = AvailabilityEventBus.getInstance();
