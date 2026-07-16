# Bounded Context Architecture

**Project:** AI Receptionist SaaS Platform

**Version:** 1.0.0

**Status:** Approved

**Priority:** Critical

---

# 1. Purpose

This document defines the bounded contexts of the AI Receptionist SaaS Platform.

Bounded contexts define ownership boundaries.

Every business capability belongs to exactly one bounded context.

No bounded context should own another context's business rules.

This document is the authoritative source for module ownership.

---

# 2. What is a Bounded Context?

A bounded context is an independently understandable business capability.

Inside a bounded context:

- Terminology is consistent.
- Business rules are self-contained.
- Data ownership is clear.
- APIs are well-defined.
- Dependencies are explicit.

Outside the context:

Communication happens only through contracts.

---

# 3. Why Bounded Contexts?

Without bounded contexts, software becomes tightly coupled.

Example:

Appointment directly modifies Notification.

Notification directly modifies Conversation.

Conversation directly modifies Patient.

Patient directly modifies Analytics.

Eventually:

Everything depends on everything.

The system becomes impossible to maintain.

Bounded contexts prevent this.

---

# 4. Architecture Philosophy

The AI Receptionist Platform is implemented as a Modular Monolith.

Each module behaves like an independent service.

Future migration to microservices should require moving modules rather than rewriting them.

---

# 5. High-Level Context Map

```
                    Platform

                       │

        ┌──────────────┼──────────────┐

        ▼              ▼              ▼

 Authentication    Tenant        Configuration

        │              │              │

        └──────┬───────┴───────┬──────┘

               ▼               ▼

          Clinic Context   AI Context

               │               │

      ┌────────┴───────┐       │

      ▼                ▼       ▼

Appointment      Conversation  Voice

      │                │

      ▼                ▼

 Calendar       Notification

      │

      ▼

 Analytics
```

---

# 6. Context List

The platform contains the following bounded contexts.

Core

- Authentication
- Authorization
- Tenant
- Clinic

Business

- Patient
- Doctor
- Appointment
- Conversation

AI

- AI Provider
- Prompt Management
- Voice

Infrastructure

- Calendar
- Notification
- Storage
- Telephony

Platform

- Analytics
- Audit
- Settings
- Feature Flags

Future

- Billing
- Marketplace
- CRM
- Reporting

---

# 7. Authentication Context

Purpose

Identity verification.

Owns

- Login
- Logout
- Password
- Refresh Tokens
- Sessions
- Email Verification
- OAuth

Does NOT own

Users.

Users belong to User Management.

Authentication only proves identity.

---

# 8. Authorization Context

Purpose

Permission evaluation.

Owns

Roles.

Permissions.

Policies.

Never owns authentication.

---

# 9. Tenant Context

Purpose

Tenant lifecycle.

Owns

Tenant creation.

Subscription.

Limits.

Feature Flags.

Isolation.

No other context may determine tenant ownership.

---

# 10. Clinic Context

Purpose

Business configuration.

Owns

Business Hours.

Timezone.

Clinic Profile.

Services.

Voice Settings.

Prompt Assignment.

Doctors.

Calendar Configuration.

---

# 11. Patient Context

Purpose

Customer records.

Owns

Patient identity.

Patient profile.

Patient preferences.

Patient history.

Does NOT own appointments.

Appointments belong to Appointment Context.

---

# 12. Doctor Context

Purpose

Appointment resources.

Owns

Availability.

Working hours.

Appointment duration.

Vacation.

Calendar assignment.

---

# 13. Appointment Context

Purpose

Scheduling engine.

Owns

Booking.

Cancellation.

Rescheduling.

Conflict detection.

Availability.

Business validation.

Appointment lifecycle.

No other context may directly create appointments.

---

# 14. Conversation Context

Purpose

Conversation history.

Owns

Transcript.

Summary.

Outcome.

Intent.

Entities.

Recording Reference.

Conversation state.

Conversation analytics.

---

# 15. AI Context

Purpose

Language intelligence.

Owns

Prompt execution.

Intent detection.

Entity extraction.

Conversation reasoning.

AI provider abstraction.

AI Context NEVER modifies business state.

---

# 16. Voice Context

Purpose

Phone call lifecycle.

Owns

Media streams.

Voice sessions.

Speech buffering.

Voice interruptions.

Realtime streaming.

Call state.

Never owns appointments.

---

# 17. Calendar Context

Purpose

External calendar synchronization.

Owns

Google Calendar.

Future Outlook.

Future Exchange.

Future CalDAV.

Calendar Context never becomes the source of truth.

---

# 18. Notification Context

Purpose

Outbound communication.

Owns

SMS.

Email.

Future WhatsApp.

Future Push.

Notification failures must never roll back appointments.

---

# 19. Analytics Context

Purpose

Business metrics.

Owns

Reports.

KPIs.

Usage.

Performance.

Analytics never affects transactional operations.

---

# 20. Audit Context

Purpose

Immutable history.

Stores

Who.

When.

What.

Where.

Never editable.

Never deleted.

---

# 21. Settings Context

Purpose

Tenant configuration.

Owns

Feature toggles.

Provider selection.

Business configuration.

Voice preferences.

Prompt versions.

Settings should never require deployment.

---

# 22. Feature Flag Context

Purpose

Enable and disable platform functionality.

Examples

SMS.

Voice Recording.

AI.

Beta Features.

Premium Features.

Flags should be runtime configurable.

---

# 23. Context Communication Rules

Contexts communicate only through:

- Service interfaces
- Domain events
- Published contracts

Forbidden:

Repository sharing.

Database table sharing.

Direct entity modification.

Internal implementation access.

---

# 24. Dependency Direction

Allowed

```
Controller

↓

Service

↓

Context Interface

↓

Context Implementation
```

Forbidden

```
Appointment

↓

Conversation Repository

↓

Database
```

Appointment must call Conversation through its public interface.

---

# 25. Data Ownership

Every business entity has one owner.

Examples

Patient

Owned by Patient Context.

Conversation

Owned by Conversation Context.

Appointment

Owned by Appointment Context.

No shared ownership.

---

# 26. Event Ownership

Every domain event belongs to exactly one context.

Examples

AppointmentBooked

Appointment Context.

ConversationCompleted

Conversation Context.

PatientCreated

Patient Context.

---

# 27. Future Microservices

Every bounded context should be extractable into an independent service.

Target migration effort:

Less than one week.

This is achieved through:

Interface boundaries.

Dependency inversion.

No database shortcuts.

No shared repositories.

---

# 28. Common Mistakes

Do NOT

- Let AI directly create appointments.
- Let Conversation update Patient records.
- Let Notification change Appointment status.
- Let Analytics own business rules.
- Let Calendar become the source of truth.
- Let Voice own conversation history.
- Let repositories cross context boundaries.
- Share database tables between contexts.

---

# 29. Acceptance Criteria

The architecture satisfies this document if:

- Every business capability belongs to exactly one bounded context.
- Every entity has one owner.
- Contexts communicate only through defined contracts.
- No circular dependencies exist.
- Business rules remain isolated.
- Future microservice extraction is possible without rewriting core logic.

---

# 30. Guiding Principle

A bounded context owns business knowledge, not just code.

If two contexts need to change together for every feature, the boundaries are incorrect and must be reviewed.