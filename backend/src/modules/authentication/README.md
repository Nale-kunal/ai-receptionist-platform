# Authentication Module

Version: 1.0.0

Status: Active

---

## Purpose

The Authentication module is responsible for identity verification on the AI Receptionist SaaS Platform.

It is NOT responsible for authorization (RBAC) or tenant management. Those are separate modules.

---

## Responsibilities

- User registration (email + password)
- Email verification (single-use token, 24h TTL)
- Login (Argon2id password verification, session creation)
- Access token issuance (JWT, 15 min TTL)
- Refresh token rotation (opaque, 30 day TTL, hash-only storage)
- Logout (session revocation)
- Forgot password (enumeration-resistant)
- Password reset (single-use token, 1h TTL, session invalidation)
- Session management (per-login, device-tracked)
- Account locking (10 failed attempts, 15 min lockout)
- Audit event publishing for all state changes

---

## Architecture

```
Controller → Service → Repository → Prisma
```

No layer may skip a level. Controllers never access the database.
Repositories contain no business logic.

---

## Public Interface

Import from the module index only:

```typescript
import {
  AuthService,
  TokenService,
  SessionService,
  createAuthRouter,
  createAuthenticateMiddleware,
  AuthError,
  // ... types
} from './modules/authentication';
```

Do not import from internal paths (`services/`, `repositories/`, etc.) from outside this module.

---

## API Endpoints

| Method | Path | Auth | Rate Limit |
|--------|------|------|------------|
| POST | `/api/v1/auth/register` | Public | Strict |
| POST | `/api/v1/auth/login` | Public | Strict |
| POST | `/api/v1/auth/logout` | Bearer | Moderate |
| POST | `/api/v1/auth/refresh` | Cookie | Refresh |
| POST | `/api/v1/auth/forgot-password` | Public | Strict |
| POST | `/api/v1/auth/reset-password` | Public | Strict |
| POST | `/api/v1/auth/verify-email` | Public | Strict |
| POST | `/api/v1/auth/resend-verification` | Public | Strict |

---

## Security Design

### Passwords
- Argon2id with 64 MiB memory, 3 iterations, 1 parallelism
- Minimum 12 characters, uppercase + lowercase + digit + special character required
- Never stored in plaintext; never logged

### JWT Access Tokens
- HS256 algorithm
- 15 minute TTL
- Contains: userId, tenantId, clinicId, role, tokenVersion, sessionId, email
- Secret validated at startup (minimum 32 characters)

### Refresh Tokens
- Cryptographically random (48 bytes via `crypto.randomBytes`)
- URL-safe base64 encoded
- SHA-256 hashed before storage (raw token never persisted)
- 30 day TTL
- Rotated on every use
- Reuse detected → entire session revoked immediately

### Cookies
- HttpOnly: prevents JavaScript access
- Secure: HTTPS only in production
- SameSite=Strict: CSRF protection
- Path restricted to `/api/v1/auth`

### Timing Attack Protection
- Password verification always runs even if user not found (dummy hash comparison)
- Refresh token hash comparison uses `crypto.timingSafeEqual`

### Account Locking
- 10 failed login attempts triggers a 15-minute lock
- Lock state cleared on successful login

### Token Revocation
- Individual session: logout, admin action
- All sessions: password reset, security incident
- Token version increment: invalidates all previously issued access tokens

---

## Events Published

| Event | Trigger |
|-------|---------|
| `auth.user.registered` | New user created |
| `auth.user.login.success` | Successful login |
| `auth.user.login.failed` | Failed login attempt |
| `auth.user.logout` | Logout |
| `auth.token.refreshed` | Token rotation |
| `auth.token.reuse_detected` | Refresh token presented after rotation |
| `auth.session.revoked` | Individual session revoked |
| `auth.session.all_revoked` | All sessions revoked |
| `auth.password.reset_requested` | Forgot password submitted |
| `auth.password.reset_completed` | Password reset completed |
| `auth.email.verification_sent` | Verification email dispatched |
| `auth.email.verified` | Email address confirmed |
| `auth.account.locked` | Account locked after repeated failures |

---

## Dependencies

### Internal
- `PrismaClient` — database access (injected)
- Config layer — JWT secrets (never `process.env` directly)

### External
- `argon2` — password hashing
- `jsonwebtoken` — JWT signing/verification
- `zod` — request validation
- `crypto` (Node built-in) — token generation and hashing

---

## Configuration

All secrets are consumed via the config layer, not `process.env` directly.

Required environment variables:
- `JWT_ACCESS_SECRET` — minimum 32 characters
- `JWT_REFRESH_SECRET` — minimum 32 characters

Optional:
- `JWT_ACCESS_TTL_SECONDS` — defaults to 900 (15 minutes)
- `JWT_REFRESH_TTL_SECONDS` — defaults to 2592000 (30 days)

---

## Testing

```bash
# Run all authentication module tests
jest --testPathPattern=modules/authentication

# Unit tests only
jest --testPathPattern=modules/authentication/tests/token.service
jest --testPathPattern=modules/authentication/tests/auth.service
jest --testPathPattern=modules/authentication/tests/session.service
jest --testPathPattern=modules/authentication/tests/validators

# Integration tests
jest --testPathPattern=modules/authentication/tests/auth.integration

# Repository tests
jest --testPathPattern=modules/authentication/tests/user.repository
```

---

## Definition of Done

- [x] Password hashing implemented (Argon2id)
- [x] JWT implemented (HS256, 15 min TTL)
- [x] Refresh rotation implemented (opaque, 30 day, hash-only)
- [x] Email verification architecture implemented
- [x] Password reset architecture implemented
- [x] Rate limiting hooks implemented (injected, not hard-coded)
- [x] Session management complete (per-login, device-tracked)
- [x] Audit logging complete (all auth events published)
- [x] Tenant awareness implemented (tenantId in all tokens and sessions)
- [x] Security requirements satisfied
- [x] Tests implemented
- [x] Documentation updated
