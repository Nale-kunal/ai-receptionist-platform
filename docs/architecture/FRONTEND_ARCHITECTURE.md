# Frontend Architecture & Design System Guide

This document describes the design, routing model, state management, and API layers of the **Enterprise Frontend Dashboard** in `frontend/`.

---

## 1. Sequence & Application Flow

```text
               User Interface
                     │
                     ▼
          AppRouter (RBAC Guard)
                     │
                     ▼
             Layout Container
           (Theme/Tenant/Toasts)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   Active Pages              API Client
 (Live Console, Appts)    (HTTP / Mock Fallback)
```

---

## 2. Global State & Theme Integration

The core client state is defined inside [AppContext.tsx](file:///f:/Dental-AI-Receptionist-SaaS/frontend/src/contexts/AppContext.tsx):
- **Authentication & Roles**: Tracks active `UserSession` and matches against the RBAC matrix.
- **Tenant Context**: Controls active clinic scopes.
- **Light/Dark Toggle**: Appends `data-theme="dark"` dynamically to HTML node.

---

## 3. Reusable Component Registry

Implemented standard tailwind-free vanilla components in [components/ui/](file:///f:/Dental-AI-Receptionist-SaaS/frontend/src/components/ui/):
- `Button.tsx`, `Card.tsx`, `Input.tsx`, `Table.tsx`, `Modal.tsx`, `Drawer.tsx`, `Tabs.tsx`, `Badge.tsx`, `Toast.tsx`, `Skeleton.tsx`, `ErrorBoundary.tsx`.

---

## 4. API Consumption Layer

Managed under [api.ts](file:///f:/Dental-AI-Receptionist-SaaS/frontend/src/services/api.ts):
- When backend servers are not running or database connections fail, the client automatically defaults to mock localStorage registries, ensuring offline fidelity.
