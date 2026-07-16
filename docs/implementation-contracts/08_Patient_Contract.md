# Patient Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Patient Domain

---

# Purpose

This document defines the Patient domain.

The Patient module manages individuals who interact with a clinic through the AI Receptionist.

A patient may call, book appointments, reschedule appointments, cancel appointments, and communicate with the clinic.

The Patient module owns patient identity.

It SHALL NOT own appointment scheduling or conversation processing.

---

# Responsibilities

The Patient module SHALL manage:

- Patient identity
- Contact information
- Status
- Clinic relationship
- Communication preferences
- Metadata

The Patient module SHALL NOT manage:

- Appointment scheduling
- AI conversations
- Calendar synchronization
- Notifications
- Billing
- Authentication

---

# Ownership

Each patient belongs to exactly one clinic.

A clinic may have many patients.

Cross-clinic ownership is prohibited.

---

# Patient Identity

Each patient SHALL have:

Internal ID

Public ID

Clinic ID

Full Name

Primary Phone Number

Email (optional)

Date of Birth (optional)

Gender (optional)

Preferred Language

Status

Created At

Updated At

Deleted At

---

# Status

Supported statuses:

Active

Inactive

Blocked

Archived

Deleted

Only Active patients may create new appointments.

---

# Contact Information

Each patient SHALL have:

Primary Phone Number

Optional Email

Preferred Contact Method

Preferred Language

Future fields SHALL remain optional.

---

# Appointment Relationship

One Patient

↓

Many Appointments

Appointments belong to the Appointment module.

The Patient module SHALL NOT create or modify appointments directly.

---

# Conversation Relationship

One Patient

↓

Many Conversations

Conversation ownership belongs to the Conversation module.

---

# Notification Relationship

One Patient

↓

Many Notifications

Notification delivery belongs to the Notification module.

---

# Communication Preferences

Supported preferences:

SMS

Email

Phone

Future communication methods SHALL be configurable.

---

# Duplicate Detection

Patients SHALL be uniquely identified within a clinic.

Primary identifier:

Phone Number

Secondary identifier:

Email (optional)

Duplicate detection SHALL occur before creating a new patient.

---

# Public Identifier

External APIs SHALL expose Public IDs only.

Internal IDs remain private.

---

# Validation Rules

Required:

Clinic ID

Full Name

Primary Phone Number

Status

Preferred Language

Optional:

Email

Date of Birth

Gender

Validation SHALL occur before persistence.

---

# Security

Every patient operation requires:

Authentication

Authorization

Tenant validation

Clinic ownership validation

Audit logging

Patient information SHALL be treated as Confidential.

---

# Audit Events

Audit:

Patient Created

Patient Updated

Patient Archived

Patient Deleted

Patient Blocked

Patient Reactivated

Each audit record SHALL include:

Actor

Clinic

Patient

Timestamp

Request ID

---

# Soft Delete

Patients SHALL support soft deletion.

Soft-deleted patients:

Cannot create new appointments

Cannot initiate new conversations

Historical records SHALL remain available according to retention policy.

---

# Search

The platform SHALL support searching patients by:

Public ID

Phone Number

Full Name

Email

Status

Clinic

---

# Performance

Indexes SHOULD exist for:

Clinic ID

Public ID

Primary Phone Number

Status

Full Name

---

# Future Compatibility

The Patient module SHALL support:

Patient tags

Emergency contacts

Multiple phone numbers

Multiple email addresses

Patient notes

Additional profile information

Without architectural redesign.

---

# Testing Requirements

Verify:

Patient creation

Validation

Duplicate detection

Clinic ownership

Status transitions

Soft deletion

Public ID lookup

Search

Audit logging

Authorization

Tenant isolation

---

# Definition of Done

The Patient module is complete only when:

CRUD implemented

Validation implemented

Duplicate detection implemented

Authorization implemented

Tenant isolation verified

Audit logging implemented

Soft delete implemented

Search implemented

Tests passing

Documentation updated

Security review completed

---

# Guiding Principle

The Patient module owns patient identity.

Appointments and conversations reference the patient but remain owned by their respective modules.