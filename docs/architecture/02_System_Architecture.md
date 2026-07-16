# System Architecture Specification

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

---

# Purpose

This document defines the complete system architecture for the AI Receptionist SaaS Platform.

Its purpose is to ensure:

- Maintainability
- Scalability
- Security
- High availability
- Vendor independence
- Future extensibility

This document is the authoritative architecture reference for the entire platform.

---

# Architecture Philosophy

The platform must be designed as a production SaaS product.

Not a demo.

Not a prototype.

Not a collection of workflows.

The architecture must remain understandable by engineers who did not originally build the system.

Every module must have a clearly defined responsibility.

Every dependency must be intentional.

---

# Architecture Style

The platform shall follow a **Modular Monolith Architecture**.

Reasons:

- Faster development.
- Easier deployment.
- Lower infrastructure costs.
- Easier debugging.
- Strong module boundaries.
- Future migration path to microservices.

The architecture must enforce module isolation even though modules run inside the same application.

---

# Why Not Microservices?

Microservices are intentionally NOT used initially because:

- Higher operational cost.
- More infrastructure.
- Distributed debugging.
- Complex deployments.
- Service discovery.
- Network failures.
- Higher DevOps overhead.

These costs are unnecessary during early growth.

The architecture must instead prepare every module to become an independent service later if scaling requires it.

---

# Future Migration Strategy

Every module should communicate through interfaces.

No module should directly depend on another module's implementation.

Future migration should allow:

```
Appointment Module

↓

Independent Microservice

without rewriting business logic.
```

The code should already respect these boundaries.

---

# High-Level Architecture

```
                        Internet
                            │
                            ▼
                     Twilio Phone Number
                            │
                            ▼
                  Voice Server (Node.js)
                            │
          ┌─────────────────┴─────────────────┐
          ▼                                   ▼
 OpenAI GPT-4o Realtime               Backend API
                                              │
                     ┌────────────────────────┼──────────────────────┐
                     ▼                        ▼                      ▼
              PostgreSQL             Google Calendar             n8n
```

---

# Responsibilities

## Voice Server

Responsible for:

- Twilio Media Streams
- OpenAI Realtime connection
- Audio streaming
- Audio playback
- Voice interruptions
- Speech buffering
- Session lifecycle

The Voice Server must never contain business logic.

---

## Backend API

Responsible for:

- Authentication
- Authorization
- Validation
- Business rules
- Database operations
- Tenant management
- Appointment engine
- Conversation engine
- Clinic settings
- Doctor scheduling
- Analytics
- Reporting
- Auditing

The Backend API is the single source of truth.

---

## PostgreSQL

Responsible for persistent storage.

Stores:

- Clinics
- Users
- Patients
- Doctors
- Appointments
- Conversations
- Prompts
- Settings
- Audit Logs
- Usage
- Permissions

Google Calendar is NOT the source of truth.

---

## Google Calendar

Purpose:

Synchronization only.

If synchronization fails:

The appointment must remain valid.

Synchronization retries automatically.

---

## n8n

n8n is NOT the backend.

n8n must only perform:

- SMS
- Email
- Scheduled reminders
- Calendar synchronization
- External integrations
- Internal automations

Business logic must never exist inside n8n.

---

# Request Flow

Incoming Call

↓

Twilio

↓

Voice Server

↓

OpenAI Realtime

↓

Structured Intent

↓

Backend API

↓

Business Validation

↓

Database

↓

Calendar Sync

↓

Automation (n8n)

↓

Voice Response

↓

Caller

---

# AI Responsibility

The AI is responsible only for:

Understanding.

Conversation.

Entity extraction.

Intent detection.

Natural responses.

The AI is NOT responsible for:

Authorization.

Validation.

Database updates.

Scheduling.

Business rules.

Security.

Those belong to the Backend API.

---

# Deterministic Business Rules

Every state-changing action must follow:

```
AI Request

↓

Validation

↓

Authorization

↓

Business Rules

↓

Transaction

↓

Audit Log

↓

Response
```

The AI must never directly execute business actions.

---

# Module Structure

The backend consists of independent modules.

Examples:

Authentication

Authorization

Clinic

Patient

Doctor

Appointment

Conversation

AI

Voice

Calendar

Notification

Analytics

Audit

Settings

Shared

Each module owns:

Controllers

Services

Repositories

Validators

DTOs

Routes

Events

Interfaces

Tests

---

# Module Communication

Modules communicate only through:

Interfaces.

Events.

Shared contracts.

Never through database shortcuts.

Never through internal implementation details.

---

# Dependency Rules

Allowed:

Controller

↓

Service

↓

Repository

↓

Database

Forbidden:

Repository calling controllers.

Controllers accessing database directly.

Services modifying unrelated modules.

Circular dependencies.

---

# Configuration

Every configurable value must exist outside code.

Examples:

Business hours

Timeouts

Voices

Providers

Limits

Feature flags

API URLs

Retry counts

Environment variables

No business rule should require a redeployment.

---

# Tenant Resolution

Every request must resolve a tenant.

Voice requests:

Twilio Number

↓

Tenant

↓

Clinic

↓

Configuration

↓

Conversation

↓

Business Logic

Tenant resolution happens before any business operation.

---

# AI Provider Abstraction

The backend must define:

AIProvider

OpenAIProvider

Future providers:

Gemini

Claude

Azure OpenAI

Groq

OpenRouter

Changing providers should require configuration only.

Business logic must remain unchanged.

---

# Telephony Provider Abstraction

Current:

Twilio

Future:

Telnyx

Vonage

Plivo

Provider switching should require adapter replacement only.

---

# Calendar Provider Abstraction

Current:

Google Calendar

Future:

Microsoft Outlook

CalDAV

Exchange

The Appointment Module should never depend directly on Google APIs.

---

# Storage Provider Abstraction

Current MVP:

No recording storage.

Future:

Cloudflare R2

AWS S3

Azure Blob

Google Cloud Storage

Storage implementation should remain interchangeable.

---

# Deployment

Services:

Frontend

Backend

Voice Server

Database

n8n

Monitoring

Each service should remain independently deployable.

---

# Scalability

The architecture must support:

Horizontal API scaling.

Stateless backend instances.

Multiple Voice Server instances.

Connection pooling.

Database replication.

Future Redis caching.

Future message queues.

No redesign should be required.

---

# Fault Tolerance

Failures in one subsystem must not crash others.

Examples:

Google Calendar failure

↓

Appointment still exists.

SMS failure

↓

Appointment still exists.

OpenAI timeout

↓

Graceful retry or escalation.

---

# Security Boundaries

Every service validates:

Authentication.

Authorization.

Input.

Tenant.

Permissions.

Every request.

Without exception.

---

# Architecture Rule

No feature may bypass the architecture described in this document.

If a future feature conflicts with these principles, the architecture must be reviewed before implementation.