# Prompt Engine Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Prompt Management Domain

---

# Purpose

This document defines the Prompt Engine.

The Prompt Engine is responsible for managing, versioning, validating, and delivering prompts used by the AI Engine.

Prompt management SHALL be completely separated from AI execution.

Prompt changes SHALL NOT require application deployment.

---

# Responsibilities

The Prompt Engine SHALL manage:

- Prompt storage
- Prompt versioning
- Prompt validation
- Prompt retrieval
- Prompt variables
- Prompt publishing
- Prompt rollback
- Prompt history
- Prompt assignment

The Prompt Engine SHALL NOT manage:

- AI inference
- Voice processing
- Business logic
- Appointment validation
- Database business rules

---

# Objectives

The Prompt Engine SHALL:

- Support tenant-specific prompts
- Support runtime updates
- Support version history
- Support rollback
- Prevent prompt injection
- Minimize prompt duplication

---

# Prompt Types

Supported prompt types:

System Prompt

Greeting Prompt

Fallback Prompt

Booking Prompt

Cancellation Prompt

Rescheduling Prompt

FAQ Prompt

After Hours Prompt

Emergency Prompt

Goodbye Prompt

Future prompt types SHALL be configurable.

---

# Prompt Ownership

Prompt hierarchy:

Platform Default

↓

Tenant Override

↓

Clinic Override

Lower levels override higher levels only where permitted.

---

# Prompt Structure

Each prompt SHALL contain:

Internal ID

Public ID

Tenant ID

Clinic ID (optional)

Prompt Type

Version

Content

Variables

Status

Created At

Updated At

Published At

---

# Prompt Status

Supported statuses:

Draft

Published

Archived

Deprecated

Only Published prompts may be used by the AI Engine.

---

# Prompt Variables

Supported variables include:

Clinic Name

Business Hours

Timezone

Doctor Names

Appointment Duration

Supported Languages

Greeting Message

Business Phone

Variables SHALL be resolved before prompt delivery.

---

# Prompt Retrieval

The AI Engine SHALL request prompts only through the Prompt Engine.

Prompt retrieval flow:

AI Request

↓

Resolve Tenant

↓

Resolve Clinic

↓

Resolve Prompt Type

↓

Resolve Published Version

↓

Inject Variables

↓

Return Final Prompt

---

# Versioning

Every prompt update SHALL create a new version.

Each version SHALL record:

Version Number

Author

Timestamp

Change Summary

Previous Version

Rollback Reference

History SHALL remain immutable.

---

# Validation

Every prompt SHALL be validated before publishing.

Validation SHALL verify:

Required variables

Maximum length

Unsupported placeholders

Invalid syntax

Restricted content

Prompt validation failures SHALL prevent publishing.

---

# Rollback

The Prompt Engine SHALL support rollback to any previous published version.

Rollback SHALL:

Create a new version

Preserve history

Generate audit events

Avoid deleting historical versions

---

# Security

Prompts SHALL NOT contain:

API keys

Passwords

JWT secrets

Database credentials

Internal architecture details

Sensitive implementation details

System prompts SHALL never be exposed to clients.

---

# Prompt Injection Protection

The Prompt Engine SHALL:

Sanitize variables

Escape unsafe content where appropriate

Prevent unauthorized prompt modification

Validate runtime substitutions

The AI Engine SHALL receive only validated prompts.

---

# Relationship with AI Engine

The Prompt Engine provides:

System Prompt

Behavior Instructions

Conversation Rules

Business Context

The AI Engine consumes prompts but never modifies them.

---

# Relationship with Configuration Module

Configuration determines:

Active prompt

Language

Tone

Voice profile

Feature flags

The Prompt Engine resolves the correct prompt based on configuration.

---

# Audit Events

Audit:

Prompt Created

Prompt Updated

Prompt Published

Prompt Archived

Prompt Rolled Back

Prompt Assigned

Each audit record SHALL include:

Tenant

Clinic

Prompt ID

Version

Actor

Timestamp

Request ID

---

# Performance

Frequently used prompts MAY be cached.

Cache SHALL be invalidated immediately after publishing a new version.

Prompt retrieval SHALL prioritize correctness over cache lifetime.

---

# Future Compatibility

The Prompt Engine SHALL support:

Multiple AI providers

A/B prompt testing

Prompt templates

Localization

Industry-specific prompt packs

AI evaluation workflows

Without architectural redesign.

---

# Testing Requirements

Verify:

Prompt creation

Prompt validation

Versioning

Publishing

Rollback

Variable resolution

Tenant isolation

Prompt injection protection

Audit logging

---

# Definition of Done

The Prompt Engine is complete only when:

Prompt storage implemented

Versioning implemented

Publishing implemented

Rollback implemented

Validation implemented

Variable resolution implemented

Audit logging implemented

Tenant isolation verified

Tests passing

Documentation updated

Security review completed

---

# Guiding Principle

Prompts define AI behavior.

The Prompt Engine manages prompts.

The AI Engine executes prompts.

Business logic remains exclusively in backend services.