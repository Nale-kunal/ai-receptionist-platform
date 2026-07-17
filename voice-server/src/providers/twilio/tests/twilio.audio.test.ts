/**
 * Twilio Voice Provider — Audio Stream and VAD Silence Tests
 */

import { TwilioAudioStream } from '../twilio.audio.stream';
import { TwilioMediaStreamHandler } from '../twilio.media-stream.handler';
import { TwilioVoiceSessionManager } from '../twilio.voice-session.manager';
import { TwilioMetricsCollector } from '../twilio.metrics.collector';
import { TwilioAuditLogger } from '../twilio.audit.logger';
import { InvalidFrameError } from '../../../errors/voice-server.errors';
import type { IVoiceSessionManager } from '../../../interfaces/voice-server.interfaces';

// ---------------------------------------------------------------------------
// Mock Core Voice Session Manager
// ---------------------------------------------------------------------------

class MockVoiceSessionManager implements Partial<IVoiceSessionManager> {
  public sessions = new Map<string, any>();

  public async updateSessionState(sessionId: string, tenantId: string, state: any): Promise<any> {
    const session = this.sessions.get(sessionId) ?? { sessionId, tenantId };
    session.connectionState = state;
    this.sessions.set(sessionId, session);
    return session;
  }
}

describe('Twilio Audio & VAD Silence Handler', () => {
  let stream: TwilioAudioStream;

  beforeEach(() => {
    stream = new TwilioAudioStream();
  });

  // ---------------------------------------------------------------------------
  // PCMU base64 parsing
  // ---------------------------------------------------------------------------

  it('correctly decodes base64 payload to binary Buffer', async () => {
    const chunk = Buffer.from([0x01, 0x02, 0x03]).toString('base64');
    const frame = await stream.pushInbound(chunk, 1, 100);

    expect(frame.sequence).toBe(1);
    expect(frame.timestamp).toBe(100);
    expect(frame.payload).toEqual(Buffer.from([0x01, 0x02, 0x03]));
    expect(frame.codec).toBe('audio/x-mulaw');
  });

  it('throws InvalidFrameError on zero payload size', async () => {
    await expect(stream.pushInbound('', 1, 100)).rejects.toThrow(InvalidFrameError);
  });

  // ---------------------------------------------------------------------------
  // Silence VAD calculations
  // ---------------------------------------------------------------------------

  it('correctly runs VAD and tracks RMS metrics', async () => {
    const mockVoiceSM = new MockVoiceSessionManager() as unknown as IVoiceSessionManager;
    const twilioSM = new TwilioVoiceSessionManager();
    const metrics = new TwilioMetricsCollector();
    const logger = new TwilioAuditLogger(() => {});
    
    const receivedEvents: any[] = [];

    const handler = new TwilioMediaStreamHandler(
      { silenceThresholdDb: -45, silenceDurationMs: 50 },
      mockVoiceSM,
      twilioSM,
      metrics,
      logger,
      (event) => {
        receivedEvents.push(event);
      },
    );

    handler.init('sess-1', 'tenant-1');
    twilioSM.createSession('sess-1', 'call-1', 'tenant-1', null);

    // Push standard silence payload (0xff is maximum quietness in mu-law)
    const silentChunk = Buffer.alloc(160, 0xff).toString('base64');

    await handler.handleFrame({
      event: 'media',
      streamSid: 'stream-1',
      media: {
        track: 'inbound',
        chunk: silentChunk,
        timestamp: '20',
      },
    });

    expect(handler.getLastRms()).toBeLessThan(100); // Silence RMS should be close to 0

    // Allow time skew and trigger silence duration VAD callback
    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    await handler.handleFrame({
      event: 'media',
      streamSid: 'stream-1',
      media: {
        track: 'inbound',
        chunk: silentChunk,
        timestamp: '40',
      },
    });

    const silenceEvent = receivedEvents.find((e) => e.type === 'silence.detected');
    expect(silenceEvent).toBeDefined();
  });
});
