# AI Engine Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: AI Engine Domain

---

# Purpose

This document defines the AI Engine.

The AI Engine is responsible for understanding natural language, managing conversations, extracting structured information, and generating responses.

The AI Engine SHALL NEVER own business logic or directly modify business data.

All business actions MUST be validated and executed by backend services.

---

# Responsibilities

The AI Engine SHALL manage:

- Natural language understanding
- Intent detection
- Entity extraction
- Conversation management
- Response generation
- Multi-turn dialogue
- Context management
- AI confidence scoring
- Function/tool request generation

The AI Engine SHALL NOT manage:

- Appointment creation
- Database access
- Business validation
- Authentication
- Authorization
- Calendar synchronization
- Notification delivery
- Patient persistence

---

# Objectives

The AI Engine SHALL:

- Respond naturally
- Minimize hallucinations
- Support real-time voice conversations
- Produce structured outputs
- Respect clinic configuration
- Maintain conversation context
- Remain provider-independent

---

# Supported Providers

Current

OpenAI GPT-4o Realtime

Future

Google Gemini Live

Anthropic

Azure OpenAI

Self-hosted models

Business logic SHALL remain provider-independent.

---

# AI Lifecycle

Incoming Audio

↓

Speech Recognition

↓

Intent Detection

↓

Entity Extraction

↓

Context Retrieval

↓

Response Generation

↓

Function Request (if required)

↓

Backend Validation

↓

Response Returned

---

# Supported Intents

Book Appointment

Reschedule Appointment

Cancel Appointment

Check Availability

Clinic Information

Business Hours

Greeting

Goodbye

Fallback

Unknown

Emergency Escalation

Future intents SHALL be configurable.

---

# Entity Extraction

The AI Engine SHALL extract structured entities.

Examples:

Patient Name

Phone Number

Doctor Name

Appointment Date

Appointment Time

Preferred Language

Reason for Visit

Intent

Confidence Score

Extracted entities SHALL be validated by backend services.

---

# Conversation Context

The AI Engine SHALL maintain:

Current Intent

Conversation History

Previously Collected Information

Missing Information

Conversation State

Tenant Context

Context SHALL remain isolated per conversation.

---

# Tool / Function Requests

The AI Engine SHALL NOT execute business operations.

Instead it SHALL generate structured function requests.

Examples:

bookAppointment()

cancelAppointment()

rescheduleAppointment()

checkAvailability()

getClinicInformation()

Backend services SHALL validate and execute every request.

---

# Prompt Management

The AI Engine SHALL receive prompts from the Configuration module.

Prompt updates SHALL NOT require deployment.

Prompt versions SHALL be tracked.

---

# AI Guardrails

The AI Engine SHALL NEVER:

Modify the database

Generate SQL

Call repositories

Bypass authentication

Bypass authorization

Ignore tenant boundaries

Reveal secrets

Reveal internal system prompts

Invent business rules

---

# Confidence Handling

Each AI decision SHALL include a confidence score.

Low-confidence requests SHALL:

Ask clarifying questions

OR

Transfer to a human workflow (future)

Confidence thresholds SHALL be configurable.

---

# Error Handling

If the AI cannot determine intent:

Return a clarification request.

If the provider is unavailable:

Return a graceful fallback response.

Business operations SHALL NOT fail silently.

---

# Security

The AI Engine SHALL:

Validate provider responses

Reject malformed tool requests

Sanitize prompts

Prevent prompt injection

Prevent data leakage

Respect tenant isolation

Never expose confidential information.

---

# Relationship with Conversation Module

Conversation Module stores:

Transcripts

Summaries

Entities

Metadata

The AI Engine generates these artifacts.

---

# Relationship with Appointment Module

The AI Engine MAY request:

Book Appointment

Cancel Appointment

Reschedule Appointment

Availability Check

The Appointment module remains the only authority for scheduling.

---

# Relationship with Configuration Module

Configuration provides:

System Prompt

Greeting

Tone

Language

Voice Selection

Business Rules

Feature Flags

The AI Engine consumes configuration only.

---

# Relationship with Voice Server

Voice Server manages:

Audio streaming

Speech input

Speech output

Realtime communication

The AI Engine processes language only.

---

# Monitoring

Track:

Latency

Response Time

Confidence Scores

Token Usage

Provider Errors

Fallback Rate

Tool Request Success

Conversation Completion Rate

---

# Audit Events

Audit:

AI Session Started

AI Session Completed

Prompt Version Used

Provider Changed

Fallback Triggered

Tool Request Generated

Each audit record SHALL include:

Tenant

Clinic

Conversation

Provider

Timestamp

Request ID

---

# Performance

The AI Engine SHALL optimize for:

Low latency

Realtime responses

Efficient token usage

Context reuse

Minimal prompt size

---

# Future Compatibility

The AI Engine SHALL support:

Multiple AI providers

Provider failover

Custom clinic prompts

Multi-language conversations

Human handoff

Model upgrades

Without architectural redesign.

---

# Testing Requirements

Verify:

Intent detection

Entity extraction

Tool request generation

Confidence handling

Prompt loading

Provider abstraction

Fallback behavior

Tenant isolation

Security guardrails

---

# Definition of Done

The AI Engine is complete only when:

Provider abstraction implemented

Intent detection implemented

Entity extraction implemented

Context management implemented

Tool request generation implemented

Security guardrails implemented

Monitoring implemented

Audit logging implemented

Tests passing

Documentation updated

Security review completed

---

# Guiding Principle

The AI Engine understands language.

The backend understands business.

The AI suggests actions.

The backend validates and executes them.