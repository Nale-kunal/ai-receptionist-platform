# Conversation Orchestrator Module

## Purpose

The **Conversation Orchestrator** is the runtime coordinator for live conversations, managing state transitions, turn ordering, transcript accumulations, interruptions, timeouts, and multi-tenant constraints.

---

## 1. Conversation State Machine Lifecycle

State transitions are checked by the `OrchestrationSessionStateMachine` using the path mapping below:

```text
CREATED → INITIALIZING → GREETING → LISTENING → PROCESSING → RESPONDING → WAITING → ENDING → COMPLETED | FAILED
```

During assistant output speech, interruption detection shifts the status to `INTERRUPTED` which transitions to `RESUMED` and then automatically restores to `LISTENING`/`PROCESSING`.

---

## 2. Turn Management & Speech Sync

The `TurnManager` blocks overlapping responses by rejecting start operations if a conflicting assistant/user turn is still running.

```typescript
export interface ITurnManager {
  startUserTurn(sessionId: string): OrchestrationTurn;
  completeUserTurn(sessionId: string, text: string): OrchestrationTurn;
  startAssistantTurn(sessionId: string): OrchestrationTurn;
  completeAssistantTurn(sessionId: string, text: string): OrchestrationTurn;
  interruptCurrentTurn(sessionId: string): OrchestrationTurn | null;
}
```

---

## 3. Interruption Handling (Barge-In)

When user barge-in is flagged:
1. `handleInterruption()` shifts the active state to `INTERRUPTED`.
2. The current active turn is terminated immediately as `interrupted`.
3. The context is retained without transcript degradation.
4. Auto-restores to `RESUMED` -> `LISTENING` to capture user feedback.

---

## 4. Timeout & Recovery Strategies

Configured limits trigger safety paths:
- **Inactivity Timeout**: Triggers when a user remains silent while in the `LISTENING` phase (defaults to 30s).
- **AI Completion Timeout**: Triggers when the LLM adapter response remains pending while in the `PROCESSING` phase (defaults to 10s).
- Transition failures trigger graceful socket shutdowns and map failure details to the conversation metrics.
