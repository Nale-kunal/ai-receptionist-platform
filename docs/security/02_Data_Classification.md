# Data Classification

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Data Governance

---

# Purpose

This document defines how information is classified, protected, stored, transmitted, logged, retained, and destroyed within the AI Receptionist SaaS Platform.

Every database field, API response, log entry, backup, and integration MUST follow this classification policy.

---

# Objectives

The platform SHALL:

- Protect sensitive information
- Prevent accidental disclosure
- Support regulatory compliance
- Standardize data handling
- Minimize unnecessary data collection
- Enable secure backups
- Enable secure deletion

---

# Classification Levels

The platform defines four classification levels.

PUBLIC

↓

INTERNAL

↓

CONFIDENTIAL

↓

RESTRICTED

Higher classifications inherit all controls from lower classifications.

---

# Level 1 — Public

Definition

Information intentionally available to anyone.

Examples

- Marketing website
- Public documentation
- API documentation
- Pricing pages
- Feature descriptions

Requirements

- No encryption required beyond HTTPS
- May be cached
- Public CDN allowed

Retention

Unlimited

---

# Level 2 — Internal

Definition

Operational information intended only for authenticated staff.

Examples

- Internal documentation
- Deployment procedures
- Monitoring dashboards
- Architecture documents
- Operational metrics

Requirements

- Authentication required
- HTTPS required
- Access logged

Retention

Business-defined

---

# Level 3 — Confidential

Definition

Business information whose disclosure could impact customers or operations.

Examples

- Patient names
- Phone numbers
- Email addresses
- Appointment history
- Conversation transcripts
- AI summaries
- Clinic configuration
- Business hours
- Analytics
- Audit logs

Requirements

- Authentication
- Authorization
- Tenant isolation
- Encryption in transit
- Encryption at rest
- Audit logging

Never exposed publicly.

---

# Level 4 — Restricted

Definition

Highly sensitive information requiring maximum protection.

Examples

- Password hashes
- Refresh token hashes
- JWT signing keys
- API keys
- OpenAI keys
- Twilio credentials
- Google OAuth secrets
- Database credentials
- Encryption keys
- Backup encryption keys

Requirements

- Never exposed via API
- Never logged
- Never sent to frontend
- Stored only in secure runtime configuration
- Rotatable
- Access strictly limited

---

# Patient Data

Patient information is classified as:

CONFIDENTIAL

Examples

- Name
- Phone number
- Email
- Appointment history
- Conversation history

Future medical records remain outside the MVP scope but should default to CONFIDENTIAL or higher depending on deployment requirements.

---

# Authentication Data

Passwords

RESTRICTED

Password Hashes

RESTRICTED

Refresh Tokens

RESTRICTED

JWT Access Tokens

CONFIDENTIAL (transient)

Session IDs

CONFIDENTIAL

---

# AI Data

Conversation Transcript

CONFIDENTIAL

Conversation Summary

CONFIDENTIAL

Intent

CONFIDENTIAL

Prompt Templates

INTERNAL

Tenant Prompt Configuration

CONFIDENTIAL

Provider Responses

CONFIDENTIAL

Token Usage Metrics

INTERNAL

---

# Provider Credentials

All provider credentials are RESTRICTED.

Examples

- OpenAI API Key
- Twilio Auth Token
- Google OAuth Client Secret
- SMTP Password
- Stripe Secret Key

These credentials:

- Never leave the backend
- Never appear in logs
- Never appear in client responses

---

# Logging Policy

Never log:

- Passwords
- Refresh tokens
- JWTs
- API keys
- OAuth secrets
- Encryption keys
- Full patient conversations unless explicitly required for secure debugging

Sensitive fields MUST be redacted before logging.

---

# API Responses

Public APIs SHALL return only the minimum required information.

Restricted data SHALL never be included.

Internal identifiers should remain internal whenever possible.

Public identifiers should be used for external APIs.

---

# Database Storage

Store only data required for business operations.

Avoid collecting unnecessary personal information.

Sensitive columns should support application-level encryption where appropriate.

---

# Backups

Backups inherit the highest classification of the data they contain.

Requirements

- Encrypted
- Access controlled
- Audited
- Periodically tested for restoration

---

# Data Retention

Retention periods should be configurable.

Examples

Audit Logs

Long retention

Conversation Recordings

Configurable

Temporary AI Processing Data

Short retention

Deleted Accounts

Retention according to legal and contractual obligations

---

# Data Deletion

Deletion must support:

- Soft deletion
- Retention policies
- Secure hard deletion after retention expires
- Audit of deletion requests

---

# Third-Party Sharing

Only the minimum required data may be shared with providers.

Examples

OpenAI

Conversation context only.

Twilio

Call metadata only.

Google Calendar

Appointment details only.

No provider receives unrelated tenant data.

---

# Multi-Tenant Requirements

Data belonging to one tenant MUST never be accessible to another tenant.

Every query MUST enforce tenant isolation.

Cross-tenant exports are prohibited.

---

# Security Requirements

Every subsystem SHALL classify newly introduced data.

Developers SHALL document classification when adding new fields.

Unknown data defaults to CONFIDENTIAL until reviewed.

---

# Compliance Readiness

This classification model supports future alignment with:

- HIPAA-aware deployments
- GDPR
- CCPA
- PIPEDA
- SOC 2

Compliance requirements may increase protection but shall never reduce it.

---

# Definition of Done

The data classification policy is complete when:

- Every major data category is classified.
- Storage requirements are documented.
- Logging requirements are documented.
- API exposure rules are defined.
- Retention guidance exists.
- Backup handling is defined.
- Security review completed.

---

# Guiding Principle

Collect the minimum data required.

Expose the minimum data necessary.

Retain data only as long as justified.

Protect sensitive information throughout its entire lifecycle.