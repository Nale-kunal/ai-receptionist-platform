# Data Flow Architecture

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# 1. Purpose

This document defines how information flows through the AI Receptionist SaaS Platform.

The objective is to ensure:

- Predictable behavior
- Consistent ownership
- Security
- Observability
- Scalability
- Fault tolerance

Every workflow in the platform must follow the principles defined in this document.

---

# 2. Data Flow Philosophy

Data moves through clearly defined stages.

Business logic never jumps between modules.

Every state change is intentional.

Every transition is auditable.

Every failure is recoverable.

---

# 3. High-Level System Flow

```
                    Customer

                       │

                 Phone Call

                       │

                       ▼

                   Twilio

                       │

                       ▼

              Voice Server (Node.js)

                       │

             Audio Stream (WebSocket)

                       │

                       ▼

           OpenAI GPT-4o Realtime

                       │

             Structured Intent

                       │

                       ▼

                Backend API

                       │

      ┌────────────────┼─────────────────┐

      ▼                ▼                 ▼

 Business Rules   PostgreSQL     Google Calendar

      │

      ▼

      n8n Automations

      │

      ▼

 Voice Response Returned

      │

      ▼

      Caller
```

---

# 4. Voice Conversation Flow

```
Incoming Call

↓

Twilio

↓

Media Stream

↓

Voice Server

↓

OpenAI Realtime

↓

Intent Detection

↓

Entity Extraction

↓

Backend Validation

↓

Business Rules

↓

Database

↓

AI Response

↓

Speech

↓

Twilio

↓

Caller
```

---

# 5. AI Decision Flow

```
Speech

↓

Speech Recognition

↓

Conversation Context

↓

Prompt Construction

↓

AI Reasoning

↓

Structured Output

↓

Validation

↓

Business Rules

↓

Approved Action

↓

Response Generation
```

The AI MUST never directly execute actions.

---

# 6. Appointment Booking Flow

```
Patient Requests Booking

↓

AI Extracts

Name

Phone

Preferred Date

Preferred Time

↓

Backend Validation

↓

Tenant Resolution

↓

Patient Lookup

↓

Doctor Availability

↓

Business Hours

↓

Holiday Check

↓

Conflict Detection

↓

Transaction

↓

Appointment Created

↓

Calendar Synchronization

↓

SMS Queued

↓

Conversation Updated

↓

Response Generated
```

---

# 7. Appointment Rescheduling Flow

```
Caller

↓

Existing Appointment Lookup

↓

Ownership Validation

↓

New Slot Validation

↓

Availability Check

↓

Transaction

↓

Update Appointment

↓

Calendar Update

↓

Notification

↓

Response
```

---

# 8. Appointment Cancellation Flow

```
Caller

↓

Appointment Lookup

↓

Validation

↓

Cancellation Rules

↓

Transaction

↓

Appointment Cancelled

↓

Calendar Updated

↓

Notification Queued

↓

Conversation Closed
```

---

# 9. FAQ Flow

```
Caller Question

↓

Conversation Context

↓

Clinic Prompt

↓

Knowledge Base

↓

AI Response

↓

Caller
```

No database modification occurs.

---

# 10. Returning Caller Flow

```
Incoming Call

↓

Phone Number

↓

Tenant Resolution

↓

Patient Lookup

↓

Conversation History

↓

Conversation Context

↓

AI Greeting

↓

Continue Conversation
```

---

# 11. Dashboard Request Flow

```
Browser

↓

JWT

↓

Backend

↓

Authentication

↓

Authorization

↓

Tenant Resolution

↓

Business Logic

↓

Database

↓

Response
```

---

# 12. Authentication Flow

```
Login

↓

Validation

↓

Password Verification

↓

Generate JWT

↓

Generate Refresh Token

↓

Persist Session

↓

Return Tokens
```

---

# 13. Refresh Token Flow

```
Refresh Token

↓

Validation

↓

Rotation

↓

Revoke Old Token

↓

Issue New Token

↓

Return Access Token
```

---

# 14. AI Request Flow

```
Conversation

↓

Prompt Builder

↓

Tenant Prompt

↓

Conversation Memory

↓

Knowledge Base

↓

OpenAI

↓

Structured Response

↓

Validation

↓

Business Rules
```

---

# 15. Google Calendar Flow

```
Appointment Created

↓

Calendar Adapter

↓

Google Calendar

↓

Success

↓

Database Updated
```

Failure

```
Appointment Created

↓

Calendar Adapter

↓

Failure

↓

Retry Queue

↓

Audit

↓

Continue
```

Appointment creation MUST NOT fail because Google Calendar is unavailable.

---

# 16. Notification Flow

```
Business Event

↓

Notification Queue

↓

SMS Provider

↓

Delivery Status

↓

Database

↓

Audit
```

---

# 17. n8n Automation Flow

```
Business Event

↓

Webhook

↓

n8n

↓

Workflow

↓

External Provider

↓

Callback

↓

Backend
```

Business logic MUST remain inside the backend.

---

# 18. AI Prompt Flow

```
Tenant

↓

Prompt Version

↓

Business Rules

↓

Conversation Context

↓

Knowledge Base

↓

Prompt Builder

↓

OpenAI
```

Prompts must never be hardcoded.

---

# 19. Voice Session Lifecycle

```
Call Started

↓

Media Stream Connected

↓

Conversation Created

↓

Realtime Session

↓

Business Operations

↓

Conversation Completed

↓

Summary Generated

↓

Call Ended

↓

Session Archived
```

---

# 20. Error Recovery Flow

```
Failure

↓

Categorize

↓

Retry?

↓

Yes

↓

Exponential Backoff

↓

Success

↓

Continue

No

↓

Audit

↓

Alert

↓

Graceful Failure
```

---

# 21. Transaction Flow

```
Business Request

↓

Validation

↓

Database Transaction

↓

Commit

↓

Publish Events

↓

Queue Async Work

↓

Return Success
```

If transaction fails

↓

Rollback

↓

Return Error

No events published.

---

# 22. Data Ownership Flow

```
Incoming Request

↓

Resolve Tenant

↓

Resolve Aggregate

↓

Validate Ownership

↓

Execute Business Logic
```

Ownership validation is mandatory.

---

# 23. Observability Flow

Every request produces:

```
Request ID

↓

Logs

↓

Metrics

↓

Trace

↓

Audit

↓

Dashboard
```

Every operation must be traceable.

---

# 24. Failure Domains

Failures must remain isolated.

Examples

Google Calendar failure

↓

Appointment still exists.

Twilio failure

↓

Conversation saved.

OpenAI timeout

↓

Graceful retry or fallback.

SMS failure

↓

Booking remains valid.

---

# 25. Common Mistakes

Do NOT

- Let AI update the database.
- Let Twilio become the source of truth.
- Store business state in n8n.
- Skip tenant resolution.
- Mix transport logic with business logic.
- Couple external providers with core modules.
- Perform long-running operations synchronously.

---

# 26. Acceptance Criteria

The data flow architecture is correct if:

- Every workflow follows a defined sequence.
- Ownership is validated.
- Business rules execute before state changes.
- Events are published after successful commits.
- External failures do not corrupt business data.
- Every request is observable.
- Every workflow is recoverable.

---

# 27. Guiding Principle

Data flows through the platform in one direction:

Input

↓

Validation

↓

Business Rules

↓

Persistence

↓

Events

↓

Integrations

↓

Response

No workflow may bypass this sequence.