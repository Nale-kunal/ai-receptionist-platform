# Calendar Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Calendar Domain

---

# Purpose

This document defines the Calendar domain.

The Calendar module synchronizes appointments between the platform and external calendar providers.

The Calendar module SHALL NOT become the source of truth.

PostgreSQL remains the only source of truth.

Calendar providers are synchronization targets.

---

# Responsibilities

The Calendar module SHALL manage:

- Calendar connections
- OAuth credentials
- Calendar synchronization
- Event creation
- Event updates
- Event deletion
- Sync status
- Sync history
- Webhook processing

The Calendar module SHALL NOT manage:

- Appointment business rules
- Appointment validation
- Availability calculation
- Patient identity
- Doctor identity

---

# Supported Providers

Current

Google Calendar

Future

Microsoft Outlook

Microsoft Exchange

Apple Calendar (CalDAV)

Custom Calendar Providers

The architecture SHALL remain provider-independent.

---

# Calendar Ownership

Each calendar connection belongs to exactly:

One Tenant

↓

One Clinic

↓

Optional Doctor

Cross-tenant calendar sharing is prohibited.

---

# Calendar Connection

Each connection SHALL contain:

Internal ID

Public ID

Tenant ID

Clinic ID

Doctor ID (optional)

Provider

Calendar ID

Connection Status

Last Sync Time

Created At

Updated At

---

# Connection Status

Supported statuses:

Pending

Connected

Disconnected

Expired

Error

Disabled

Only Connected calendars participate in synchronization.

---

# Synchronization Model

PostgreSQL

↓

Calendar Module

↓

Provider Adapter

↓

External Calendar

The Calendar module SHALL never accept provider data as authoritative without validation.

---

# Synchronization Events

Supported synchronization events:

Appointment Created

Appointment Updated

Appointment Cancelled

Appointment Deleted

Calendar Connected

Calendar Disconnected

Webhook Received

Manual Sync

Automatic Sync

---

# Appointment Synchronization

When an appointment changes:

Appointment Module

↓

Publish Event

↓

Calendar Module

↓

Provider Adapter

↓

External Calendar

Synchronization failures SHALL NOT roll back appointment creation.

---

# Incoming Webhooks

Provider webhooks SHALL:

Validate signature

↓

Validate provider

↓

Validate tenant

↓

Map external event

↓

Update synchronization state

↓

Publish internal event if required

Incoming changes SHALL be validated before affecting business data.

---

# Conflict Resolution

If synchronization conflicts occur:

PostgreSQL remains authoritative.

Provider state SHALL be updated to match the platform unless explicitly configured otherwise.

---

# OAuth Credentials

OAuth credentials SHALL:

Be encrypted

Be rotatable

Never appear in logs

Never be exposed to the frontend

Be managed according to the Secrets Management policy.

---

# Sync Failures

Failures SHALL:

Be logged

Be retried

Generate audit events

Expose monitoring metrics

Repeated failures SHALL mark the connection as Error.

---

# Retry Policy

Temporary failures SHALL be retried.

Permanent failures SHALL require administrator action.

Retry configuration SHALL be configurable.

---

# Availability

Calendar data MAY be used to assist availability calculations.

Final appointment validation SHALL always occur in the Appointment module.

---

# Security

Every calendar operation requires:

Authentication

Authorization

Tenant validation

Clinic validation

Webhook verification

Audit logging

Encrypted provider credentials

---

# Audit Events

Audit:

Calendar Connected

Calendar Disconnected

Synchronization Started

Synchronization Completed

Synchronization Failed

Webhook Processed

Credential Updated

Each audit record SHALL include:

Actor

Tenant

Clinic

Provider

Timestamp

Request ID

---

# Performance

Indexes SHOULD exist for:

Tenant ID

Clinic ID

Doctor ID

Provider

Connection Status

Last Sync Time

Public ID

---

# Future Compatibility

The Calendar module SHALL support:

Multiple calendars per clinic

Multiple calendars per doctor

Read-only calendars

Two-way synchronization (optional)

Regional providers

Without architectural redesign.

---

# Testing Requirements

Verify:

Calendar connection

OAuth flow

Synchronization

Conflict resolution

Retry policy

Webhook validation

Credential encryption

Audit logging

Tenant isolation

Authorization

---

# Definition of Done

The Calendar module is complete only when:

Provider abstraction implemented

OAuth implemented

Synchronization implemented

Webhook validation implemented

Retry logic implemented

Audit logging implemented

Tenant isolation verified

Tests passing

Documentation updated

Security review completed

---

# Guiding Principle

The Calendar module synchronizes data.

It never owns appointment data.

PostgreSQL remains the single source of truth for all scheduling information.