import { AudioBuffer } from '../audio/audio-buffer';
import { StreamOverflowError } from '../errors/voice-server.errors';
import type { AudioFrame } from '../types/voice-server.types';

function makeFrame(sequence: number): AudioFrame {
  return {
    sequence,
    timestamp: sequence * 20,
    payload: Buffer.alloc(10, 0),
    codec: 'audio/PCMU',
    durationMs: 20,
  };
}

describe('AudioBuffer', () => {
  it('enqueues and dequeues frames sequentially', () => {
    const buffer = new AudioBuffer({ maxBufferFrameCount: 10 });
    
    buffer.enqueue(makeFrame(1));
    buffer.enqueue(makeFrame(2));

    expect(buffer.getSize()).toBe(2);
    expect(buffer.dequeue()?.sequence).toBe(1);
    expect(buffer.dequeue()?.sequence).toBe(2);
    expect(buffer.isEmpty()).toBe(true);
  });

  it('rejects frame enqueues with StreamOverflowError if full', () => {
    const buffer = new AudioBuffer({ maxBufferFrameCount: 2 });
    
    buffer.enqueue(makeFrame(1));
    buffer.enqueue(makeFrame(2));

    expect(buffer.isFull()).toBe(true);
    expect(() => buffer.enqueue(makeFrame(3))).toThrow(StreamOverflowError);
  });

  it('reports correct capacity usage ratio', () => {
    const buffer = new AudioBuffer({ maxBufferFrameCount: 10 });
    buffer.enqueue(makeFrame(1));
    buffer.enqueue(makeFrame(2));

    expect(buffer.getUsageRatio()).toBe(0.2); // 2 / 10
  });

  it('triggers backpressure at high watermark (80%) and releases at low watermark (40%)', () => {
    const buffer = new AudioBuffer({ maxBufferFrameCount: 10 });
    let releaseTriggered = false;

    buffer.onBackpressureRelease(() => {
      releaseTriggered = true;
    });

    // Enqueue 8 frames (80% - hits high watermark)
    for (let i = 1; i <= 8; i++) {
      buffer.enqueue(makeFrame(i));
    }

    expect(buffer.getSize()).toBe(8);

    // Dequeue down to 5 (50% - still above low watermark 40%)
    buffer.dequeue();
    buffer.dequeue();
    buffer.dequeue();
    expect(releaseTriggered).toBe(false);

    // Dequeue down to 4 (40% - hits low watermark, releases)
    buffer.dequeue();
    expect(releaseTriggered).toBe(true);
  });
});
