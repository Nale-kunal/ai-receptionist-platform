# Twilio Voice Provider Module

## Overview

This module implements the Twilio transport integration for the Voice Server, adhering to `docs/architecture/ARCHITECTURE_FREEZE_v1.md`.

It isolates all vendor-specific schemas, URL-encoded webhook formats, and TwiML generators, presenting only normalized events and PCM audio frames to the upstream voice server.

---

## Directory Structure

```text
providers/twilio/
├── twilio.constants.ts          # Default codecs, timings, route paths
├── twilio.types.ts              # WebSocket and session structure declarations
├── twilio.errors.ts             # Exception hierarchy mapping
├── twilio.interfaces.ts         # Internal module contracts
├── twilio.config.ts             # Environment variable loader
├── twilio.validators.ts         # Payload schema checks (Express & WS)
├── twilio.dto.ts                # DTO mappings
├── twilio.security.validator.ts # Webhook signature validation & replay cache
├── twilio.audio.stream.ts       # PCMU/mu-law conversions and streaming
├── twilio.voice-session.manager.ts # SIDs mapping registry
├── twilio.call.lifecycle.ts     # State machine validations
├── twilio.event.router.ts       # Vendor event normalization
├── twilio.metrics.collector.ts  # Throughput and latency telemetry
├── twilio.audit.logger.ts       # Log sanitation with number masking
├── twilio.webhook.controller.ts # Express endpoints controller
├── twilio.webhook.routes.ts     # Express routes registrations
├── twilio.websocket.gateway.ts   # WebSocket gateway listening for Media Streams
├── twilio.media-stream.handler.ts # Connection handler parsing packets
├── index.ts                     # Barrel exports
└── README.md                    # This file
```

---

## Architecture Flow

```
Customer Call
      │
      ▼
 Twilio Carrier
      │  HTTP Post inbound call callback
      ▼
TwilioWebhookController   ──[Verify Signature & Skew]──► Create SafeVoiceSession
      │
      ▼  Returns TwiML Connect Stream XML
  Customer Phone
      │
      ▼  Establishes WebSocket stream
TwilioWebsocketGateway
      │
      ▼
TwilioMediaStreamHandler  ──[Convert PCMU → AudioFrame]──► Emits silence VAD / events
      │
      ▼  Normalized pipeline
   Voice Server Core
```

---

## Security Model

### Webhook Validation
The signature check matches the calculated SHA1 HMAC of the URL + concatenated POST parameters using the Twilio Auth Token as a secret key, comparing it to the `X-Twilio-Signature` header.

### Replay & Skew Safety
- Timestamps must fall within the clock skew window of +/- 5 minutes.
- Previously verified signatures are recorded in a sliding replay cache window and blocked upon duplicate submissions.

### Audit Privacy
Structured log entries mask sensitive caller identifiers (e.g. `+120*****54`) and filter API tokens.

---

## Observability & Metrics

Tracks active/concurrent calls, stream latencies, dropped packets, reconnect frequencies, and circuit-breaker states. Fits into the existing standard metrics framework.

---

## Future Telephony Compatibility

Decoupled cleanly via the factory. Alternative providers (like Telnyx or Browser WebRTC) can register under alternative types with zero core modifications.
