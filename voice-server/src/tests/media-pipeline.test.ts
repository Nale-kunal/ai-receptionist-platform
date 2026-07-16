import { MediaPipeline } from '../streaming/media-pipeline';
import { InvalidFrameError, UnsupportedCodecError } from '../errors/voice-server.errors';

describe('MediaPipeline', () => {
  let pipeline: MediaPipeline;
  const config = {
    codecPreferences: ['audio/PCMU', 'audio/PCMA'],
    maxPayloadSizeBytes: 100,
    jitterBufferMs: 60,
  };

  beforeEach(() => {
    pipeline = new MediaPipeline(config);
  });

  it('normalizes, sequences, and timestamps inbound frames', async () => {
    const payload = Buffer.alloc(50, 0);
    const frame = await pipeline.processInboundFrame('session-1', payload, 1);

    expect(frame.sequence).toBe(1);
    expect(frame.timestamp).toBe(20); // 1 * 20ms
    expect(frame.durationMs).toBe(20);
    expect(frame.payload).toBe(payload);
    expect(frame.codec).toBe('audio/PCMU');
  });

  it('tracks dropped frames in sequence gaps', async () => {
    const payload = Buffer.alloc(50, 0);
    
    await pipeline.processInboundFrame('s1', payload, 1);
    // Large sequence gap: sequence jump to 5 (expects 2, 3, 4 dropped)
    await pipeline.processInboundFrame('s1', payload, 5);

    expect(pipeline.getDroppedFramesCount()).toBe(3);
  });

  it('rejects oversized payloads with InvalidFrameError', async () => {
    const hugePayload = Buffer.alloc(200, 1); // Max size is 100
    await expect(pipeline.processInboundFrame('s1', hugePayload, 1)).rejects.toThrow(InvalidFrameError);
  });

  it('rejects empty payloads with InvalidFrameError', async () => {
    const emptyPayload = Buffer.alloc(0);
    await expect(pipeline.processInboundFrame('s1', emptyPayload, 1)).rejects.toThrow(InvalidFrameError);
  });

  it('verifies supported codecs on normalizeCodec', async () => {
    const payload = Buffer.alloc(10);
    await expect(pipeline.normalizeCodec(payload, 'audio/INVALID', 'audio/PCMA')).rejects.toThrow(
      UnsupportedCodecError
    );
  });
});
