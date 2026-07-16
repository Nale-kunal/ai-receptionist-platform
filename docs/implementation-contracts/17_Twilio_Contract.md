# Twilio Contract

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Telephony Provider Integration

---

# Purpose

This document defines the integration contract between the AI Receptionist SaaS Platform and Twilio.

Twilio provides telephony services only.

Business logic SHALL remain inside the backend.

The Twilio Adapter SHALL remain replaceable without affecting business modules.

---

# Responsibilities

The Twilio Adapter SHALL manage:

- Incoming calls
- Outgoing calls (future)
- Media Streams
- TwiML generation
- Webhook processing
- Call status callbacks
- Recording callbacks
- Provider authentication
- Provider error handling

The adapter SHALL NOT manage:

- Appointment business rules
- AI logic
- Database persistence
- Notifications
- Authentication
- Authorization

---

# Objectives

The Twilio Adapter SHALL provide:

- Reliable call handling
- Secure webhook processing
- Low-latency media streaming
- Provider abstraction
- Graceful recovery

---

# Supported Services

Current

- Programmable Voice
- Media Streams
- Status Callbacks
- Recording Callbacks

Future

- SMS
- Verify
- WhatsApp
- SIP
- Flex

---

# Call Lifecycle

Incoming Call

↓

Twilio Webhook

↓

Webhook Validation

↓

Resolve Tenant

↓

Generate TwiML

↓

Start Media Stream

↓

Voice Server

↓

OpenAI Realtime

↓

Backend

↓

Call Completed

↓

Persist Conversation

↓

Close Session

---

# TwiML Generation

The adapter SHALL generate TwiML dynamically.

TwiML SHALL contain:

- Greeting
- Media Stream endpoint
- Call configuration
- Recording configuration (if enabled)

Business logic SHALL NOT exist inside TwiML.

---

# Media Streams

The adapter SHALL support:

Realtime inbound audio

Realtime outbound audio

Bidirectional streaming

Reconnect handling

Stream termination

Media Streams SHALL communicate only with the Voice Server.

---

# Webhook Validation

Every webhook SHALL verify:

Twilio Signature

Timestamp (when applicable)

Request integrity

Expected endpoint

Invalid requests SHALL be rejected immediately.

---

# Tenant Resolution

The adapter SHALL resolve the tenant using:

Twilio Phone Number

↓

Clinic Mapping

↓

Tenant Context

No call may proceed without successful tenant resolution.

---

# Status Callbacks

Supported callback events:

Initiated

Ringing

Answered

In Progress

Completed

Busy

Failed

No Answer

Canceled

Each callback SHALL update call state and generate audit events.

---

# Recording

If recording is enabled:

Twilio stores recording

↓

Recording callback received

↓

Recording reference stored

↓

Conversation updated

Recording files SHALL NOT be stored directly by the adapter.

---

# Error Handling

Temporary failures:

Retry where appropriate

↓

Log

↓

Notify monitoring

Permanent failures:

Terminate call gracefully

↓

Return fallback message if possible

---

# Security

The Twilio Adapter SHALL:

Validate signatures

Use HTTPS only

Protect credentials

Prevent replay attacks

Restrict webhook endpoints

Encrypt provider credentials

Never expose Auth Tokens

---

# Monitoring

Track:

Incoming calls

Completed calls

Dropped calls

Average duration

Media stream failures

Webhook failures

Provider latency

Recording failures

---

# Audit Events

Audit:

Incoming Call

Call Connected

Call Completed

Call Failed

Media Stream Started

Media Stream Ended

Recording Linked

Webhook Processed

Each audit entry SHALL include:

Tenant

Clinic

Call SID

Conversation ID

Timestamp

Request ID

---

# Performance

Target:

Low webhook latency

Reliable streaming

Fast tenant resolution

Minimal TwiML generation time

High provider availability

---

# Relationship with Voice Server

Twilio provides:

Audio

Call events

Media Streams

The Voice Server:

Processes audio

Communicates with AI

Maintains realtime session

---

# Relationship with Conversation Module

After call completion:

Twilio

↓

Voice Server

↓

Conversation Module

Store:

Transcript

Summary

Recording Reference

Metadata

Duration

---

# Provider Credentials

The adapter SHALL require:

Account SID

Auth Token

API Key (optional)

API Secret (optional)

Credentials SHALL be loaded through the Configuration Layer.

Credentials SHALL NEVER be hardcoded.

---

# Future Compatibility

The adapter SHALL support:

Multiple Twilio numbers

Regional routing

Outbound calling

Warm transfer

Cold transfer

Call queues

Without architectural redesign.

---

# Testing Requirements

Verify:

Webhook validation

TwiML generation

Media Streams

Tenant resolution

Status callbacks

Recording callbacks

Credential loading

Audit logging

Tenant isolation

Failure recovery

---

# Definition of Done

The Twilio integration is complete only when:

Webhook validation implemented

Media Streams implemented

Status callbacks implemented

Recording callbacks implemented

Tenant resolution implemented

Monitoring implemented

Audit logging implemented

Credential protection implemented

Tests passing

Documentation updated

Security review completed

---

# Guiding Principle

Twilio provides telephony.

The Voice Server manages conversations.

The backend owns business logic.

The Twilio Adapter only translates between the platform and the telephony provider.