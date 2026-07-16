# Clinic Module

The Clinic Module manages physical location entities and identity profiles for the Dental AI Receptionist platform.

## Design Architecture

```
                                  +-----------------------+
                                  |    HTTP Middleware    |
                                  | (Tenant Resolution &  |
                                  |   Context Builder)    |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |     ClinicRouter      |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |   ClinicController    |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |     ClinicService     |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |   ClinicRepository    |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |      Prisma Client    |
                                  +-----------------------+
```

### 1. Responsibilities
- Manages clinic name, contact details, timezone, country, and lifecycle status.
- Associates clinics with exactly one `Tenant` and exactly one `User` (the clinic owner).
- Stores configuration relationship pointers (`clinicId` links to `Configuration`).

### 2. Status Lifecycle Transitions
Valid status paths:
- `pending_setup` ➔ `active` / `deleted`
- `active` ➔ `suspended` / `archived` / `deleted`
- `suspended` ➔ `active` / `deleted`
- `archived` ➔ `active` / `deleted`
- `deleted` ➔ `active` (path for restoration)

### 3. Soft Delete and Isolation
Clinics support soft deletion. A soft-deleted clinic has its `deletedAt` field populated and status set to `deleted`, which immediately blocks runtime authentication, telephony routing, and scheduling access. Every operation enforces tenant isolation guards.
