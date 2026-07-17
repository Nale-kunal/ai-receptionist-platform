# ADR-0019: Webhook Validation Required for Twilio Provider

**Status**: Accepted  
**Date**: 2026-07-17

## Context

Twilio webhooks are exposed as public HTTP endpoints (`/webhooks/voice/inbound`, etc.) so Twilio can send call setups and status updates. If these endpoints are not authenticated, an attacker could send spoofed calls, trigger concurrent runs to cause denial of service (DoS), or gain access to internal session handlers.

## Decision

Every incoming HTTP request to the Twilio webhook controller MUST validate the signature and request integrity before executing any logic:

1. **Signature Verification**: Validate `X-Twilio-Signature` using node's native `crypto` HMAC-SHA1 signature verification with the Twilio Auth Token.
2. **Timestamp Validation**: Verify the request timestamp window skew is within +/- 5 minutes of local time to prevent replay window attacks.
3. **Replay Cache**: Validate that the unique signature hash has not been previously received within the sliding replay protection window cache.
4. **Immediate Rejection**: Any validation failure results in an immediate `401 Unauthorized` response with zero information disclosure.

## Alternatives Considered

1. **IP Range Whitelisting**: Rejected. Twilio IP ranges are broad, change occasionally, and are easily spoofed if not combined with signature checks.
2. **Bearer Token Headers**: Rejected. Twilio does not natively support static bearer tokens on standard webhook callback configurations.

## Consequences

- Improved security guarantees at the perimeter.
- All webhook handler routes must parse and retain the raw request body to allow accurate signature calculation.
