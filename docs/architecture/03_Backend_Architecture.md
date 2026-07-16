# Backend Architecture Specification

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# Purpose

This document defines the architecture, organization, design principles, coding standards, module boundaries, and implementation rules for the backend.

This document is the authoritative reference for all backend engineering decisions.

No backend code should violate this specification.

---

# Objectives

The backend must provide:

- Business Logic
- Security
- Authentication
- Authorization
- Multi-Tenancy
- Validation
- Persistence
- AI Orchestration
- Appointment Management
- Conversation Management
- Calendar Synchronization
- Automation Integration
- Analytics
- Auditing

The backend is the **single source of truth** for the platform.

---

# Technology Stack

Runtime

- Node.js (LTS)

Language

- TypeScript

Framework

- Express.js

ORM

- Prisma

Database

- PostgreSQL

Validation

- Zod

Authentication

- JWT Access Tokens
- Rotating Refresh Tokens

Password Hashing

- Argon2id

Logging

- Pino

Testing

- Vitest

API Documentation

- OpenAPI 3.1

Package Manager

- pnpm

Containerization

- Docker

---

# Backend Principles

The backend shall follow:

- SOLID Principles
- Clean Architecture
- Layered Architecture
- Modular Monolith
- Repository Pattern
- Dependency Injection
- Interface-based Design
- Explicit Dependencies
- Composition over Inheritance

Business logic must remain deterministic.

---

# High-Level Folder Structure

```
backend/

├── src/

│   ├── app/
│   ├── config/
│   ├── core/
│   ├── modules/
│   ├── infrastructure/
│   ├── shared/
│   ├── middleware/
│   ├── routes/
│   ├── events/
│   ├── jobs/
│   ├── types/
│   ├── utils/
│   ├── server.ts
│   └── app.ts

├── prisma/
├── tests/
├── docker/
├── scripts/
├── docs/

```

---

# Module Structure

Every module follows the same layout.

Example:

```
appointment/

├── controllers/
├── services/
├── repositories/
├── validators/
├── dto/
├── interfaces/
├── events/
├── middleware/
├── routes/
├── constants/
├── types/
├── errors/
├── tests/
├── index.ts
```

Consistency is mandatory.

---

# Responsibilities

Controllers

Responsible only for:

- HTTP
- Request parsing
- Response formatting

Controllers must never contain business logic.

---

Services

Responsible for:

- Business rules
- Orchestration
- Validation flow
- Transactions

Services must not know HTTP details.

---

Repositories

Responsible only for:

Database access.

Repositories must not contain business logic.

---

Validators

Responsible for:

Input validation

Output validation

Schema validation

Business validation belongs inside services.

---

DTOs

Responsible for:

Request contracts

Response contracts

Never expose database entities directly.

---

Interfaces

Responsible for:

Abstractions

Provider contracts

Dependency inversion

---

Events

Responsible for:

Internal domain events.

Events must never replace direct service calls when consistency is required.

---

# Dependency Rules

Allowed

Controller

↓

Service

↓

Repository

↓

Database

Forbidden

Repository

↓

Controller

Controller

↓

Database

Service

↓

HTTP

Repository

↓

External APIs

---

# Module Communication

Modules communicate only through:

Interfaces

Domain Events

Shared Contracts

No module may access another module's repository directly.

---

# Dependency Injection

All services must depend on interfaces.

Never instantiate dependencies inside business logic.

Bad

```
const prisma = new PrismaClient()
```

Good

```
constructor(private repository: AppointmentRepository)
```

---

# Shared Core

Shared contains:

Errors

Utilities

Constants

Enums

Result Objects

Base Classes

Logger

Configuration

Shared code must never depend on modules.

Modules may depend on Shared.

---

# Error Handling

Use typed errors.

Examples

ValidationError

AuthenticationError

AuthorizationError

ConflictError

NotFoundError

ExternalServiceError

BusinessRuleError

Never throw generic Error.

---

# API Responses

Every response must use consistent formatting.

Success

```
{
success,
data,
meta
}
```

Failure

```
{
success,
error,
requestId,
timestamp
}
```

No inconsistent response formats.

---

# Validation Strategy

Every input validated.

Every output validated.

Never trust client data.

Never trust AI outputs.

Never trust external APIs.

Validation layers:

Transport

↓

DTO

↓

Business Rules

↓

Database

---

# Transactions

Every operation modifying multiple tables must use transactions.

Examples

Booking

Rescheduling

Cancellation

Conversation completion

Audit logging

No partial updates allowed.

---

# Business Rules

Business rules belong only inside Services.

Examples

Doctor availability

Booking limits

Working hours

Tenant validation

Holiday validation

Never inside controllers.

Never inside repositories.

---

# Configuration

Configuration must be centralized.

No module may read process.env directly.

Use configuration providers.

Environment variables loaded once.

Validated at startup.

Application should fail fast when configuration is invalid.

---

# Feature Flags

Architecture must support:

Enable SMS

Enable Recording

Enable AI

Enable Calendar

Enable Notifications

Flags stored in database.

No redeployment required.

---

# Logging

Use structured logging.

Every request includes:

Request ID

Tenant ID

User ID

Correlation ID

Execution Time

Sensitive information must be automatically redacted.

---

# API Versioning

Support:

/api/v1

Future:

/api/v2

Never introduce breaking changes without versioning.

---

# Event System

Internal events only.

Examples

AppointmentBooked

AppointmentCancelled

ConversationCompleted

PatientCreated

ClinicUpdated

Events must remain synchronous unless asynchronous behavior is intentional.

---

# External Providers

Never couple modules to vendors.

Examples

AI Provider

Calendar Provider

SMS Provider

Storage Provider

Telephony Provider

All accessed through interfaces.

---

# Performance

Avoid unnecessary database queries.

Prevent N+1 queries.

Use pagination.

Use indexes.

Use lazy loading where appropriate.

Optimize before scaling.

---

# Caching

Design for caching.

Implement later.

Use cache interfaces.

Avoid hard dependency on Redis.

---

# Background Jobs

Long-running operations must execute asynchronously.

Examples

SMS

Emails

Calendar retries

Analytics aggregation

Conversation summarization

The HTTP request should never wait unnecessarily.

---

# Security

No secrets in source code.

No secrets in logs.

No secrets in frontend.

Validate every request.

Authorize every action.

Enforce tenant isolation.

Use least privilege.

Rotate refresh tokens.

Hash passwords with Argon2id.

Encrypt sensitive fields where required.

Protect against:

- SQL Injection
- XSS
- CSRF
- SSRF
- Prompt Injection
- Replay Attacks

---

# Testing

Every module must include:

Unit Tests

Integration Tests

Mock Providers

Repository Tests

Business Rule Tests

Security Tests

---

# Documentation

Every exported interface documented.

Every module includes README.

Public APIs documented using OpenAPI.

Complex business rules explained with examples.

---

# Backend Guiding Principle

The backend exists to enforce business correctness.

The AI assists decision-making.

The backend owns every permanent state change.

No exception.