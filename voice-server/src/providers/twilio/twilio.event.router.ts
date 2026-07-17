/**
 * Twilio Voice Provider — Event Router
 *
 * Normalizes provider raw webhook and media socket frames into generic events.
 */

import type { TwilioNormalizedEvent } from './twilio.types';
import type { ITwilioEventRouter } from './twilio.interfaces';
import { PayloadValidationFailure } from './twilio.errors';

export class TwilioEventRouter implements ITwilioEventRouter {
  public async routeWebhook(
    callSid: string,
    body: Record<string, unknown>,
  ): Promise<TwilioNormalizedEvent> {
    const status = String(body['CallStatus'] ?? 'ringing').toLowerCase();
    let type: TwilioNormalizedEvent['type'] = 'call.ringing';

    if (status === 'in-progress') {
      type = 'call.answered';
    } else if (status === 'completed') {
      type = 'call.ended';
    } else if (status === 'failed' || status === 'busy' || status === 'no-answer') {
      type = 'call.failed';
    }

    return {
      type,
      sessionId: callSid, // The callSid functions as the session identifier initially
      timestamp: Date.now(),
      payload: { ...body },
    };
  }

  public async routeMediaStream(
    streamSid: string,
    message: Record<string, unknown>,
  ): Promise<TwilioNormalizedEvent | null> {
    const event = String(message['event']);

    switch (event) {
      case 'connected':
        return {
          type: 'media.connected',
          sessionId: streamSid,
          timestamp: Date.now(),
          payload: { ...message },
        };
      case 'start':
        return {
          type: 'media.connected',
          sessionId: streamSid,
          timestamp: Date.now(),
          payload: { ...message },
        };
      case 'media': {
        const media = message['media'] as Record<string, unknown> | undefined;
        if (!media) {
          throw new PayloadValidationFailure('Media frame missing payload details.');
        }
        return {
          type: 'media.frame',
          sessionId: streamSid,
          timestamp: Date.now(),
          payload: {
            payload: String(media['chunk']),
            timestamp: parseInt(String(media['timestamp']), 10),
            track: String(media['track']),
          },
        };
      }
      case 'stop':
        return {
          type: 'media.disconnected',
          sessionId: streamSid,
          timestamp: Date.now(),
          payload: { ...message },
        };
      default:
        // Ignore custom parameters or heartbeats at event router level
        return null;
    }
  }
}
