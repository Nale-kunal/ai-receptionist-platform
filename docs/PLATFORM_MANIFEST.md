# AI Receptionist SaaS Platform Manifest

Version: 1.0.0

Status: Active

Authority: Repository Index

Owner: Engineering

---

# Purpose

This document is the primary entry point into the engineering documentation.

Every engineer and every AI coding assistant MUST read this document before making any architectural or implementation decisions.

This document explains:

- What this project is
- How the repository is organized
- Where documentation lives
- Which document has authority
- Engineering workflow
- Technology stack
- Implementation order
- Development milestones

This file is the navigation system for the entire platform.

---

# Project Vision

Build the world's most reliable AI Receptionist platform for dental clinics.

The platform must be:

- Multi-tenant
- Enterprise-grade
- Secure by default
- AI-powered
- Voice-first
- Cloud-native
- API-first
- Horizontally scalable

The architecture should support thousands of clinics without requiring redesign.

---

# Business Goal

Provide a SaaS platform where every clinic has:

- Independent AI receptionist
- Independent business hours
- Independent appointments
- Independent Google Calendar
- Independent telephony
- Independent prompts
- Independent staff
- Complete tenant isolation

---

# Technology Stack

Backend

- Node.js
- TypeScript
- Express

Database

- PostgreSQL
- Prisma ORM

Frontend

- React
- Vite
- TypeScript
- Tailwind CSS

Voice

- Twilio
- OpenAI GPT-4o Realtime

Automation

- n8n

Authentication

- JWT
- Rotating Refresh Tokens

Infrastructure

- Docker
- Render (initial deployment)

Future

- Kubernetes
- AWS
- Terraform
- Redis
- Kafka (if required)

---

# Repository Structure

```text
Dental-AI-Receptionist-SaaS/

docs/

backend/

frontend/

voice-server/

n8n/

docker/

scripts/

tests/
```

---

# Documentation Structure

```text
docs/

00_Engineering_Constitution.md

PLATFORM_MANIFEST.md

requirements/

architecture/

implementation-contracts/

engineering-playbook/

adr/

api/

deployment/

testing/

diagrams/
```

---

# Documentation Hierarchy

Highest Authority

Engineering Constitution

↓

Engineering Playbook

↓

Requirements

↓

Architecture

↓

Implementation Contracts

↓

Architecture Decision Records

↓

Implementation

↓

Tests

↓

Deployment

If two documents conflict,

the higher document wins.

---

# Engineering Workflow

Business Idea

↓

Requirements

↓

Architecture

↓

Implementation Contract

↓

Implementation

↓

Testing

↓

Review

↓

Deployment

No implementation begins without documentation.

---

# Development Philosophy

Architecture First

Documentation First

Security First

Business First

Implementation Second

Optimization Last

---

# Technology Principles

PostgreSQL is the source of truth.

External providers are integrations.

Business logic belongs in services.

Repositories own persistence.

Controllers own transport.

AI assists.

Backend decides.

---

# Security Principles

Zero Trust

Least Privilege

Tenant Isolation

Encryption

Auditability

Validation

Provider Verification

Secure Defaults

Secrets in Environment Variables Only

No credentials in frontend

---

# Repository Standards

Every backend module contains:

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

---

# Documentation Status

Phase 1

Foundation

Engineering Constitution

Engineering Playbook

Requirements

Architecture

Database

Domain

Relationships

Status

Completed

---

Phase 2

Implementation Contracts

Status

In Progress

---

Phase 3

Implementation

Status

Pending

---

Phase 4

Testing

Status

Pending

---

Phase 5

Deployment

Status

Pending

---

# Implementation Order

The platform SHALL be implemented in the following sequence.

1.

Backend Foundation

2.

Authentication

3.

RBAC

4.

Tenant

5.

Clinic

6.

Doctor

7.

Patient

8.

Appointment

9.

Conversation

10.

Notification

11.

Calendar

12.

AI Engine

13.

Voice Server

14.

Frontend

15.

Monitoring

16.

Deployment

Each subsystem must pass review before the next subsystem begins.

---

# AI Coding Assistant Instructions

Every AI coding assistant MUST:

Read this document first.

Read the relevant implementation contract.

Never invent architecture.

Never rename documented modules.

Never bypass security requirements.

Never expose secrets.

Never create undocumented dependencies.

Request clarification instead of guessing.

---

# Definition of Done

A subsystem is complete only when:

Implementation completed

Tests passing

Documentation updated

Security reviewed

Acceptance criteria satisfied

No known critical defects

---

# Long-Term Vision

The platform should support:

Thousands of clinics

Millions of appointments

Millions of conversations

Multiple AI providers

Multiple telephony providers

Multiple calendar providers

Future billing

Future analytics

Future mobile applications

Future white-label deployments

without fundamental architectural redesign.

---

# Repository Mission

This repository exists to produce a maintainable, secure, enterprise-grade SaaS platform.

Engineering quality is valued over development speed.

Every contribution should improve the platform.

Every engineering decision should be explainable.

Every implementation should be replaceable.

Every subsystem should be independently testable.

The architecture should remain understandable for many years.