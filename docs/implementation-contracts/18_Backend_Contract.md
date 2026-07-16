# Backend Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Backend Architecture

---

# Purpose

This document defines the backend architecture of the AI Receptionist SaaS Platform.

The backend is the single source of business logic.

Every business operation MUST pass through the backend.

No frontend, AI provider, telephony provider, automation workflow, or third-party integration may bypass backend validation.

---

# Responsibilities

The backend SHALL manage:

- Business logic
- Authentication
- Authorization
- Tenant isolation
- Validation
- Persistence
- Event publishing
- API responses
- Audit logging
- Error handling
- Provider orchestration

The backend SHALL NOT manage:

- Browser UI
- Voice transport
- AI inference
- Telephony infrastructure

---

# Architecture

The backend SHALL follow a Modular Monolith architecture.

Each module SHALL own:

- Controllers
- Services
- Repositories
- DTOs
- Validators
- Routes
- Events
- Interfaces
- Tests

Modules communicate only through public interfaces or events.

---

# Module Structure

Each module SHALL follow:

controllers/

services/

repositories/

validators/

dto/

interfaces/

routes/

events/

errors/

constants/

tests/

README.md

index.ts

---

# Primary Modules

Authentication

RBAC

Tenant

Configuration

Clinic

Doctor

Patient

Appointment

Conversation

Notification

Calendar

AI Engine

Prompt Engine

Voice

Analytics (future)

Subscription (future)

Billing (future)

---

# Request Lifecycle

Incoming Request

↓

Middleware

↓

Authentication

↓

Authorization

↓

Tenant Resolution

↓

Validation

↓

Controller

↓

Service

↓

Repository

↓

Database

↓

Response

No business logic SHALL exist in controllers.

---

# Controllers

Controllers SHALL:

Receive requests

Validate DTOs

Call services

Return responses

Controllers SHALL NOT:

Access the database

Contain business logic

Call external providers directly

---

# Services

Services SHALL:

Implement business logic

Coordinate modules

Publish events

Enforce business rules

Services SHALL NOT:

Know HTTP details

Know database implementation

---

# Repositories

Repositories SHALL:

Read data

Write data

Execute queries

Repositories SHALL NOT:

Contain business rules

Perform authorization

Call external APIs

---

# Validation

Validation SHALL occur before business logic.

Validate:

Headers

Path parameters

Query parameters

Body

Uploaded files

Invalid requests SHALL never reach services.

---

# Event Architecture

Modules SHALL communicate using domain events where appropriate.

Examples:

AppointmentCreated

AppointmentCancelled

ConversationCompleted

NotificationRequested

CalendarSyncRequested

Events SHALL be immutable.

---

# Error Handling

All errors SHALL use standardized error objects.

Categories:

Validation

Authentication

Authorization

Business

Infrastructure

Provider

Unknown

Internal stack traces SHALL never be returned to clients.

---

# Logging

Every request SHALL generate:

Request ID

Timestamp

Tenant ID

User ID

Module

Duration

Status

Sensitive data SHALL be redacted.

---

# Transactions

Business transactions SHALL be atomic.

Partial writes SHALL be rolled back.

Distributed transactions SHALL use eventual consistency where appropriate.

---

# Dependency Rules

Modules SHALL depend only on:

Shared kernel

Public interfaces

Published events

Circular dependencies are prohibited.

---

# External Providers

All providers SHALL be accessed through adapters.

Examples:

OpenAI

Twilio

Google Calendar

SMTP

Future providers

Business modules SHALL remain provider-independent.

---

# Configuration

Business modules SHALL retrieve runtime configuration only through the Configuration Service.

Environment variables SHALL be accessed only through the Configuration Layer.

---

# Security

Every request SHALL enforce:

Authentication

Authorization

Tenant validation

Input validation

Output encoding

Audit logging

Least privilege

---

# Monitoring

Track:

Request count

Latency

Error rate

Module failures

Database performance

Provider failures

Queue depth (future)

---

# Scalability

The backend SHALL support:

Horizontal scaling

Read replicas

Stateless API servers

Future caching

Future message queues

Future microservice extraction

Without changing module contracts.

---

# Testing Requirements

Every module SHALL include:

Unit tests

Integration tests

Authorization tests

Tenant isolation tests

Validation tests

Error handling tests

---

# Definition of Done

The backend architecture is complete only when:

Module boundaries implemented

Layering enforced

Validation implemented

Event architecture implemented

Logging implemented

Error handling standardized

Tests passing

Documentation updated

Security review completed

---

# Guiding Principle

The backend is the authority for all business operations.

Every request is validated.

Every business rule is enforced.

Every change is auditable.

No external component may bypass backend rules.