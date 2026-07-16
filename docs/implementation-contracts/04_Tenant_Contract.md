# Tenant Contract

Version: 1.0.0

Status: Active

Authority: Multi-Tenant Architecture

---

# Purpose

This document defines the tenant architecture for the AI Receptionist SaaS Platform.

A Tenant represents one customer organization.

Examples:

- Smile Dental Clinic
- Bright Smiles
- Elite Dental Care

Every business resource belongs to exactly one tenant unless explicitly documented otherwise.

Tenant isolation is mandatory.

---

# Objectives

The tenant architecture SHALL provide:

- Complete data isolation
- Independent configuration
- Independent AI behavior
- Independent appointments
- Independent calendars
- Independent telephony
- Independent branding
- Independent subscriptions

The platform must support thousands of tenants without architectural redesign.

---

# Definition

Tenant

↓

Owns

Clinic(s)

↓

Owns

Doctors

Patients

Appointments

Conversations

Business Hours

AI Configuration

Calendar Connections

Telephony Connections

Users

Notifications

Analytics

Every business entity belongs to one tenant.

---

# Tenant Identity

Every tenant contains:

- UUIDv7 ID
- Public ID
- Name
- Slug
- Status
- Timezone
- Country
- Language
- Subscription Plan
- Branding
- Metadata

Public IDs should be human-friendly.

Example

tenant_01JXXXXXXX

---

# Tenant Lifecycle

Created

↓

Provisioned

↓

Active

↓

Suspended

↓

Archived

↓

Deleted (administrative only)

Soft deletion is preferred.

---

# Tenant Resolution

Every incoming request MUST resolve its tenant before business logic.

Resolution order:

1. JWT
2. Twilio phone number mapping
3. API key
4. Webhook mapping
5. Explicit route parameter (admin only)

Failure to resolve a tenant SHALL terminate the request.

---

# Tenant Ownership

Every persistent entity MUST contain:

tenantId

Examples

Clinic

Doctor

Patient

Appointment

Conversation

Notification

Prompt

Business Hours

Holiday

Audit Entry

Usage Record

No exceptions unless explicitly documented.

---

# Tenant Isolation

Every database query MUST include tenant filtering.

Correct

WHERE tenant_id = ?

Incorrect

SELECT * FROM appointments

Repositories SHALL never expose unscoped queries for tenant-owned data.

---

# Tenant Context

After authentication, the platform establishes a Tenant Context containing:

- Tenant ID
- Clinic ID (if applicable)
- User ID
- Role
- Permissions
- Timezone
- Locale

Services receive Tenant Context instead of resolving tenant information repeatedly.

---

# Tenant Configuration

Each tenant manages its own configuration.

Examples

Business Hours

AI Prompt

Greeting

Voice

Language

Timezone

Holiday Schedule

Appointment Duration

Booking Rules

Notification Preferences

Calendar Provider

Telephony Provider

Configuration changes affect only that tenant.

---

# AI Configuration

Each tenant owns:

System Prompt

Greeting

Tone

Supported Language

Voice

Fallback Responses

Business Rules

Prompt Version

Prompt changes require no deployment.

---

# Calendar Configuration

Each tenant may configure:

Google Calendar

Future Outlook Calendar

Future Exchange

Future CalDAV

Calendar configuration is isolated.

---

# Telephony Configuration

Each tenant may configure:

Twilio Number

Future Telnyx

Future Vonage

Future Plivo

Provider credentials are encrypted.

---

# Subscription Awareness

Tenant limits are determined by subscription.

Examples

Maximum users

Maximum doctors

Maximum monthly calls

Maximum AI minutes

Maximum appointments

Feature availability

Business logic must enforce subscription limits.

---

# Branding

Each tenant may customize:

Logo

Primary Color

Secondary Color

Email Branding

Voice Greeting

Clinic Name

Website

Branding affects only presentation.

---

# Suspension

Suspended tenants:

Cannot log in

Cannot receive calls

Cannot create appointments

Cannot access APIs

Historical data remains intact.

---

# Data Export

Tenants may export their own data.

Exports must include only tenant-owned records.

Exports shall be auditable.

---

# Data Deletion

Deletion requests must follow configured retention policies.

Deletion should:

Soft delete immediately.

Hard delete only after retention period expires and legal obligations permit.

---

# Security Requirements

Tenant IDs are server-controlled.

Clients must never choose tenant ownership.

Cross-tenant queries are prohibited.

Cross-tenant authorization is prohibited.

Provider credentials are encrypted.

Every privileged tenant operation is audited.

---

# Performance Considerations

Tenant ID must be indexed.

Composite indexes should include tenant ID when appropriate.

Example

tenant_id + created_at

tenant_id + status

tenant_id + doctor_id

---

# Scalability

The architecture shall support:

10,000+ tenants

Millions of appointments

Millions of conversations

Horizontal scaling

Read replicas

Future regional deployments

Future database partitioning

without changing business logic.

---

# Monitoring

Track:

Active tenants

Suspended tenants

Provisioning failures

Subscription usage

Storage usage

API usage

Voice usage

AI usage

Calendar synchronization

---

# Audit Requirements

Audit:

Tenant creation

Tenant suspension

Configuration changes

Subscription changes

Branding updates

Provider changes

Administrative actions

Every audit entry includes:

Actor

Tenant ID

Request ID

Timestamp

Action

---

# Future Compatibility

Architecture shall support:

White-label deployments

Multiple clinic locations

Regional data residency

Enterprise plans

Partner-managed tenants

without redesign.

---

# Definition of Done

The tenant subsystem is complete only when:

Tenant resolution implemented

Tenant context implemented

Repository tenant filtering enforced

Cross-tenant isolation verified

Subscription limits enforced

Configuration isolation verified

Provider isolation verified

Audit logging implemented

Performance indexes created

Tests passing

Documentation updated

Security review passed

---

# Guiding Principle

A tenant represents an independent business.

Every request, every entity, every configuration item, and every business rule must execute within the correct tenant boundary.

Tenant isolation is never optional.