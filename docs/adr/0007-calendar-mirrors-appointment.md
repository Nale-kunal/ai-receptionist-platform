# ADR 0007: Calendar Service Mirrors Appointment Service

## Status
Accepted

## Context
Telephony schedules sync with external calendars (e.g. Google Calendar). Treating external services as scheduling authority creates split-brain scenarios when external sync fails.

## Decision
The `Calendar` service mirrors the `Appointment` service. All creation, updates, and cancellations happen in the Appointment module first, and the Calendar service asynchronously syncs those changes.

## Consequences
- **Pros**: Local database operations remain fast, external integration failures do not block the patient scheduling flow.
- **Cons**: Introduce temporary sync lag between external calendar interfaces and local DB.

## Alternatives Considered
- Direct bi-directional writing between calendar connection APIs and the AI Engine. Rejected to ensure local database authority.
