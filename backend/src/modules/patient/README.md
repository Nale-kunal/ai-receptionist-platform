# Patient Module

The Patient Module manages individuals who interact with a clinic through the AI Receptionist.

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
                                  |     PatientRouter     |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |   PatientController   |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |     PatientService    |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |   PatientRepository   |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |      Prisma Client    |
                                  +-----------------------+
```

### 1. Responsibilities
- Manages patient identity, display names, phone numbers, emails, date of births, and preferred language.
- Enforces uniqueness constraints: phone numbers must uniquely identify a patient within a clinic.
- Verifies clinic ownership and tenant boundaries for security isolation.

### 2. Status Lifecycle Transitions
Valid status paths:
- `active` ➔ `inactive` / `blocked` / `archived` / `deleted`
- `inactive` ➔ `active` / `blocked` / `deleted`
- `blocked` ➔ `active` / `inactive` / `deleted`
- `archived` ➔ `active` / `deleted`
- `deleted` ➔ `active` (restoration route)

### 3. Soft Delete and Isolation
Every operation isolates query parameters under the tenant and clinic context. A soft-deleted patient is hidden by default and cannot create appointments or participate in active conversations.
