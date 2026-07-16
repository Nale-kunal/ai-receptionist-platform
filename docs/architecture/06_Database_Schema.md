# Database Schema Specification

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Approved

Priority: Critical

---

# Purpose

This document defines every persistent business entity of the platform.

It is NOT a Prisma schema.

It is the business specification from which the Prisma schema will be generated.

Every database table must exist because of a business requirement.

No unnecessary tables should exist.

---

# Database Philosophy

The schema models the business.

Not the UI.

Not the API.

Not the implementation.

---

# Database Technology

Database

PostgreSQL

ORM

Prisma

Primary Key

UUID Version 7

Public Identifier

Human friendly prefixed IDs

Examples

clinic_xxxxxxxxx

patient_xxxxxxxxx

doctor_xxxxxxxxx

appointment_xxxxxxxxx

conversation_xxxxxxxxx

---

# Standard Entity Fields

Every persistent business entity must contain:

id

publicId

tenantId (except platform-level entities)

createdAt

updatedAt

deletedAt

createdBy

updatedBy

version

metadata

No exceptions unless documented.

---

# Platform Entity

Purpose

Represents the SaaS platform itself.

Contains:

Platform configuration

Feature flags

Global settings

System defaults

This table is expected to contain one record.

---

# Tenant Entity

Purpose

Represents one customer organization.

Examples

Smile Dental

Healthy Smile

Bright Dental

Attributes

Name

Slug

Subscription

Status

Timezone

Country

Language

Primary Contact

Branding

Feature Flags

Relationships

One Tenant

↓

Many Clinics

Many Users

Many Doctors

Many Patients

Many Conversations

Many Appointments

Many Notifications

Many AI Prompts

---

# Clinic Entity

Purpose

Represents the physical clinic.

Fields

Clinic Name

Phone Number

Email

Address

Timezone

Website

Business Hours

Holiday Calendar

Voice Configuration

AI Configuration

Google Calendar Configuration

Twilio Configuration

Status

Future Support

Multiple clinic locations.

---

# User Entity

Purpose

Authenticated platform users.

Fields

First Name

Last Name

Email

Password Hash

Role

Status

Last Login

Password Changed At

Email Verified

MFA Enabled

Relationships

Belongs to Tenant.

---

# Role Entity

Purpose

Permission grouping.

Examples

Clinic Owner

Receptionist

Platform Admin

Super Admin

Roles never contain business logic.

---

# Permission Entity

Purpose

Permission-based RBAC.

Examples

appointment.create

appointment.update

appointment.cancel

patient.view

conversation.view

analytics.view

Permissions should be configurable.

---

# Doctor Entity

Purpose

Appointment resource.

Fields

Name

Specialization

Working Hours

Appointment Duration

Color

Calendar Provider

Calendar ID

Status

Future

Multiple calendars.

---

# Patient Entity

Purpose

Represents a caller.

Fields

First Name

Last Name

Phone Number

Email

Preferred Language

Date of Birth (optional)

Notes

Status

Relationships

One Patient

↓

Many Appointments

Many Conversations

---

# Appointment Entity

Purpose

Represents one scheduled appointment.

Fields

Patient

Doctor

Start Time UTC

End Time UTC

Timezone

Status

Booking Source

Reason

Notes

Confirmation Status

Calendar Sync Status

Conversation Reference

Business Rules

Cannot overlap.

Must belong to one Tenant.

Must belong to one Patient.

Must belong to one Doctor.

Must pass business validation.

---

# Conversation Entity

Purpose

Stores every completed conversation.

Fields

Patient

Transcript

Summary

Intent

Outcome

Token Usage

Latency

Duration

Call SID

Recording URL

AI Provider

Voice Provider

Conversation Status

Conversation records are immutable after completion except for internal processing metadata.

---

# AI Prompt Entity

Purpose

Stores prompt configuration.

Fields

Greeting

System Prompt

Tone

Language

Business Rules

Fallback Responses

Version

Prompt changes should never require deployment.

---

# Business Hours Entity

Purpose

Defines weekly operating schedule.

Supports

Multiple shifts

Lunch breaks

Closed days

Future

Seasonal schedules.

---

# Holiday Entity

Purpose

Defines clinic closure dates.

Fields

Date

Reason

Recurring

Status

Booking engine must respect holidays.

---

# Notification Entity

Purpose

Stores outbound communication.

Channels

SMS

Email

Future

WhatsApp

Push

Fields

Recipient

Channel

Status

Provider

Retry Count

Sent At

Delivery Status

---

# Calendar Connection Entity

Purpose

Represents calendar integrations.

Current

Google Calendar

Future

Outlook

Exchange

CalDAV

Stores

OAuth Tokens

Refresh Tokens

Expiry

Calendar IDs

Sensitive fields encrypted.

---

# Telephony Connection Entity

Purpose

Stores telephony configuration.

Current

Twilio

Future

Telnyx

Vonage

Plivo

Stores

Phone Number

Provider

Webhook Configuration

Credentials Reference

Secrets must never be stored in plaintext.

---

# AI Provider Configuration Entity

Purpose

Stores provider settings.

Current

OpenAI

Future

Gemini

Claude

Azure

Stores

Provider

Model

Temperature

Voice

Fallback Provider

Rate Limits

---

# Audit Log Entity

Purpose

Immutable history.

Stores

Actor

Action

Entity

Entity ID

Old Value

New Value

Timestamp

Request ID

IP Address

Audit logs are append-only.

---

# API Key Entity

Purpose

Stores tenant API credentials.

Fields

Name

Prefix

Hash

Permissions

Last Used

Expiry

Revoked

Never store plaintext API keys.

---

# Usage Entity

Purpose

Tracks platform consumption.

Examples

Minutes

Calls

Tokens

SMS

Appointments

Storage

Supports future billing.

---

# Feature Flag Entity

Purpose

Tenant feature control.

Examples

SMS Enabled

Recording Enabled

AI Enabled

Voice Enabled

Future Premium Features

No deployment required to enable features.

---

# Entity Ownership

Every entity belongs to exactly one Tenant except:

Platform

Platform Admin

Global Feature Definitions

Global Configuration

Ownership must be enforced by the backend and database.

---

# Soft Delete Policy

Business entities use deletedAt.

Never physically delete production business data.

Exceptions

Temporary cache

Expired sessions

Background job locks

---

# Lifecycle

Entity lifecycle must be documented before implementation.

Example

Appointment

Created

↓

Confirmed

↓

Completed

↓

Archived

Every lifecycle transition must be validated.

---

# Schema Guiding Principle

Every table must represent a real business concept.

If an entity exists only because it simplifies code, redesign the application instead of polluting the database.