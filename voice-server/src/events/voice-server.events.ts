/**
 * Voice Server Domain Events
 */

export const EVENT_VOICE_SESSION_CREATED       = 'voice.session.created'       as const;
export const EVENT_VOICE_SESSION_CONNECTED     = 'voice.session.connected'     as const;
export const EVENT_VOICE_SESSION_STREAMING     = 'voice.session.streaming'     as const;
export const EVENT_VOICE_SESSION_ENDED         = 'voice.session.ended'         as const;
export const EVENT_VOICE_SESSION_FAILED        = 'voice.session.failed'        as const;
export const EVENT_VOICE_AUDIO_RECEIVED        = 'voice.audio.received'        as const;
export const EVENT_VOICE_AUDIO_SENT            = 'voice.audio.sent'            as const;
export const EVENT_VOICE_PROVIDER_CONNECTED    = 'voice.provider.connected'    as const;
export const EVENT_VOICE_PROVIDER_DISCONNECTED  = 'voice.provider.disconnected'  as const;

export interface VoiceSessionCreatedEvent {
  type: typeof EVENT_VOICE_SESSION_CREATED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    provider: string;
    providerCallId: string;
    occurredAt: Date;
  };
}

export interface VoiceSessionConnectedEvent {
  type: typeof EVENT_VOICE_SESSION_CONNECTED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    occurredAt: Date;
  };
}

export interface VoiceSessionStreamingEvent {
  type: typeof EVENT_VOICE_SESSION_STREAMING;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    streamState: string;
    occurredAt: Date;
  };
}

export interface VoiceSessionEndedEvent {
  type: typeof EVENT_VOICE_SESSION_ENDED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    durationMs: number;
    occurredAt: Date;
  };
}

export interface VoiceSessionFailedEvent {
  type: typeof EVENT_VOICE_SESSION_FAILED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    errorCode: string;
    errorMessage: string;
    occurredAt: Date;
  };
}

export interface VoiceAudioReceivedEvent {
  type: typeof EVENT_VOICE_AUDIO_RECEIVED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    sequence: number;
    sizeBytes: number;
    codec: string;
    durationMs: number;
    occurredAt: Date;
  };
}

export interface VoiceAudioSentEvent {
  type: typeof EVENT_VOICE_AUDIO_SENT;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    sequence: number;
    sizeBytes: number;
    codec: string;
    occurredAt: Date;
  };
}

export interface VoiceProviderConnectedEvent {
  type: typeof EVENT_VOICE_PROVIDER_CONNECTED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    provider: string;
    occurredAt: Date;
  };
}

export interface VoiceProviderDisconnectedEvent {
  type: typeof EVENT_VOICE_PROVIDER_DISCONNECTED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    provider: string;
    reason?: string;
    occurredAt: Date;
  };
}

export type VoiceServerDomainEvent =
  | VoiceSessionCreatedEvent
  | VoiceSessionConnectedEvent
  | VoiceSessionStreamingEvent
  | VoiceSessionEndedEvent
  | VoiceSessionFailedEvent
  | VoiceAudioReceivedEvent
  | VoiceAudioSentEvent
  | VoiceProviderConnectedEvent
  | VoiceProviderDisconnectedEvent;

export interface IVoiceServerEventPublisher {
  publish(event: VoiceServerDomainEvent): Promise<void>;
  subscribe(
    eventType: VoiceServerDomainEvent['type'],
    handler: (event: VoiceServerDomainEvent) => void | Promise<void>
  ): void;
}

export class InProcessVoiceServerEventPublisher implements IVoiceServerEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: any) => void | Promise<void>>
  > = new Map();

  public subscribe(
    eventType: VoiceServerDomainEvent['type'],
    handler: (event: any) => void | Promise<void>
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: VoiceServerDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // Non-fatal logging
        console.error(`[VoiceServer] Event handler failed for ${event.type}:`, err);
      }
    }
  }
}
