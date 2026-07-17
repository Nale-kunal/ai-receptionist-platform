# ADR-0018: Twilio Voice Provider as a Plugin

**Status**: Accepted  
**Date**: 2026-07-17

## Context

The platform must support receiving real-time voice call streams and status webhook updates from telephony providers (specifically Twilio) to perform AI Receptionist functions. 
A key architecture goal is that the core system must be strictly decoupled from provider-specific formats (e.g. Twilio markup syntax, JSON payloads, or stream wrappers), allowing future additions of alternative providers (like Plivo, Telnyx, or standard SIP) without touching core system components.

## Decision

The Twilio Voice Provider will be implemented as a **fully self-contained, isolated transport plugin** under `voice-server/src/providers/twilio/`. 

- It implements the core `IVoiceProvider` interface.
- It contains no business logic (e.g. clinic settings, patients, calendars).
- It remains completely decoupled from database repositories and AI logic.
- It translates and normalizes vendor-specific parameters on-the-fly inside the module boundary.
- The external API interface only exposes the class `TwilioVoiceProvider` to outside modules.

## Alternatives Considered

1. **Direct Express handling in Voice Server core**: Rejected. This couples the core voice server to Twilio webhooks, violating provider agnosticism.
2. **Dedicated Microservice**: Rejected. While horizontally scalable, it introduces networking serialization overhead and deployment complexity. Keeping it as a provider module inside `voice-server` maintains standard vertical clean interfaces.

## Consequences

- Alternative telephony providers can be registered in the factory without impact.
- Changes to Twilio's webhook signatures or payload schemas only require edits inside the isolated `providers/twilio/` folder.
