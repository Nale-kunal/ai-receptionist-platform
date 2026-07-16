# Event Architecture

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# 1. Purpose

This document defines the event-driven architecture of the platform.

Events enable loose coupling between bounded contexts while preserving clear ownership of business operations.

Events describe facts.

They never describe intentions.

---

# 2. Event Philosophy

Business operations produce events.

Events represent something that has already happened.

Examples

Correct

AppointmentBooked

ConversationCompleted

PatientCreated

ClinicUpdated

Wrong

BookAppointment

CreateConversation

UpdatePatient

Commands belong to services.

Events belong to the business.

---

# 3. Why Event Architecture?

Without events

Appointment Module

↓

Notification Module

↓

Analytics Module

↓

Calendar Module

↓

SMS Module

↓

Email Module

↓

AI Module

Every dependency increases coupling.

With events

Appointment Module

↓

AppointmentBooked Event

↓

Notification

Analytics

Calendar

Billing

Future Integrations

The Appointment Module remains unaware of downstream consumers.

---

# 4. Event Categories

Domain Events

Represent business facts.

Integration Events

Used when communicating with external systems.

System Events

Represent platform operations.

Audit Events

Represent security and compliance actions.

---

# 5. Domain Events

Examples

TenantCreated

ClinicCreated

DoctorCreated

PatientCreated

AppointmentBooked

AppointmentCancelled

AppointmentRescheduled

ConversationStarted

ConversationCompleted

PromptUpdated

BusinessHoursChanged

NotificationQueued

NotificationSent

VoiceSessionStarted

VoiceSessionEnded

UserInvited

UserActivated

RoleAssigned

PermissionChanged

---

# 6. Event Ownership

Every event belongs to exactly one bounded context.

Example

AppointmentBooked

Owner

Appointment Context

Notification Context may consume it.

Analytics Context may consume it.

Calendar Context may consume it.

Ownership never changes.

---

# 7. Event Naming

Use past tense.

Correct

AppointmentBooked

PatientCreated

ConversationCompleted

Incorrect

BookAppointment

CreatePatient

UpdateConversation

Events describe completed business facts.

---

# 8. Event Structure

Every event MUST contain

Event ID

Event Type

Event Version

Occurred At

Tenant ID

Correlation ID

Request ID

Actor

Payload

Metadata

Future consumers should never depend on implementation details.

---

# 9. Event Flow

Example

Patient calls clinic

↓

ConversationStarted

↓

ConversationCompleted

↓

AppointmentBooked

↓

CalendarSynchronizationRequested

↓

CalendarSynchronizationCompleted

↓

NotificationQueued

↓

NotificationSent

↓

AnalyticsUpdated

Each event represents one completed fact.

---

# 10. Publishing Rules

Events MUST be published only after the transaction commits successfully.

Never publish an event before database consistency is guaranteed.

If the transaction rolls back,

No event is published.

---

# 11. Consuming Rules

Consumers MUST

Validate payload

Validate tenant ownership

Handle duplicates safely

Log processing

Fail gracefully

Consumers MUST NOT

Modify unrelated aggregates

Assume execution order beyond documented guarantees

Depend on side effects

---

# 12. Event Idempotency

Every consumer MUST be idempotent.

If the same event is processed twice,

The outcome must remain correct.

Examples

Sending two appointment confirmations is unacceptable.

Creating two appointments is unacceptable.

Updating analytics twice is unacceptable.

---

# 13. Ordering

Ordering is guaranteed only within a single aggregate where explicitly documented.

Consumers must not assume global ordering.

---

# 14. Retry Strategy

Transient failures

Retry with exponential backoff.

Permanent failures

Dead-letter queue (future architecture).

Retries must never violate idempotency.

---

# 15. Event Versioning

Every event includes a version.

Future payload changes must create new versions.

Consumers should remain backward compatible whenever possible.

---

# 16. Security

Events must never contain:

Passwords

API Keys

Refresh Tokens

OAuth Tokens

Secrets

Raw Prompt Data

Sensitive medical notes unless explicitly required

Personally identifiable information should be minimized.

---

# 17. Event Storage

Important domain events should be persisted for audit and debugging.

Examples

AppointmentBooked

AppointmentCancelled

ConversationCompleted

Security events

Authentication events

---

# 18. Internal vs External Events

Internal

Used inside the platform.

External

Used for integrations.

Internal event structures should never leak directly to external APIs.

---

# 19. Future Event Bus

MVP

In-process event dispatcher.

Future

Kafka

RabbitMQ

Azure Service Bus

Google Pub/Sub

The publishing interface should remain provider-independent.

---

# 20. Common Mistakes

Do NOT

Publish events before transactions commit.

Treat commands as events.

Expose secrets in payloads.

Assume all consumers succeed.

Create circular event chains.

Depend on event processing order unnecessarily.

Allow events to modify aggregate ownership.

---

# 21. Acceptance Criteria

The event architecture is correct if:

Every business fact is represented by a domain event.

Events are immutable.

Events are versioned.

Consumers are idempotent.

Publishing occurs after successful commits.

Bounded contexts remain loosely coupled.

---

# 22. Guiding Principle

Events communicate what happened.

Services decide what should happen.

Never confuse the two.