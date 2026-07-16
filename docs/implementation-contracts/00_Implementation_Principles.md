# Implementation Principles

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# 1. Purpose

This document defines mandatory implementation rules for every engineer and every AI coding assistant contributing to the project.

These rules are implementation contracts.

They are not suggestions.

---

# 2. Core Principle

The implementation SHALL conform to the engineering specification.

The implementation SHALL NOT invent architecture.

If documentation and implementation conflict,

the documentation wins.

---

# 3. Module Contract

Every backend module MUST contain:

controllers/
services/
repositories/
validators/
dto/
interfaces/
events/
routes/
errors/
constants/
tests/
README.md
index.ts

No module may remove directories without documented justification.

---

# 4. Naming Contract

Modules:

PascalCase

Files:

kebab-case

Classes:

PascalCase

Interfaces:

Prefix with I only if required by project convention. Otherwise use descriptive names (e.g. AppointmentRepository).

Functions:

camelCase

Constants:

UPPER_SNAKE_CASE

Enums:

PascalCase

Database Tables:

snake_case

Columns:

snake_case

Prisma Models:

PascalCase

Consistency is mandatory.

---

# 5. Controller Contract

Controllers are transport adapters.

Controllers MUST:

- Parse requests.
- Validate transport input.
- Call services.
- Return standardized responses.

Controllers MUST NOT:

- Access the database.
- Contain business rules.
- Call external providers directly.
- Execute transactions.

---

# 6. Service Contract

Services own business logic.

Every service SHOULD expose explicit methods rather than generic "execute" methods.

Examples:

bookAppointment()

cancelAppointment()

rescheduleAppointment()

findAvailableSlots()

validateBooking()

Services MUST:

- enforce business rules
- coordinate repositories
- publish domain events
- control transactions

Services MUST NOT:

- know HTTP
- return Express responses
- manipulate request objects

---

# 7. Repository Contract

Repositories own persistence only.

Repositories MUST:

- create
- update
- findById
- findByPublicId
- findMany
- exists
- count

Repositories MUST NOT:

- contain business rules
- call other repositories
- call external APIs

---

# 8. Validator Contract

Validation occurs in layers:

Transport Validation

↓

DTO Validation

↓

Business Validation

↓

Database Constraints

Every layer has one responsibility.

---

# 9. Dependency Contract

Allowed:

Controller

↓

Service

↓

Repository

↓

Database

Forbidden:

Controller

↓

Repository

Repository

↓

Repository

Repository

↓

External Provider

Service

↓

HTTP Framework

Circular dependencies are forbidden.

---

# 10. Error Contract

Every module MUST define typed errors.

Never throw generic Error.

Errors should represent business meaning.

Examples:

AppointmentConflictError

PatientNotFoundError

DoctorUnavailableError

InvalidBusinessHoursError

---

# 11. Testing Contract

Every module MUST include:

- Unit tests
- Integration tests
- Repository tests
- Validation tests

Critical business rules require dedicated tests.

---

# 12. Documentation Contract

Every module MUST include a README describing:

- Purpose
- Responsibilities
- Public interfaces
- Dependencies
- Events published
- Events consumed

---

# 13. Security Contract

Every implementation MUST:

- validate input
- authorize actions
- resolve tenant
- audit state changes
- redact secrets
- protect sensitive data

Security requirements may not be bypassed for convenience.

---

# 14. Performance Contract

Implementations SHOULD:

- minimize database queries
- avoid N+1 queries
- paginate collections
- avoid unnecessary allocations
- use indexes effectively

Optimization must not compromise readability.

---

# 15. AI Coding Assistant Contract

When generating code, an AI assistant MUST:

- follow the documented architecture
- preserve module boundaries
- avoid inventing abstractions
- avoid renaming documented components
- request clarification if a requirement is ambiguous

The assistant MUST NOT guess architecture.

---

# 16. Acceptance Criteria

An implementation satisfies this contract if:

- module structure is consistent
- dependencies follow the documented direction
- business rules reside in services
- repositories remain persistence-only
- documentation matches implementation
- tests exist for critical behavior

---

# 17. Guiding Principle

The architecture is intentional.

Implementation exists to realize the architecture—not redefine it.