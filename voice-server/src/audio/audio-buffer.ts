import type { IAudioBuffer } from '../interfaces/voice-server.interfaces';
import type { AudioFrame } from '../types/voice-server.types';
import { StreamOverflowError } from '../errors/voice-server.errors';

export class AudioBuffer implements IAudioBuffer {
  private queue: AudioFrame[] = [];
  private readonly capacity: number;
  private readonly highWatermark: number;
  private readonly lowWatermark: number;
  private isBackpressureTriggered = false;
  private releaseCallbacks: Array<() => void> = [];

  constructor(config: { maxBufferFrameCount: number }) {
    this.capacity = config.maxBufferFrameCount;
    // Backpressure thresholds
    this.highWatermark = Math.floor(this.capacity * 0.8); // 80% full
    this.lowWatermark = Math.floor(this.capacity * 0.4);  // 40% full
  }

  public enqueue(frame: AudioFrame): void {
    if (this.isFull()) {
      throw new StreamOverflowError(this.getSize(), this.capacity);
    }

    this.queue.push(frame);

    // Check if backpressure needs to be triggered
    if (this.getSize() >= this.highWatermark && !this.isBackpressureTriggered) {
      this.isBackpressureTriggered = true;
    }
  }

  public dequeue(): AudioFrame | undefined {
    const frame = this.queue.shift();

    // Check if backpressure can be released
    if (this.isBackpressureTriggered && this.getSize() <= this.lowWatermark) {
      this.isBackpressureTriggered = false;
      this.notifyReleaseCallbacks();
    }

    return frame;
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  public isFull(): boolean {
    return this.queue.length >= this.capacity;
  }

  public clear(): void {
    this.queue = [];
    if (this.isBackpressureTriggered) {
      this.isBackpressureTriggered = false;
      this.notifyReleaseCallbacks();
    }
  }

  public getUsageRatio(): number {
    return this.getSize() / this.capacity;
  }

  public getSize(): number {
    return this.queue.length;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public onBackpressureRelease(callback: () => void): void {
    this.releaseCallbacks.push(callback);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private notifyReleaseCallbacks(): void {
    const callbacks = [...this.releaseCallbacks];
    for (const callback of callbacks) {
      try {
        callback();
      } catch (err) {
        console.error('[VoiceServer] Error in backpressure release callback:', err);
      }
    }
  }
}
