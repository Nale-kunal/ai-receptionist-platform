# Role-Based Access Control (RBAC) Contract

Version: 1.0.0

Status: Active

Authority: Authorization Standards

---

# Purpose

This document defines the authorization architecture for the Dental AI Receptionist SaaS platform.

Authentication answers:

"Who are you?"

Authorization answers:

"What are you allowed to do?"

Every protected endpoint MUST enforce authorization according to this contract.

No controller, service, or repository may bypass RBAC.

---

# Objectives

RBAC must provide:

- Least privilege
- Tenant isolation
- Clinic isolation
- Predictable permissions
- Extensible role system
- Future custom roles
- Auditable authorization decisions

---

# Core Principles

Authentication occurs first.

↓

RBAC occurs second.

↓

Business logic executes last.

Authorization SHALL NEVER depend on frontend logic.

The backend is the single source of truth.

---

# Permission Model

Permissions are granted to Roles.

Users receive Roles.

Users never receive individual permissions directly.

Future enterprise editions may support permission overrides.

---

# Default Roles

Super Admin

Platform administrator.

Can manage the entire SaaS platform.

Cannot belong to a clinic.

---

Admin

Clinic owner.

Manages:

- Clinic
- Doctors
- Receptionists
- Patients
- Appointments
- AI configuration
- Business hours
- Reports

Cannot access another clinic.

---

Receptionist

Can:

- Book appointments
- Cancel appointments
- Reschedule appointments
- View patients
- View conversations

Cannot modify clinic configuration.

Cannot manage users.

---

Doctor

Can:

- View appointments
- View assigned patients
- View conversation summaries

Cannot modify clinic settings.

Cannot manage staff.

---

Patient

Future role.

Limited self-service access.

---

# Permission Naming Convention

Use:

resource.action

Examples

appointment.create

appointment.read

appointment.update

appointment.delete

conversation.read

conversation.summary

doctor.read

doctor.update

clinic.settings.update

user.invite

user.disable

report.view

---

# Permission Categories

Clinic

Doctor

Patient

Appointment

Conversation

Notification

Calendar

AI

Prompt

Billing

Reporting

Administration

---

# Authorization Flow

Incoming Request

↓

JWT Validated

↓

Resolve User

↓

Resolve Role

↓

Resolve Permissions

↓

Verify Tenant

↓

Verify Clinic

↓

Execute Business Logic

---

# Tenant Isolation

Every authorization decision MUST validate:

tenantId

clinicId

userId

No role grants cross-tenant access.

Even Super Admin operations must explicitly select a tenant context when required.

---

# Ownership Rules

Users may only access resources belonging to:

their tenant

AND

their clinic

Ownership checks are mandatory in addition to permission checks.

---

# Route Protection

Every protected route declares required permissions.

Example

POST /appointments

Required

appointment.create

---

PATCH /appointments/:id

Required

appointment.update

---

DELETE /appointments/:id

Required

appointment.delete

---

# Service Layer Rules

Services SHALL NOT trust controller input.

Services must independently verify authorization when performing sensitive operations.

---

# Repository Rules

Repositories never perform authorization.

Repositories only retrieve and persist data.

Authorization belongs in middleware and services.

---

# Permission Evaluation

Authorization succeeds only if:

User authenticated

AND

Tenant valid

AND

Clinic valid

AND

Required permission exists

AND

Ownership checks pass

---

# Forbidden Access

Unauthorized requests SHALL return:

403 Forbidden

Response

{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions."
  }
}

No sensitive information shall be disclosed.

---

# Audit Logging

Log:

Permission granted

Permission denied

Role changes

Privilege escalation

Administrative overrides

Sensitive operations

Include:

User ID

Tenant ID

Clinic ID

Role

Permission

Request ID

Timestamp

---

# Role Changes

Changing roles requires:

Admin permission

↓

Audit log

↓

Permission cache invalidation

↓

Immediate effect

---

# Future Custom Roles

Architecture must support:

Custom roles

Permission groups

Department roles

Temporary permissions

Feature-based permissions

without redesign.

---

# Permission Cache

Permission resolution may be cached.

Cache must be invalidated immediately after:

Role changes

Permission updates

User disable

Tenant suspension

---

# Security Requirements

Backend authorization only

No frontend trust

No hidden admin routes

No client-side permission enforcement

Least privilege

Tenant isolation

Clinic isolation

Audit every privileged action

---

# Testing Requirements

Verify:

Allowed access

Denied access

Cross-clinic denial

Cross-tenant denial

Role inheritance

Permission updates

Ownership validation

Audit logging

---

# Definition of Done

RBAC is complete only when:

Roles implemented

Permissions implemented

Middleware implemented

Ownership validation implemented

Tenant isolation verified

Clinic isolation verified

Audit logging complete

Permission cache implemented

Tests passing

Documentation updated

Security review passed