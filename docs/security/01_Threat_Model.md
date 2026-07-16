# Threat Model

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Security Architecture

Methodology: STRIDE

---

# Purpose

This document identifies potential threats against the AI Receptionist SaaS Platform and defines architectural mitigations.

Threat modeling is performed before implementation to reduce security risk.

Every major architectural change must review this document.

---

# Security Objectives

Protect:

- Patient Data
- Appointment Data
- Clinic Data
- Authentication Credentials
- AI Conversations
- Provider Credentials
- Financial Data (Future)
- Platform Availability
- Tenant Isolation

---

# Architecture Overview

External User

↓

Internet

↓

CDN (Future)

↓

Frontend

↓

Backend API

↓

PostgreSQL

↓

External Providers

• Twilio

• OpenAI

• Google Calendar

• Email

• SMS

↓

Monitoring

↓

Audit

---

# Trust Boundaries

The following trust boundaries exist:

Boundary 1

Internet

↓

Backend

Boundary 2

Backend

↓

Database

Boundary 3

Backend

↓

OpenAI

Boundary 4

Backend

↓

Twilio

Boundary 5

Backend

↓

Google Calendar

Boundary 6

Backend

↓

n8n

Every boundary requires authentication, validation, and authorization where applicable.

---

# STRIDE Threat Analysis

---

# S — Spoofing Identity

Threat

Attacker impersonates a legitimate user or provider.

Examples

- Stolen JWT
- Fake Twilio webhook
- Fake Google callback
- Session hijacking
- Stolen refresh token

Mitigations

- JWT signature verification
- Short-lived access tokens
- Refresh token rotation
- Session tracking
- Twilio signature validation
- Google webhook verification
- HTTPS everywhere
- Secure cookies
- MFA-ready architecture

Residual Risk

Low

---

# T — Tampering

Threat

Attacker modifies requests or data.

Examples

- Modified appointment request
- Altered webhook payload
- SQL injection
- Prompt manipulation
- AI tool injection

Mitigations

- Input validation
- Parameterized queries
- Prisma ORM
- Schema validation
- AI output validation
- Request signatures
- Integrity checks

Residual Risk

Low

---

# R — Repudiation

Threat

Users deny performing actions.

Examples

- "I never cancelled this appointment."
- "I never changed the prompt."
- "I never deleted this patient."

Mitigations

- Immutable audit logs
- Request IDs
- Correlation IDs
- User IDs
- Timestamping
- Session tracking

Residual Risk

Very Low

---

# I — Information Disclosure

Threat

Sensitive information becomes visible.

Examples

- Cross-tenant leak
- Logging patient data
- Logging API keys
- Public storage bucket
- Stack traces
- AI prompt leakage

Mitigations

- Tenant isolation
- RBAC
- Output filtering
- Secret redaction
- Secure logging
- Encryption
- Least privilege
- CSP
- Security headers

Residual Risk

Medium

Requires continuous review.

---

# D — Denial of Service

Threat

Attackers prevent legitimate usage.

Examples

- API flooding
- Login brute force
- AI abuse
- Twilio spam
- Calendar sync flooding
- Large payload attacks

Mitigations

- Rate limiting
- Request size limits
- Timeouts
- Circuit breakers
- Queueing
- CAPTCHA (future)
- Provider quotas
- WAF (future)

Residual Risk

Medium

---

# E — Elevation of Privilege

Threat

Attacker gains unauthorized permissions.

Examples

- RBAC bypass
- JWT manipulation
- Admin endpoint access
- Permission escalation
- Broken authorization

Mitigations

- Backend authorization
- Permission middleware
- Ownership validation
- Tenant validation
- Audit logging
- Security testing

Residual Risk

Low

---

# AI-Specific Threats

Prompt Injection

Mitigation

- Prompt isolation
- Structured outputs
- Backend validation

Hallucinated Actions

Mitigation

- AI never writes directly
- Backend confirms actions

Data Leakage

Mitigation

- Tenant-specific prompts
- Context isolation

Model Abuse

Mitigation

- Usage limits
- Monitoring
- Request validation

---

# Voice Threats

Caller Impersonation

Mitigation

- Appointment verification
- Phone validation
- Optional OTP (future)

Call Flooding

Mitigation

- Provider rate limiting
- Abuse detection

Audio Injection

Mitigation

- Backend validation
- Intent confidence thresholds

Recording Exposure

Mitigation

- Secure storage
- Access control
- Signed URLs

---

# Multi-Tenant Threats

Threat

Tenant accesses another tenant's data.

Mitigations

- Tenant context
- Repository filtering
- RBAC
- Database constraints
- Authorization checks

Residual Risk

Very Low

---

# Provider Threats

Twilio Compromise

Mitigation

- Signature validation
- Secret rotation

OpenAI Failure

Mitigation

- Retry
- Graceful degradation

Google Calendar Failure

Mitigation

- Retry queue
- Local source of truth

n8n Failure

Mitigation

- Business logic remains in backend

---

# Supply Chain Threats

Dependency Vulnerabilities

Mitigation

- Dependabot
- npm audit
- Snyk (future)
- Regular updates

Compromised Packages

Mitigation

- Dependency review
- Version pinning
- Lockfiles

---

# Infrastructure Threats

Container Escape

Mitigation

- Least privilege
- Read-only filesystem where possible

Credential Leakage

Mitigation

- Environment variables
- Secret manager (future)

Database Exposure

Mitigation

- Private networking
- Firewall
- Encryption

---

# Insider Threats

Threat

Authorized user abuses privileges.

Mitigation

- Least privilege
- Audit logging
- Role separation
- Administrative approval
- Monitoring

---

# Security Monitoring

Monitor

- Failed logins
- Permission failures
- Webhook failures
- Replay attacks
- Suspicious IPs
- AI abuse
- Provider failures
- Rate limits
- Cross-tenant attempts

---

# Incident Response

Every confirmed incident requires:

Detection

↓

Containment

↓

Investigation

↓

Recovery

↓

Root Cause Analysis

↓

Corrective Actions

↓

Documentation Update

---

# Risk Register

Critical

- Cross-tenant data leak
- Authentication bypass
- Provider credential exposure

High

- Prompt injection
- AI abuse
- Calendar compromise

Medium

- DoS
- Replay attacks
- Provider outages

Low

- UI manipulation
- Metadata disclosure

---

# Security Testing Requirements

Perform:

- Unit security tests
- Integration security tests
- Authorization tests
- Tenant isolation tests
- API fuzz testing
- Dependency scanning
- Static analysis
- Penetration testing (pre-production)

---

# Definition of Done

The threat model is complete when:

- All STRIDE categories are assessed.
- Major attack surfaces are documented.
- Mitigations are defined.
- Residual risks are recorded.
- Security testing aligns with identified threats.
- The document is reviewed whenever significant architecture changes occur.

---

# Guiding Principle

Assume every external interaction can be malicious.

Design systems that remain secure even when components fail or attackers behave unexpectedly.