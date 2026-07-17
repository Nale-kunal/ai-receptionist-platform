/**
 * Twilio Voice Provider — Media Stream Handler
 *
 * Decodes mu-law audio, calculates volume RMS/decibels, detects silence,
 * and normalizes frames.
 */

import type { AudioFrame } from '../../types/voice-server.types';
import type { TwilioNormalizedEvent } from './twilio.types';
import { TwilioAudioStream } from './twilio.audio.stream';
import { TwilioEventRouter } from './twilio.event.router';
import { TwilioMetricsCollector } from './twilio.metrics.collector';
import { TwilioAuditLogger } from './twilio.audit.logger';
import { TWILIO_CALL_STATE_STREAMING, TWILIO_CALL_STATE_ENDED } from './twilio.constants';
import { TwilioVoiceSessionManager } from './twilio.voice-session.manager';
import type { IVoiceSessionManager } from '../../interfaces/voice-server.interfaces';

export class TwilioMediaStreamHandler {
  private sessionId = '';
  private tenantId = '';
  private sequence = 0;
  private silenceStartTime: number | null = null;
  private isSilent = false;
  private lastRms = 0;

  private readonly audioStream = new TwilioAudioStream();
  private readonly eventRouter = new TwilioEventRouter();

  constructor(
    private readonly config: { silenceThresholdDb: number; silenceDurationMs: number },
    private readonly voiceSessionManager: IVoiceSessionManager,
    private readonly twilioSessionManager: TwilioVoiceSessionManager,
    private readonly metricsCollector: TwilioMetricsCollector,
    private readonly auditLogger: TwilioAuditLogger,
    private readonly onNormalizedEvent: (event: TwilioNormalizedEvent) => void,
  ) {}

  public init(sessionId: string, tenantId: string): void {
    this.sessionId = sessionId;
    this.tenantId = tenantId;
  }

  public async handleFrame(message: Record<string, unknown>): Promise<void> {
    const event = String(message['event']);
    const streamSid = String(message['streamSid'] ?? '');

    if (event === 'media') {
      const normalized = await this.eventRouter.routeMediaStream(streamSid, message);
      if (normalized && normalized.type === 'media.frame') {
        const payloadStr = String(normalized.payload['payload']);
        const timestamp = parseInt(String(normalized.payload['timestamp']), 10);
        
        // 1. Inbound PCM audio frame compilation
        const frame = await this.audioStream.pushInbound(
          payloadStr,
          this.sequence++,
          timestamp,
        );

        this.metricsCollector.trackPacketReceived();

        // 2. Silence detection calculation
        this.runSilenceDetection(frame.payload);

        // Forward to system
        this.onNormalizedEvent(normalized);
      }
    } else if (event === 'stop') {
      const normalized = await this.eventRouter.routeMediaStream(streamSid, message);
      if (normalized) {
        this.onNormalizedEvent(normalized);
      }

      this.audioStream.close(this.sessionId);

      // Transition voice session state to ended
      const twilioSession = this.twilioSessionManager.getSession(this.sessionId);
      if (twilioSession) {
        await this.voiceSessionManager.updateSessionState(
          this.sessionId,
          this.tenantId,
          TWILIO_CALL_STATE_ENDED,
        );
        this.twilioSessionManager.updateState(this.sessionId, TWILIO_CALL_STATE_ENDED);
        this.auditLogger.logCallEnded(this.sessionId, Date.now() - twilioSession.createdAt);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Silence Detection (PCMU / Mu-Law G.711 decoder + RMS + DB mapping)
  // ---------------------------------------------------------------------------

  private runSilenceDetection(payload: Buffer): void {
    let sumSquares = 0;
    const len = payload.length;

    for (let i = 0; i < len; i++) {
      const sample16 = this.mulawToLinear(payload[i]!);
      sumSquares += sample16 * sample16;
    }

    const rms = Math.sqrt(sumSquares / len);
    this.lastRms = rms;

    // Map RMS amplitude to dB (0dB is full scale linear 32768)
    const db = rms > 0 ? 20 * Math.log10(rms / 32768) : -100;

    const isCurrentlySilent = db < this.config.silenceThresholdDb;

    if (isCurrentlySilent) {
      if (this.silenceStartTime === null) {
        this.silenceStartTime = Date.now();
      } else {
        const silentDuration = Date.now() - this.silenceStartTime;
        if (silentDuration >= this.config.silenceDurationMs && !this.isSilent) {
          this.isSilent = true;
          this.metricsCollector.trackSilence();
          
          this.onNormalizedEvent({
            type: 'silence.detected',
            sessionId: this.sessionId,
            timestamp: Date.now(),
            payload: { db, durationMs: silentDuration },
          });
        }
      }
    } else {
      this.silenceStartTime = null;
      this.isSilent = false;
    }
  }

  private mulawToLinear(ulaw: number): number {
    ulaw = ~ulaw;
    const sign = (ulaw & 0x80);
    const exponent = (ulaw & 0x70) >> 4;
    const mantissa = ulaw & 0x0f;
    let sample = (mantissa << 3) + 132;
    if (exponent > 0) {
      sample <<= (exponent - 1);
    } else {
      sample >>= 1;
    }
    sample -= 132;
    return sign ? -sample : sample;
  }

  public getLastRms(): number {
    return this.lastRms;
  }
}
