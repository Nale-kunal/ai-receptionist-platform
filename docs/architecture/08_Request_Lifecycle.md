# Request Lifecycle Architecture

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# 1. Purpose

This document defines the lifecycle of every request processed by the platform.

A request may originate from:

- Web Dashboard
- Mobile Browser
- Backend API
- Twilio Voice Webhook
- Twilio Status Callback
- OpenAI Realtime
- Google Calendar
- n8n
- Internal Background Jobs
- Scheduled Tasks
- Future External Integrations

Every request MUST follow the same architectural lifecycle regardless of origin.

Consistency is more important than convenience.

---

# 2. Architecture Philosophy

A request should never directly modify business state.

Instead, it must pass through a standardized processing pipeline.

Benefits:

- Predictable behavior
- Consistent security
- Easer debugging
- Better auditing
- Easier testing
- Lower maintenance cost

---

# 3. Standard Request Lifecycle

Every request follows this sequence.

```
Incoming Request

↓

Request ID Generation

↓

Correlation ID Resolution

↓

Logging Context

↓

Authentication

↓

Authorization

↓

Tenant Resolution

↓

Request Validation

↓

Rate Limiting

↓

Business Rule Validation

↓

Transaction

↓

Database Changes

↓

Audit Log

↓

Domain Events

↓

Async Jobs

↓

Response

↓

Metrics

↓

Structured Logs
```

No step may be skipped unless explicitly documented.

---

# 4. Step 1 — Request Arrival

Every request begins at an entry point.

Examples

REST API

Webhook

WebSocket

Internal Event

Background Worker

The entry point must contain no business logic.

Responsibilities:

- Accept request
- Forward request
- Initialize context

---

# 5. Step 2 — Request ID

Every request MUST receive:

Request ID

Example

```
req_01J4N7...
```

Purpose:

- Logging
- Debugging
- Tracing
- Support

Never reuse Request IDs.

---

# 6. Step 3 — Correlation ID

If a request is part of a larger workflow, preserve its Correlation ID.

Example

Patient Calls

↓

Appointment Created

↓

SMS Sent

↓

Calendar Updated

↓

Analytics Recorded

All operations share one Correlation ID.

---

# 7. Step 4 — Logging Context

Before processing begins, initialize logging context.

Include:

- Request ID
- Correlation ID
- Tenant ID (if known)
- User ID (if known)
- IP Address
- User Agent
- Timestamp

Sensitive values MUST be redacted.

---

# 8. Step 5 — Authentication

Determine caller identity.

Possible identities:

Authenticated User

Anonymous Patient

Twilio

Google

n8n

OpenAI Callback

System Process

Authentication only proves identity.

It does not grant permissions.

---

# 9. Step 6 — Authorization

Verify permissions.

Examples

Receptionist

↓

Can create appointment

Patient

↓

Cannot access dashboard

Platform Admin

↓

Can manage tenants

Every protected action requires authorization.

---

# 10. Step 7 — Tenant Resolution

Determine tenant before business logic executes.

Priority:

Twilio Number

↓

API Key

↓

JWT

↓

Webhook Mapping

↓

Configuration

Tenant resolution failure MUST terminate processing.

---

# 11. Step 8 — Validation

Validate transport layer.

Examples

JSON schema

Headers

Required fields

Formats

Phone numbers

Email

Dates

UUIDs

Validation MUST occur before business logic.

---

# 12. Step 9 — Rate Limiting

Apply rate limiting.

Examples

Authentication

AI endpoints

Webhook endpoints

Public APIs

Dashboard APIs

Different endpoints require different limits.

---

# 13. Step 10 — Business Rule Validation

Examples

Business Hours

Doctor Availability

Duplicate Booking

Clinic Holidays

Subscription Limits

Appointment Duration

Business rules belong only here.

---

# 14. Step 11 — Transaction

If state changes occur:

Start transaction.

All related operations succeed together.

Or fail together.

Never leave partial state.

---

# 15. Step 12 — Database

Database modifications occur only inside transactions.

Never update database outside service layer.

Repositories perform persistence only.

---

# 16. Step 13 — Audit

Every important operation generates immutable audit records.

Examples

Appointment Created

Prompt Updated

User Deleted

Permissions Changed

Audit logging failures should not silently pass.

---

# 17. Step 14 — Domain Events

Business events published.

Examples

AppointmentBooked

ConversationCompleted

NotificationQueued

Events describe facts.

Events never contain business logic.

---

# 18. Step 15 — Async Jobs

Operations that should not delay responses.

Examples

SMS

Email

Analytics

Calendar Retry

Conversation Summary

Jobs execute asynchronously.

---

# 19. Step 16 — Response

Responses must be standardized.

Success

```
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Failure

```
{
  "success": false,
  "error": {},
  "requestId": "",
  "timestamp": ""
}
```

No endpoint may invent its own response format.

---

# 20. Step 17 — Metrics

Record:

Duration

Database Queries

AI Latency

Calendar Latency

Twilio Latency

Response Size

Errors

Metrics should never affect user experience.

---

# 21. Step 18 — Structured Logging

Finalize request log.

Include:

Result

Duration

Tenant

Module

Action

Outcome

Never log secrets.

Never log passwords.

Never log API keys.

---

# 22. Voice Request Lifecycle

```
Incoming Call

↓

Twilio

↓

Voice Server

↓

Authentication

↓

Tenant Resolution

↓

Conversation Context

↓

OpenAI Realtime

↓

Intent Extraction

↓

Backend API

↓

Business Validation

↓

Database

↓

Calendar

↓

Events

↓

Voice Response

↓

Caller
```

The Voice Server MUST never own business rules.

---

# 23. Dashboard Request Lifecycle

```
React

↓

JWT

↓

Backend

↓

Authentication

↓

Authorization

↓

Validation

↓

Business Logic

↓

Database

↓

Audit

↓

Response
```

---

# 24. Webhook Lifecycle

Every webhook MUST verify:

Source

Signature

Timestamp

Replay Protection

Tenant

Schema

Business Rules

Then execute.

---

# 25. Failure Strategy

Failures should be categorized.

Client

↓

4xx

Server

↓

5xx

External Provider

↓

Retry

Business Rule

↓

Reject

Unexpected

↓

Alert

Never expose internal errors.

---

# 26. Common Mistakes

Do NOT

- Skip validation.
- Skip tenant resolution.
- Skip audit logging.
- Let controllers access repositories.
- Let AI update database.
- Return inconsistent responses.
- Swallow exceptions.
- Log secrets.
- Execute async jobs inside transactions.

---

# 27. Acceptance Criteria

The request lifecycle is correctly implemented if:

- Every request follows the documented sequence.
- Every request receives a Request ID.
- Every protected action performs authentication and authorization.
- Every state change is transactional.
- Every important action is audited.
- Responses are standardized.
- Metrics are recorded.
- Logs are structured.

---

# 28. Guiding Principle

The lifecycle of a request is part of the platform architecture.

Individual modules MAY extend the lifecycle.

They MUST NOT bypass or shorten it.