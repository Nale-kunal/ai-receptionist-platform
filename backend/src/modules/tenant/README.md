# Tenant Module

The `Tenant` module manages the multi-tenant architecture lifecycle of the AI Receptionist SaaS Platform. It ensures logical separation of business data, configuration settings, AI profiles, and resource accessibility across thousands of customer organizations.

## Core Capabilities

1. **Tenant Persistence**: Create, retrieve, update, and soft-delete tenants in a PostgreSQL database using Prisma.
2. **Branding & Localization**: Customize timezone, country, language, subscription plans, and branding configuration at the tenant level.
3. **Tenant Lifecycle management**:
   - `created` -> `provisioned` -> `active`
   - Administrative `suspend` and `archive` operations.
   - Soft deletion (transitions state to `deleted` and sets `deletedAt`).
   - Tenant restoration (reverses soft deletion and places tenant back in `active`).
4. **Tenant Resolution Middleware**:
   - Resolves tenant contextual identifiers from JWT payloads, route parameters, custom headers (`x-tenant-id`, `x-tenant-slug`), API keys, or Twilio webhook payloads.
   - Enforces strict tenancy isolation rules (suspended accounts are blocked; archived accounts are restricted to read-only actions).
5. **Auditable Events**: Dispatches in-process domain events for all lifecycle actions to integrate with audit trails.

## State Transition Machine

The lifecycle status transitions are strictly validated in `TenantService`:

```
[created] -------------> [provisioned] -------------> [active] <=======> [suspended]
    |                         |                          |
    |                         |                          +=============> [archived]
    v                         v                          |
[deleted] <---------------+---+--------------------------+
```

* Restoring a `deleted` tenant returns it back to `active` state.
