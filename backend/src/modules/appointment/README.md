# Appointment Module

**Version:** 1.0.0  
**Authority:** [09_Appointment_Contract.md](../../../docs/implementation-contracts/09_Appointment_Contract.md)  
**Status:** Active

---

## Purpose

The Appointment module is the **single source of truth for all scheduling operations** on the AI Receptionist SaaS Platform.

Every booking, reschedule, cancellation, and status change **must** pass through this module.  
No external system (AI, Voice, Calendar) may modify appointment state without going through the Appointment Service.

---

## Responsibilities

**Owns:**
- Appointment creation (booking)
- Appointment updates (notes)
- Appointment rescheduling
- Appointment cancellation
- Appointment status lifecycle
- Conflict detection (double-booking prevention)
- Audit event publishing

**Does NOT own:**
- Patient identity (Patient module)
- Doctor identity (Doctor module)
- AI conversations (Conversation module)
- Notifications (Notification module)
- Calendar synchronization (Calendar module)
- Voice processing (Voice Server)

---

## Status State Machine

```
pending ──────────────────────────────> confirmed
   │                                        │
   ├──────────────────> cancelled           ├──────> rescheduled ──> confirmed
   │                                        │                    └──> cancelled
   └──────────────────> no_show            ├──────> completed (terminal)
                                           ├──────> cancelled (terminal)
                                           └──────> no_show (terminal)
```

Terminal statuses (cancelled, completed, no_show) accept no further transitions.

---

## Directory Structure

```
appointment/
  constants/   — AppointmentStatus, AppointmentSource, route prefix
  types/       — SafeAppointment output type
  interfaces/  — IAppointmentService, IAppointmentRepository, Params
  errors/      — AppointmentError hierarchy
  events/      — Domain event types + in-process publisher
  dto/         — Barrel export of Zod-inferred DTO types
  validators/  — Zod schemas (create, update, reschedule, cancel, list)
  repositories/— AppointmentRepository (Prisma)
  services/    — AppointmentService (business logic)
  controllers/ — AppointmentController + appointmentErrorHandler
  routes/      — createAppointmentRouter factory
  tests/       — Unit tests
  index.ts     — Barrel export
  README.md    — This file
```

---

## API Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `POST`   | `/api/v1/appointments`                | `appointment.create`     | Book appointment |
| `GET`    | `/api/v1/appointments`                | `appointment.read`       | List/search |
| `GET`    | `/api/v1/appointments/public/:publicId` | `appointment.read`     | Get by public ID |
| `GET`    | `/api/v1/appointments/:id`            | `appointment.read`       | Get by internal ID |
| `PATCH`  | `/api/v1/appointments/:id`            | `appointment.update`     | Update notes |
| `POST`   | `/api/v1/appointments/:id/confirm`    | `appointment.update`     | Confirm |
| `POST`   | `/api/v1/appointments/:id/cancel`     | `appointment.cancel`     | Cancel |
| `POST`   | `/api/v1/appointments/:id/reschedule` | `appointment.reschedule` | Reschedule |
| `POST`   | `/api/v1/appointments/:id/complete`   | `appointment.update`     | Complete |
| `POST`   | `/api/v1/appointments/:id/no-show`    | `appointment.update`     | Mark no-show |

---

## Business Rules

1. Tenant isolation enforced on every operation
2. Doctor and patient must belong to the target clinic
3. Clinic must be active (not suspended or deleted)
4. Doctor must be active
5. Patient must be active
6. No overlapping appointments for the same doctor (double-booking prohibited)
7. `endTime` must be strictly after `startTime`
8. Status transitions validated via state machine
9. Terminal statuses are immutable

---

## Audit Events

All events include: `tenantId`, `clinicId`, `doctorId`, `patientId`, `appointmentId`, `actorId`, `requestId`, `occurredAt`

| Event | Type String |
|-------|------------|
| Appointment Created     | `appointment.created`     |
| Appointment Updated     | `appointment.updated`     |
| Appointment Confirmed   | `appointment.confirmed`   |
| Appointment Cancelled   | `appointment.cancelled`   |
| Appointment Rescheduled | `appointment.rescheduled` |
| Appointment Completed   | `appointment.completed`   |
| Appointment No Show     | `appointment.no_show`     |
