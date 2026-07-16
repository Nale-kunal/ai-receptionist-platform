# Conversation Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Conversation Domain

---

# Purpose

This document defines the Conversation domain.

A Conversation represents a complete interaction between a caller and the AI Receptionist.

The Conversation module owns conversation lifecycle, transcript storage, AI summaries, extracted entities, recordings, metadata, and conversation history.

The Conversation module SHALL NOT perform AI inference or voice processing.

---

# Responsibilities

The Conversation module SHALL manage:

- Conversation lifecycle
- Transcript storage
- AI-generated summaries
- Extracted entities
- Conversation metadata
- Recording references
- Token usage
- Call duration
- Conversation status
- Audit history

The Conversation module SHALL NOT manage:

- Appointment business rules
- Patient identity
- Doctor identity
- AI model execution
- Voice streaming
- Notifications

---

# Ownership

Each conversation belongs to exactly:

One Tenant

↓

One Clinic

↓

One Patient (if identified)

↓

One Call Session

Every conversation SHALL remain isolated within its tenant.

---

# Conversation Identity

Each conversation SHALL contain:

Internal ID

Public ID

Tenant ID

Clinic ID

Patient ID (optional)

Call Session ID

Started At

Ended At

Duration

Status

Language

Created At

Updated At

---

# Conversation Status

Supported statuses:

Initiated

Active

Completed

Transferred (future)

Abandoned

Failed

Archived

Status transitions SHALL be validated.

---

# Transcript

Each conversation SHALL store:

Speaker

Timestamp

Message

Sequence Number

Confidence (optional)

Language

Transcript SHALL be immutable once finalized.

---

# AI Summary

After completion the AI may generate:

Conversation Summary

Primary Intent

Outcome

Recommended Follow-up

Action Items

The summary SHALL be editable only by authorized staff.

Original AI output SHALL remain preserved.

---

# Extracted Entities

The Conversation module SHALL support structured entities.

Examples:

Patient Name

Phone Number

Appointment Date

Appointment Time

Doctor Name

Intent

Reason for Visit

Language

Confidence Score

Entities SHALL be stored separately from transcripts.

---

# Recording

If call recording is enabled, store only:

Recording Reference

Provider

Duration

Storage Location

Recording Status

The module SHALL NOT store provider credentials.

---

# Token Usage

The Conversation module SHALL record:

Input Tokens

Output Tokens

Total Tokens

Estimated Cost

Model Used

Provider

Usage metrics support analytics and billing.

---

# Relationship with AI Engine

The AI Engine:

- Generates responses
- Extracts entities
- Produces summaries

The Conversation module stores the results.

The AI Engine SHALL NOT write directly to the database.

---

# Relationship with Voice Server

The Voice Server:

- Streams audio
- Produces transcripts

The Conversation module stores finalized conversation data.

---

# Relationship with Appointment Module

Conversation may request:

Book Appointment

Reschedule Appointment

Cancel Appointment

The Appointment module validates and executes these requests.

The Conversation module records the outcome.

---

# Search

Supported search fields:

Public ID

Patient

Phone Number

Date

Status

Intent

Language

Doctor

Duration

---

# Retention

Conversation retention SHALL be configurable.

Retention applies independently to:

Transcript

Summary

Recording

Metadata

Deletion SHALL follow platform retention policies.

---

# Security

Every conversation operation requires:

Authentication

Authorization

Tenant validation

Clinic validation

Audit logging

Conversation data SHALL be classified as Confidential.

Recordings SHALL require explicit authorization.

---

# Audit Events

Audit:

Conversation Started

Conversation Completed

Conversation Archived

Summary Updated

Recording Linked

Recording Removed

Retention Executed

Each audit record SHALL include:

Actor

Conversation

Clinic

Tenant

Timestamp

Request ID

---

# Performance

Indexes SHOULD exist for:

Tenant ID

Clinic ID

Patient ID

Public ID

Started At

Status

Intent

---

# Future Compatibility

The Conversation module SHALL support:

Multi-language conversations

Human handoff

Conversation tagging

Sentiment analysis

Quality scoring

AI evaluation

Multiple AI providers

Without architectural redesign.

---

# Testing Requirements

Verify:

Conversation creation

Transcript persistence

Entity extraction storage

Summary storage

Recording references

Retention policies

Search

Audit logging

Tenant isolation

Authorization

---

# Definition of Done

The Conversation module is complete only when:

Conversation lifecycle implemented

Transcript storage implemented

Summary storage implemented

Entity storage implemented

Recording references implemented

Audit logging implemented

Retention implemented

Search implemented

Tenant isolation verified

Tests passing

Documentation updated

Security review completed

---

# Guiding Principle

The Conversation module is the permanent record of every interaction.

It preserves what happened, while AI, Voice, and Appointment modules perform the work.

The Conversation module is the source of truth for conversation history.