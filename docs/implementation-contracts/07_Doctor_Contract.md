# Doctor Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Doctor Domain

---

# Purpose

This document defines the Doctor domain.

The Doctor module manages healthcare providers who offer appointments within a clinic.

A doctor represents an individual professional who can receive bookings through the AI Receptionist.

The Doctor module owns doctor identity and availability relationships.

It SHALL NOT own appointment scheduling logic.

---

# Responsibilities

The Doctor module SHALL manage:

- Doctor identity
- Professional information
- Status
- Clinic relationship
- Calendar relationship
- Availability relationship
- Metadata

The Doctor module SHALL NOT manage:

- Patients
- Appointments
- Conversations
- AI prompts
- Business hours
- Notifications
- Billing

---

# Ownership

Each doctor belongs to exactly one clinic.

Each clinic may have multiple doctors.

Cross-clinic ownership is prohibited.

---

# Doctor Identity

Each doctor SHALL have:

Internal ID

Public ID

Clinic ID

Full Name

Display Name

Specialization

License Number (optional)

Profile Photo (optional)

Email

Phone

Status

Created At

Updated At

Deleted At

---

# Status

Supported statuses:

Active

Inactive

Unavailable

Archived

Deleted

Only Active doctors may receive appointments.

---

# Clinic Relationship

One Clinic

↓

Many Doctors

The Clinic module owns the relationship.

The Doctor module references the clinic.

---

# Appointment Relationship

One Doctor

↓

Many Appointments

Appointments belong to the Appointment module.

The Doctor module SHALL NOT schedule appointments directly.

---

# Calendar Relationship

One Doctor

↓

One Calendar Connection (optional)

Calendar synchronization is owned by the Calendar module.

---

# Availability

Availability SHALL be determined by:

Doctor Status

↓

Clinic Configuration

↓

Calendar Availability

↓

Existing Appointments

The Doctor module SHALL NOT calculate scheduling conflicts.

---

# Contact Information

A doctor may contain:

Email

Phone

Professional Title

Biography (optional)

Profile Image Reference

---

# Public Identifier

External APIs SHALL expose Public IDs only.

Internal IDs remain private.

---

# Validation Rules

Required:

Clinic ID

Full Name

Display Name

Status

Optional:

License Number

Biography

Phone

Email

Validation SHALL occur before persistence.

---

# Security

Every doctor operation requires:

Authentication

Authorization

Tenant validation

Clinic ownership validation

Audit logging

---

# Audit Events

Audit:

Doctor Created

Doctor Updated

Doctor Activated

Doctor Deactivated

Doctor Archived

Doctor Deleted

Clinic Changed (if supported)

Each audit record SHALL include:

Actor

Clinic

Doctor

Timestamp

Request ID

---

# Soft Delete

Doctors SHALL support soft deletion.

Soft-deleted doctors:

Cannot receive appointments

Cannot appear in availability searches

Historical appointment references remain valid.

---

# Search

The platform SHALL support searching doctors by:

Public ID

Clinic

Display Name

Status

Specialization

---

# Performance

Indexes SHOULD exist for:

Clinic ID

Public ID

Status

Display Name

Specialization

---

# Future Compatibility

The Doctor module SHALL support:

Multiple specializations

Multiple clinic locations

Working schedules

Telehealth

Departments

Professional credentials

Without architectural redesign.

---

# Testing Requirements

Verify:

Doctor creation

Validation

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

The Doctor module is complete only when:

CRUD implemented

Validation implemented

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

The Doctor module owns doctor identity.

Appointment scheduling belongs to the Appointment module.