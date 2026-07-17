# End-to-End Call Flow Orchestration Module

## Overview

This module acts as the integration and coordination runtime boundary of the platform.

It synchronizes all lower modules (Twilio Voice Provider, Voice Server, Realtime AI Adapter, Prompt Engine, AI Tool Pipeline, and business logic) into a unified conversation session.

---

## 1. Directory Structure

```text
end-to-end/
├── end-to-end.constants.ts       # TIMEOUTS, RETRIES, E2eCallState
├── end-to-end.types.ts           # Types declarations
├── end-to-end.errors.ts          # Exception class definitions
├── end-to-end.interfaces.ts      # Coordination module contracts
├── end-to-end.events.ts          # Domain events names and envelopes
├── end-to-end.event.publisher.ts # Core E2e event publisher
├── call-lifecycle.manager.ts     # Lifecycle transition validation state machine
├── call-session.manager.ts       # Active E2E sessions mapping registry
├── call-context.manager.ts       # Runtime variables scopes
├── call-retry.manager.ts         # Exponential retry backoffs loader
├── call-timeout.manager.ts       # Node active timer trackers
├── call-health.monitor.ts        # Flags orphan/stuck calls
├── call-cleanup.manager.ts       # Dynamic memory cleaner
├── call-audit.logger.ts          # Logs with number masking and PHI sanitizing
├── call-metrics.collector.ts     # Execution latencies telemetry
├── call-flow.coordinator.ts      # Core coordinator orchestrating sessions
├── call.validators.ts            # Incoming Zod/parameters validator schemas
├── call.dto.ts                   # DTO mapping interfaces
├── call.controller.ts            # Http request controller handlers
├── call.routes.ts                # express routes endpoints setup
├── index.ts                      # barrel export
└── README.md                     # This file
```

---

## 2. Dynamic Call Lifecycles

Calls traverse through the following sequence:

```text
INCOMING_CALL
      │
      ▼
WEBHOOK_VALIDATED
      │
      ▼
VOICE_SESSION_CREATED
      │
      ▼
REALTIME_SESSION_CREATED
      │
      ▼
CONVERSATION_CREATED
      │
      ▼
PROMPT_RESOLVED
      │
      ▼
AI_READY
      │
      ▼
GREETING
      │
      ▼
LISTENING  ◄────────────────────────┐
      │                             │
      ▼                             │
PROCESSING                          │
      │                             │
      ├───[Tool Call?]              │
      │         │                   │
      │         ▼                   │
      │   TOOL_EXECUTION            │
      │         │                   │
      │         ▼                   │
      ▼         │                   │
RESPONDING  ◄───┘                   │
      │                             │
      ▼                             │
WAITING                             │
      │                             │
      ▼                             │
      └─────────────────────────────┘
```

Upon call completion (hangup, timeout, or failure):
```text
(Any State) → ENDING → CALL_COMPLETED → RESOURCE_CLEANUP → TERMINATED
```

---

## 3. Resource Cleanup Policy

To prevent connection and timer leakage, `CallCleanupManager` is called on termination to clear:
1. All node timeout timers.
2. In-memory session and context objects.
3. Underlying voice and realtime AI adapter sessions.
