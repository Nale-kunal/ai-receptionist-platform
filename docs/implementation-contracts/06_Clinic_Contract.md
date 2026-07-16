# Clinic Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Clinic Domain

---

# Purpose

This document defines the Clinic domain.

The Clinic is the primary business entity of the platform.

Every patient, appointment, doctor, conversation, AI interaction, calendar, and notification belongs to exactly one clinic.

The Clinic module owns clinic identity only.

Operational behavior (business hours, AI settings, appointment duration, branding, etc.) is owned by the Configuration module.

---

# Responsibilities

The Clinic module SHALL manage:

- Clinic identity
- Contact information
- Subscription association
- Ownership
- Status
- Lifecycle
- Metadata

The Clinic module SHALL NOT manage:

- Doctors
- Patients
- Appointments
- Conversations
- Business hours
- AI prompts
- Voice settings
- Calendar settings
- Notifications

These belong to their respective modules.

---

# Ownership

Each clinic owns:

- Doctors
- Patients
- Appointments
- Conversations
- AI Sessions
- Calendar Connections
- Notifications
- Configuration
- Audit Records

Every owned resource SHALL reference its parent clinic.

---

# Clinic Identity

Each clinic SHALL have:

Internal ID

Public ID

Display Name

Legal Name (optional)

Slug

Timezone

Country

Status

Created At

Updated At

Deleted At (soft delete)

---

# Contact Information

The clinic may contain:

Primary Email

Primary Phone

Website

Address

City

State

Postal Code

Country

Emergency Contact (future)

---

# Ownership Model

Each clinic SHALL have one Owner.

The Owner is responsible for:

- Initial setup
- Subscription
- Billing (future)
- User invitations
- Administrative control

Ownership transfer SHALL be supported.

---

# Lifecycle

Clinic lifecycle:

Created

↓

Active

↓

Suspended

↓

Archived

↓

Deleted

Business rules SHALL validate lifecycle transitions.

---

# Status

Supported statuses:

Pending Setup

Active

Suspended

Archived

Deleted

Inactive clinics SHALL not process appointments or AI conversations.

---

# Tenant Relationship

One Tenant

↓

One or More Clinics

Every clinic belongs to exactly one tenant.

Cross-tenant movement is prohibited.

---

# Configuration Relationship

Every clinic SHALL have exactly one active configuration.

Configuration is managed by the Configuration module.

The Clinic module only stores the relationship.

---

# Subscription Relationship

The Clinic module stores:

Subscription ID

Plan ID

Subscription Status

Business logic belongs to the Subscription module (future).

---

# Doctor Relationship

One Clinic

↓

Many Doctors

Clinic never stores doctor information directly.

---

# Patient Relationship

One Clinic

↓

Many Patients

Patient ownership belongs to the Patient module.

---

# Appointment Relationship

One Clinic

↓

Many Appointments

Appointments reference the clinic.

The Clinic module does not manage scheduling.

---

# Conversation Relationship

One Clinic

↓

Many Conversations

Conversation storage belongs to the Conversation module.

---

# Calendar Relationship

One Clinic

↓

One Calendar Configuration

Calendar synchronization belongs to the Calendar module.

---

# AI Relationship

One Clinic

↓

Many AI Sessions

AI behavior is configured through the Configuration module.

---

# Branding

The Clinic module stores only:

Clinic Name

Logo Reference

Brand Identifier

Brand assets themselves are managed separately.

---

# Public Identifier

External APIs SHALL use Public IDs.

Internal database IDs SHALL remain internal.

---

# Validation Rules

Display Name

Required

Slug

Required

Timezone

Required

Country

Required

Status

Required

Owner

Required

Validation SHALL occur before persistence.

---

# Security

Every clinic operation requires:

Authentication

Authorization

Tenant validation

Ownership validation where applicable

Audit logging

---

# Audit Events

Audit:

Clinic Created

Clinic Updated

Clinic Suspended

Clinic Reactivated

Clinic Archived

Clinic Deleted

Ownership Changed

Each event SHALL include:

Actor

Clinic

Timestamp

Request ID

---

# Soft Delete

Clinics SHALL support soft deletion.

Soft-deleted clinics:

Cannot authenticate

Cannot receive calls

Cannot schedule appointments

Cannot create AI sessions

Historical data remains available according to retention policy.

---

# Performance

Clinic lookup SHALL support:

Public ID

Slug

Owner

Tenant

Indexes SHALL exist for frequently queried fields.

---

# Future Compatibility

The Clinic module SHALL support:

Multiple locations

Franchises

Enterprise organizations

White-label deployments

Regional deployments

No redesign should be required.

---

# Testing Requirements

Verify:

Clinic creation

Validation

Ownership

Status transitions

Tenant isolation

Soft deletion

Public ID lookup

Audit logging

---

# Definition of Done

The Clinic module is complete only when:

CRUD implemented

Validation implemented

Authorization implemented

Tenant isolation verified

Audit logging implemented

Soft delete implemented

Tests passing

Documentation updated

Security review completed

---

# Guiding Principle

The Clinic module owns clinic identity.

It does not own clinic behavior.