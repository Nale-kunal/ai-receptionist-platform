# Database Relationship Architecture

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# 1. Purpose

This document defines how business entities relate to one another.

Relationships exist to model the business—not to simplify implementation.

The relationship model is the canonical reference for all database schemas, ORM models, repositories, APIs, and business logic.

---

# 2. Scope

This specification covers:

- Entity ownership
- Cardinality
- Aggregate boundaries
- Referential integrity
- Transaction boundaries
- Lifecycle dependencies
- Cross-context interaction
- Future extensibility

---

# 3. Definitions

## Aggregate Root

The entry point through which all changes to an aggregate occur.

Example:

Appointment is an Aggregate Root.

Conversation is an Aggregate Root.

Patient is an Aggregate Root.

Child entities must never be modified directly from outside their aggregate.

---

## Ownership

Ownership defines which aggregate controls another entity's lifecycle.

Ownership is not the same as a foreign key.

---

## Association

An association represents a reference between two aggregates.

Associations should be minimized.

---

# 4. Business Context

A real dental clinic naturally contains relationships:

Tenant

↓

Clinic

↓

Doctors

↓

Patients

↓

Appointments

↓

Conversations

↓

Notifications

↓

Analytics

The database must reflect these business relationships.

---

# 5. Architecture Decision

The platform SHALL use aggregate ownership based on Domain-Driven Design.

Every aggregate root owns its invariants.

No aggregate may modify another aggregate directly.

Cross-aggregate communication occurs through:

- Services
- Domain Events
- Published Interfaces

Never through repository shortcuts.

---

# 6. Alternatives Considered

### Option A — Shared Mutable Entities

Rejected.

Reason:

- High coupling
- Hidden dependencies
- Difficult testing
- Poor scalability

### Option B — Aggregate Ownership

Selected.

Reason:

- Clear ownership
- Strong consistency
- Easier maintenance
- Easier future microservices

---

# 7. Tenant Relationships

```
Tenant

├── Clinics

├── Users

├── Doctors

├── Patients

├── Appointments

├── Conversations

├── Notifications

├── AI Prompts

├── Business Hours

├── Holidays

├── Feature Flags

├── Calendar Connections

├── Telephony Connections

├── Analytics
```

Cardinality

Tenant → Clinics

1:N

Tenant → Users

1:N

Tenant → Doctors

1:N

Tenant → Patients

1:N

Tenant → Appointments

1:N

Tenant → Conversations

1:N

Every business entity MUST belong to exactly one tenant.

---

# 8. Clinic Relationships

Clinic owns:

- Business Hours
- Holidays
- Voice Configuration
- Calendar Configuration
- AI Configuration

Doctors belong to a clinic.

Patients do not.

Patients belong to the tenant because they may visit multiple clinic locations in the future.

---

# 9. Patient Relationships

Patient

↓

Appointments

1:N

Patient

↓

Conversations

1:N

Patient

↓

Notes (Future)

1:N

Patients never own appointments.

Appointments reference patients.

---

# 10. Doctor Relationships

Doctor

↓

Appointments

1:N

Doctor

↓

Calendar Connection

1:1

Doctor

↓

Availability Rules

1:N

---

# 11. Appointment Relationships

Appointment

↓

Patient

N:1

Appointment

↓

Doctor

N:1

Appointment

↓

Conversation

0:1

Appointment

↓

Audit Entries

1:N

Appointment

↓

Calendar Synchronization

1:N

Appointments never own patients.

Appointments reference patients.

---

# 12. Conversation Relationships

Conversation

↓

Patient

N:1

Conversation

↓

Appointment

0:1

Conversation

↓

AI Session

1:1 (temporary)

Conversation

↓

Voice Session

1:1 (temporary)

Conversation

↓

Transcript

1:1

Conversation

↓

Summary

1:1

Conversation is the historical source of interaction data.

---

# 13. User Relationships

User

↓

Roles

N:M

Role

↓

Permissions

N:M

Never hardcode permissions inside users.

---

# 14. AI Prompt Relationships

Tenant

↓

Prompt Versions

1:N

Prompt Version

↓

Conversation

Referenced only.

Conversations should record which prompt version generated the interaction.

---

# 15. Calendar Relationships

Clinic

↓

Calendar Connection

1:N

Doctor

↓

Calendar

0:1

Appointment

↓

Calendar Event

0:1

Google Calendar is an external representation only.

---

# 16. Notification Relationships

Notification

↓

Conversation

0:1

Notification

↓

Appointment

0:1

Notification

↓

Patient

N:1

Notifications should remain independent.

Deleting an appointment must not delete notification history.

---

# 17. Audit Relationships

Audit Log

↓

Actor

N:1

Audit Log

↓

Entity Reference

N:1

Audit logs reference entities but never own them.

Audit logs are append-only.

---

# 18. Cascade Strategy

Default

RESTRICT

Preferred

SET NULL where business rules permit.

Avoid

CASCADE DELETE

Historical information must survive.

---

# 19. Transaction Boundaries

A single transaction may include:

Appointment

Conversation Update

Audit Entry

Outbox/Event Record

It MUST NOT include:

SMS delivery

Email delivery

Calendar retry

Analytics aggregation

These execute asynchronously after commit.

---

# 20. Aggregate Boundaries

Aggregate Roots

- Tenant
- Clinic
- User
- Patient
- Doctor
- Appointment
- Conversation
- Notification
- AI Prompt

Only aggregate roots expose public behavior.

---

# 21. Cross-Context Rules

Forbidden

Appointment Repository

↓

Conversation Repository

Allowed

Appointment Service

↓

Conversation Service Interface

Context boundaries must remain explicit.

---

# 22. Security Considerations

Every relationship query MUST include tenant ownership validation.

Foreign keys do not replace authorization.

Never rely solely on ORM relationships.

---

# 23. Performance Considerations

Relationships should minimize:

N+1 queries

Deep joins

Circular loading

Lazy loading is preferred for large object graphs.

---

# 24. Scalability Considerations

Relationships should support:

Millions of appointments

Millions of conversations

Thousands of tenants

Future read replicas

Future sharding

Future microservices

No redesign should be necessary.

---

# 25. Operational Considerations

Database integrity checks should verify:

Orphaned records

Broken references

Invalid ownership

Missing audit references

Operational tooling should detect inconsistencies automatically.

---

# 26. Common Mistakes

Do NOT

- Share repositories across bounded contexts.
- Cascade-delete historical business records.
- Allow AI to create relationships directly.
- Couple Google Calendar IDs with appointment identity.
- Use ORM convenience methods that bypass business rules.
- Model UI relationships instead of business relationships.

---

# 27. Acceptance Criteria

The relationship model is correct if:

- Every entity has one owner.
- Cardinality is explicitly defined.
- Aggregate boundaries are respected.
- Referential integrity is enforced.
- Cross-context communication uses interfaces or events.
- Historical data remains intact.

---

# 28. Future Evolution

The relationship model should support:

- Multi-location clinics
- Group practices
- Shared specialists
- Additional receptionist products
- CRM integrations
- Billing
- Reporting
- Multi-region deployments

No fundamental redesign should be required.

---

# 29. Guiding Principle

Relationships exist to model business reality.

The application must adapt to the relationship model.

Never distort the domain to simplify implementation.