# Database Principles

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# Purpose

This document defines the architectural principles governing the data layer.

It does NOT define tables.

It defines HOW data must be designed.

Every future schema must comply with these principles.

---

# Database Philosophy

The database is the most valuable asset of the platform.

Application code can be rewritten.

Infrastructure can be replaced.

The database cannot be casually redesigned after production.

Therefore:

Design the data model for the next ten years rather than today's MVP.

---

# Database Goals

The database must provide:

- Data Integrity
- Multi-tenancy
- Scalability
- Auditability
- Security
- Performance
- Extensibility
- Consistency

---

# Source of Truth

PostgreSQL is the only source of truth.

External systems (Google Calendar, Twilio, OpenAI, n8n) are integrations.

They never become authoritative.

---

# Multi-Tenancy

Every business record belongs to exactly one tenant unless explicitly documented otherwise.

Examples:

Appointments

Patients

Doctors

Users

Prompts

Analytics

Conversations

Notifications

Settings

Every query must filter by Tenant ID.

Tenant isolation is mandatory.

---

# Identifier Strategy

Internal identifiers:

UUID Version 7

Reasons:

- Globally unique
- Ordered
- Distributed-friendly
- Replication-friendly
- Enumeration resistant

Never use auto-increment integers.

---

# Public Identifiers

Every externally exposed resource receives a public identifier.

Examples:

clinic_...

patient_...

appointment_...

conversation_...

doctor_...

These identifiers are stable.

Internal UUIDs remain private.

---

# Entity Metadata

Every business entity should include:

id

publicId

tenantId

createdAt

updatedAt

createdBy

updatedBy

deletedAt

version

metadata

This standardization simplifies maintenance.

---

# Time

Store timestamps only in UTC.

Never store local time.

Every tenant stores its own timezone separately.

Display time is converted at the application layer.

---

# Naming Convention

Tables:

snake_case

Columns:

snake_case

Prisma Models:

PascalCase

Properties:

camelCase

Consistency is mandatory.

---

# Soft Delete

Business records must not be physically deleted.

Use:

deleted_at

instead.

Benefits:

Audit

Recovery

Compliance

History

Only temporary or cache tables may allow hard deletion.

---

# Auditability

Every important modification should be traceable.

Critical operations:

Appointment changes

User changes

Prompt changes

Permissions

Clinic settings

Authentication events

Audit data should never be editable.

---

# Versioning

Every mutable entity includes:

version

Purpose:

Optimistic concurrency control.

Prevent lost updates.

Support future synchronization.

---

# Optimistic Locking

Concurrent updates must fail safely.

Never silently overwrite changes.

The client must retry after reading the latest state.

---

# Relationships

Use foreign keys.

Never rely only on application code.

Database constraints remain the final line of defense.

---

# Referential Integrity

Prefer:

RESTRICT

or

SET NULL

Avoid:

CASCADE DELETE

unless explicitly justified.

Historical data must not disappear accidentally.

---

# Normalization

Target:

Third Normal Form (3NF)

Denormalization allowed only after performance analysis.

Never duplicate business data prematurely.

---

# Transactions

Every operation modifying multiple entities must use transactions.

Examples:

Booking

Rescheduling

Cancellation

Conversation completion

Prompt updates

Transactions must preserve consistency.

---

# Constraints

Use:

NOT NULL

UNIQUE

CHECK

FOREIGN KEY

ENUM

where appropriate.

Never rely solely on backend validation.

---

# Indexing Philosophy

Indexes are mandatory for:

Foreign keys

Tenant ID

Public IDs

Search fields

Frequently filtered columns

Frequently sorted columns

Composite indexes preferred for tenant-aware queries.

---

# Encryption

Sensitive fields must support encryption.

Examples:

Patient phone numbers

Emails

API credentials

Secrets

Encryption should occur before persistence.

---

# Search

Design for future full-text search.

Do not prematurely implement search infrastructure.

Schema should remain compatible.

---

# JSON Usage

Use JSONB only when:

Data structure is dynamic.

Examples:

metadata

provider responses

feature configuration

Avoid storing structured relational data inside JSON.

---

# Provider Independence

Provider-specific data must remain isolated.

Never allow Twilio, Google, or OpenAI data structures to leak into core business entities.

---

# Migrations

Schema changes must be:

Incremental

Reversible

Versioned

Reviewed

Never modify production data manually.

---

# Backup Strategy

Architecture must support:

Automated backups

Point-in-time recovery

Disaster recovery

Backup verification

---

# Data Retention

Different entities require different retention policies.

Examples:

Audit Logs

Long retention.

Voice Sessions

Short retention.

Conversation metadata

Medium retention.

Policies should remain configurable.

---

# Compliance

Architecture should support:

HIPAA-ready design

GDPR-aware design

CCPA-aware design

SOC2-friendly architecture

Compliance requirements influence schema design.

---

# Performance

Design for:

Millions of conversations

Millions of appointments

Thousands of clinics

Avoid schema patterns that require redesign during growth.

---

# Database Guiding Principle

The schema should model the business.

The application should adapt to the schema.

Never distort the data model merely to simplify application code.