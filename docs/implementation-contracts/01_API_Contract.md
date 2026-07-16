# API Contract

Version: 1.0.0

Status: Active

Authority: API Standards

---

# Purpose

This document defines the global API standards for the Dental AI Receptionist SaaS platform.

Every HTTP endpoint, WebSocket endpoint, webhook, and internal service interface MUST comply with this contract.

No API may violate the conventions defined here.

---

# Objectives

The API must be:

- Predictable
- Consistent
- Versioned
- Secure
- Stateless
- RESTful
- Easily consumable
- Fully documented
- Backward compatible where practical

---

# Base URL

Development

/api/v1

Production

https://api.example.com/api/v1

---

# API Versioning

All endpoints SHALL include the version.

Example

/api/v1/appointments

Future versions

/api/v2/appointments

Breaking changes SHALL create a new version.

---

# HTTP Methods

GET

Retrieve resources.

Must never modify data.

POST

Create resources.

PUT

Replace an entire resource.

PATCH

Update part of a resource.

DELETE

Soft delete unless explicitly documented.

---

# Resource Naming

Use plural nouns.

Correct

/appointments

/patients

/doctors

/clinics

/conversations

Incorrect

/getAppointments

/createDoctor

/newPatient

---

# URI Standards

Resources

/appointments

Single resource

/appointments/{appointmentId}

Nested resource

/clinics/{clinicId}/doctors

Filters

/appointments?status=confirmed

Pagination

/appointments?page=1&limit=20

Sorting

/appointments?sort=startTime

Search

/patients?search=john

---

# Request Format

Request body

JSON only

UTF-8

Content-Type

application/json

---

# Response Format

Every response MUST follow this envelope.

Success

{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": ""
}

Failure

{
  "success": false,
  "error": {
    "code": "",
    "message": "",
    "details": []
  },
  "requestId": ""
}

---

# Pagination

Supported by every list endpoint.

Parameters

page

limit

Default limit

20

Maximum limit

100

Response

meta

page

limit

totalItems

totalPages

hasNext

hasPrevious

---

# Filtering

Supported through query parameters.

Examples

status

doctorId

patientId

date

startDate

endDate

clinicId

createdBy

---

# Sorting

Ascending

sort=name

Descending

sort=-createdAt

Multiple fields

sort=-createdAt,name

---

# Authentication

JWT Bearer Token

Authorization

Bearer <token>

Every protected endpoint MUST validate:

Signature

Expiration

Tenant

Permissions

Token version

---

# Authorization

Authorization SHALL use RBAC.

No endpoint may trust frontend permissions.

Backend is the source of truth.

---

# Multi-Tenant Isolation

Every request MUST resolve:

tenantId

clinicId

userId

No endpoint may access another tenant's data.

---

# Idempotency

Supported for:

Appointment creation

Payments

Webhook retries

Header

Idempotency-Key

Duplicate requests MUST not create duplicate records.

---

# Request Validation

Every request SHALL validate:

Headers

Route parameters

Query parameters

Body

File uploads

Validation occurs before business logic.

---

# Standard Headers

Required

Authorization

Content-Type

Accept

X-Request-ID

Optional

Idempotency-Key

---

# Rate Limiting

Public endpoints

Strict

Authenticated endpoints

Moderate

Internal services

Separate limits

Twilio webhooks

Dedicated limits

---

# Error Codes

400

Bad Request

401

Unauthorized

403

Forbidden

404

Not Found

409

Conflict

422

Validation Failed

429

Rate Limited

500

Internal Server Error

503

Service Unavailable

---

# Logging

Every request SHALL log:

Request ID

Tenant

User

Route

Method

Duration

Status Code

Never log:

Passwords

JWT

Refresh Tokens

API Keys

Patient medical notes

PII

Secrets

---

# Security Requirements

HTTPS only

HSTS

CORS whitelist

CSRF protection where applicable

Helmet security headers

Input validation

Output encoding

Request size limits

Webhook signature verification

Replay protection

Secret rotation support

---

# Webhook Standards

Every webhook SHALL:

Verify signature

Verify timestamp

Reject replay attacks

Return 2xx only after successful processing

Use idempotency

Log request ID

---

# Timeout Standards

API timeout

30 seconds

Webhook timeout

10 seconds

External provider timeout

15 seconds

AI provider timeout

Configurable

---

# Observability

Every endpoint SHALL expose:

Latency

Error rate

Request count

Success count

Failure count

---

# Documentation

Every endpoint MUST include:

Purpose

Authentication

Permissions

Request schema

Response schema

Error responses

Examples

Rate limits

---

# Backward Compatibility

Minor releases SHALL remain compatible.

Breaking changes require:

New API version

Migration documentation

Deprecation notice

---

# Definition of Done

An API endpoint is complete only when:

Request validation implemented

Authentication enforced

Authorization enforced

Tenant isolation verified

Logging implemented

Error handling standardized

Tests passing

Documentation completed

Security review passed