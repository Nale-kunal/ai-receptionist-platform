# ADR 0006: Appointment Service is Single Source of Truth for Scheduling

## Status
Accepted

## Context
Scheduling involves complex logic (clinic hours, leaves, time zone offsets, conflicts). Duplicating scheduling states or logic inside AI modules or external calendars causes synchronization conflicts.

## Decision
The `Appointment` module is the sole source of truth for scheduling rules, conflicts validation, and booking state storage. The AI Engine and Voice Server can only request scheduling options or dispatch booking actions through the Appointment module.

## Consequences
- **Pros**: Strong consistency, isolated scheduling rules.
- **Cons**: Requires mapping structured tool calls back to backend services.

## Alternatives Considered
- Direct writing to database tables or external calendar models by the AI Engine. Rejected as a severe violation of separation of concerns.
