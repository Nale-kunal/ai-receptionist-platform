# Doctor Module

The Doctor Module manages healthcare providers who offer appointments within a clinic.

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
                                  |     DoctorRouter      |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |   DoctorController    |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |     DoctorService     |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |   DoctorRepository    |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |      Prisma Client    |
                                  +-----------------------+
```

### 1. Responsibilities
- Manages doctor identity, display names, specializations, license numbers, and profile photos.
- Manages availability exceptions, leaves, and working hours defaults.
- Verifies clinic ownership and tenant boundaries for security isolation.

### 2. Status Lifecycle Transitions
Valid status paths:
- `active` ➔ `inactive` / `unavailable` / `archived` / `deleted`
- `inactive` ➔ `active` / `unavailable` / `deleted`
- `unavailable` ➔ `active` / `inactive` / `deleted`
- `archived` ➔ `active` / `deleted`
- `deleted` ➔ `active` (path for restoration)

### 3. Soft Delete and Isolation
Every operation isolates query parameters under the tenant context. A soft-deleted doctor is hidden by default and cannot receive bookings or appear in availability slots.
