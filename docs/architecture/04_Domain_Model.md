# Domain Model Specification

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# Purpose

This document defines the business domain of the AI Receptionist SaaS Platform.

Every engineer, AI model, API, service, database table, frontend component, and integration must use the terminology defined in this document.

This document establishes the ubiquitous language of the platform.

No module may redefine these concepts.

---

# Domain Philosophy

The platform models businesses rather than software.

The system should reflect how real receptionists think.

Not how databases work.

Business concepts come first.

Technical implementation comes second.

---

# Core Business Domains

The platform consists of the following business domains.

• Platform

• Tenant

• Authentication

• Clinic

• User

• Patient

• Doctor

• Appointment

• Conversation

• AI

• Voice

• Calendar

• Notification

• Analytics

• Billing (Future)

Every domain owns its own business rules.

---

# Platform

The Platform represents the SaaS application itself.

Responsibilities

• onboarding tenants

• licensing

• subscriptions

• administration

• monitoring

• feature flags

The Platform never stores clinic business logic.

---

# Tenant

Definition

A Tenant represents one independent business using the platform.

Examples

Smile Dental

Bright Dental

Healthy Smile Clinic

Every Tenant owns:

Users

Doctors

Patients

Appointments

Conversations

AI Prompt

Business Hours

Calendars

Phone Numbers

Configuration

Analytics

Logs

Settings

Feature Flags

No Tenant may access another Tenant's data.

Tenant Isolation is mandatory.

---

# Clinic

A Clinic represents the physical business.

Attributes

Clinic Name

Timezone

Address

Phone Number

Email

Working Hours

Holiday Schedule

Services

Website

Languages

Voice Configuration

Prompt Configuration

Calendar Configuration

The Clinic is the business identity.

---

# User

A User is an authenticated human.

Examples

Clinic Owner

Receptionist

Platform Admin

Super Admin

Users authenticate.

Patients do not.

Users belong to exactly one Tenant.

Platform administrators belong to the Platform.

---

# Patient

Definition

A Patient represents a customer interacting with the clinic.

Patients are identified primarily through:

Phone Number

Secondary identifiers:

Name

Email

Internal Patient ID

A Patient may have:

Many Conversations

Many Appointments

Many Notes

Many Call Records

Patients never authenticate into the platform.

---

# Doctor

Definition

A Doctor represents an appointment resource.

Responsibilities

Working Hours

Appointment Duration

Availability

Vacation

Calendar

Services

Doctors belong to one Tenant.

Future versions may support shared resources.

---

# Appointment

Definition

An Appointment represents a scheduled meeting between a Patient and a Doctor.

Status

Pending

Confirmed

Cancelled

Completed

No Show

Rescheduled

Every Appointment stores

Tenant

Doctor

Patient

Start Time

End Time

Timezone

Booking Source

Conversation

Audit Information

Appointments are immutable historical records.

Updates create audit history.

---

# Conversation

Definition

A Conversation represents one interaction between the AI and a caller.

A Conversation contains

Transcript

Summary

Intent

Entities

Call Duration

Recording Reference

Outcome

AI Provider

Voice Provider

Token Usage

Latency

Conversation State

Conversations belong to one Tenant.

One Patient may have many Conversations.

---

# AI Session

Definition

An AI Session represents the active reasoning process during one conversation.

Stores

Conversation State

Context

Extracted Information

Missing Information

Intent

Current Task

Confidence

Temporary Variables

The AI Session is temporary.

Permanent information belongs to the Conversation.

---

# Voice Session

Definition

Represents the active phone call.

Contains

Call SID

Provider

Stream

Connection State

Audio Buffers

Latency

Start Time

End Time

The Voice Session exists only during the call.

---

# Calendar

Definition

Represents synchronization with external calendars.

Current Provider

Google Calendar

Future

Outlook

Exchange

CalDAV

Calendar synchronization never becomes the source of truth.

---

# Notification

Definition

Represents communication sent to users.

Channels

SMS

Email

Future

WhatsApp

Push Notifications

Notification history must be stored.

---

# Analytics

Definition

Stores operational metrics.

Examples

Calls

Bookings

Missed Calls

Response Time

Average Duration

Appointment Conversion

Cancellation Rate

Analytics never affect business logic.

---

# AI Provider

Definition

Represents an implementation capable of understanding language.

Current

OpenAI GPT-4o Realtime

Future

Gemini

Claude

Azure

Groq

OpenRouter

Business logic must not depend on provider implementation.

---

# Telephony Provider

Current

Twilio

Future

Telnyx

Vonage

Plivo

Telephony provider abstraction is mandatory.

---

# Storage Provider

Current MVP

Metadata only.

Future

Cloudflare R2

AWS S3

Azure Blob

Google Cloud Storage

Storage abstraction required.

---

# Aggregate Roots

The following are aggregate roots.

Tenant

Clinic

Patient

Appointment

Conversation

User

No external module may modify child entities directly.

Aggregate roots enforce business invariants.

---

# Entity Relationships

Tenant

├── Users

├── Doctors

├── Patients

├── Appointments

├── Conversations

├── Calendars

├── Prompts

├── Notifications

└── Analytics

Patient

├── Conversations

└── Appointments

Doctor

└── Appointments

Conversation

└── AI Session

Appointment

└── Calendar Sync

---

# Ownership Rules

Every entity belongs to exactly one Tenant unless explicitly defined otherwise.

Every database query must enforce ownership.

Every API must validate ownership.

Ownership checks are mandatory.

---

# State Management

Temporary State

Voice Session

AI Session

Permanent State

Appointments

Patients

Conversations

Users

Doctors

Clinics

Configuration

Analytics

Never persist temporary state unnecessarily.

---

# Domain Events

Examples

PatientCreated

AppointmentBooked

AppointmentCancelled

AppointmentRescheduled

ConversationStarted

ConversationCompleted

ClinicUpdated

DoctorAvailabilityChanged

NotificationSent

Events describe business facts.

Events never contain business logic.

---

# Domain Rule

Every future feature must fit naturally into one of these business domains.

If a feature cannot be clearly assigned to a domain, the domain model should be reviewed before implementation.