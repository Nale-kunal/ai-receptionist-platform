# Calendar Module

**Version:** 1.0.0  
**Authority:** [12_Calendar_Contract.md](../../../docs/implementation-contracts/12_Calendar_Contract.md)  
**Status:** Active

---

## Purpose

The Calendar module is responsible for synchronizing platform appointments with external calendar targets (such as Google Calendar, Microsoft Outlook).

PostgreSQL (Appointment model) remains the sole authoritative source of truth. Calendar providers act as synchronization targets.

---

## Responsibilities

**Owns:**
- Calendar connections and connection status lifecycle (pending, connected, disconnected, expired, error, disabled)
- Encrypted storage of provider credentials (accessToken, refreshToken, tokenExpiry)
- Event creation, updates, and cancellations propagation to external providers
- Verification and processing of incoming webhooks
- Mapping and logging sync history

**Does NOT own:**
- Appointment business logic or validation
- Direct appointment mutations from calendar events (unless through verified webhooks)
- External provider OAuth server redirect/consent flow handling (managed out-of-band/frontend)

---

## Directory Structure

```
calendar/
  constants/   — CalendarProvider, CalendarConnectionStatus
  types/       — SafeCalendarConnection, AvailabilitySlot, SyncResult
  interfaces/  — ICalendarService, ICalendarRepository, ICalendarProvider
  errors/      — CalendarError hierarchy
  utils/       — AES token encryption/decryption utilities
  events/      — Domain events + InProcessCalendarEventPublisher
  dto/         — Infer DTO exports
  validators/  — Zod schemas (connect-calendar, list-connections)
  repositories/— CalendarRepository (Prisma)
  services/    — CalendarService (mock adapters, sync policies)
  controllers/ — CalendarController + calendarErrorHandler
  routes/      — createCalendarRouter route factory
  tests/       — Unit tests
  index.ts     — Barrel export
  README.md    — This file
```

---

## API Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `POST`   | `/api/v1/calendars`                  | `calendar.write` | Connect external calendar connection |
| `GET`    | `/api/v1/calendars`                  | `calendar.read`  | List calendar connections |
| `GET`    | `/api/v1/calendars/:id`              | `calendar.read`  | Get connection details by ID |
| `GET`    | `/api/v1/calendars/public/:publicId` | `calendar.read`  | Get connection details by public ID |
| `POST`   | `/api/v1/calendars/:id/disconnect`   | `calendar.write` | Disconnect calendar connection |
| `GET`    | `/api/v1/calendars/:id/availability` | `calendar.read`  | Retrieve availability busy slots |
| `POST`   | `/api/v1/calendars/webhooks/:provider`| `calendar.write` | Process incoming webhook event |

---

## Sync Events

Events propagated through `ICalendarEventPublisher`:
- `calendar.connected`
- `calendar.disconnected`
- `calendar.sync.started`
- `calendar.sync.completed`
- `calendar.sync.failed`
- `calendar.webhook.processed`
- `calendar.credential.updated`
