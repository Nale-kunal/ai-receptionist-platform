# Conversation Module

**Version:** 1.0.0  
**Authority:** [10_Conversation_Contract.md](../../../docs/implementation-contracts/10_Conversation_Contract.md)  
**Status:** Active

---

## Purpose

The Conversation module owns the permanent record of every phone interaction between a caller and the AI Receptionist. 

It manages the lifecycle of the call, transcript storage, AI summaries, NLP entities, and recording references. It serves as pure storage and audit history and never executes business decisions.

---

## Responsibilities

**Owns:**
- Conversation lifecycle (Initiated → Active → Completed/Failed/Abandoned/Archived)
- Transcript storage (finalized transcript is immutable)
- AI-generated summaries and metadata
- Extracted NLP entities
- Call duration and tokens tracking
- Recording references (references only, no audio files)
- Audit event publishing

**Does NOT own:**
- Voice streaming or audio processing
- OpenAI or LLM direct integration
- Appointment scheduling business logic
- Patient identity or registration logic
- Notification delivery

---

## Status State Machine

```
initiated ──> active ──> completed ──> archived (terminal)
   │            │
   ├────────────┼──────> abandoned (terminal)
   │            │
   └────────────└──────> failed (terminal)
```

Terminal statuses accept no further transitions.

---

## Directory Structure

```
conversation/
  constants/   — ConversationStatus, Speaker, RecordingStatus
  types/       — SafeConversation, TranscriptTurn, ConversationSummary
  interfaces/  — IConversationService, IConversationRepository
  errors/      — ConversationError hierarchy
  events/      — Domain events + InProcessConversationEventPublisher
  dto/         — Barrel export of validators inferred types
  validators/  — Zod schemas (create, update, transcript, summary, recording, list)
  repositories/— ConversationRepository (Prisma)
  services/    — ConversationService (business logic)
  controllers/ — ConversationController + conversationErrorHandler
  routes/      — createConversationRouter factory
  tests/       — Unit tests
  index.ts     — Barrel export
  README.md    — This file
```

---

## API Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `POST`   | `/api/v1/conversations`                | `conversation.read`    | Create conversation |
| `GET`    | `/api/v1/conversations`                | `conversation.read`    | List/search conversations |
| `GET`    | `/api/v1/conversations/public/:publicId` | `conversation.read`   | Get by public ID |
| `GET`    | `/api/v1/conversations/:id`            | `conversation.read`    | Get by internal ID |
| `PATCH`  | `/api/v1/conversations/:id`            | `conversation.read`    | Update metadata/tokens/entities |
| `POST`   | `/api/v1/conversations/:id/transcript` | `conversation.read`    | Append/update transcript turns |
| `POST`   | `/api/v1/conversations/:id/summary`    | `conversation.summary` | Set AI summary |
| `POST`   | `/api/v1/conversations/:id/recording`  | `conversation.read`    | Link recording metadata |
| `POST`   | `/api/v1/conversations/:id/complete`   | `conversation.read`    | Complete conversation |
| `POST`   | `/api/v1/conversations/:id/fail`       | `conversation.read`    | Mark conversation failed |
| `POST`   | `/api/v1/conversations/:id/archive`    | `conversation.read`    | Archive conversation |
| `DELETE` | `/api/v1/conversations/:id`            | `conversation.delete`  | Soft delete conversation |

---

## Business Rules

1. Tenant & Clinic isolation enforced on every read/write operation.
2. Linked entities (Patient, Doctor, Appointment) are optional (e.g. anonymous calls).
3. If entities are linked, they must belong to the same Clinic and Tenant as the conversation.
4. Clinic must be active (not suspended or deleted).
5. Finalized transcripts are immutable once completed/archived.
6. Status transitions validated strictly via state machine.

---

## Audit Events

All events include: `tenantId`, `clinicId`, `conversationId`, `actorId`, `requestId`, `occurredAt`

| Event | Type String |
|-------|------------|
| Conversation Started   | `conversation.started` |
| Conversation Updated   | `conversation.updated` |
| Conversation Completed | `conversation.completed` |
| Conversation Failed    | `conversation.failed` |
| Conversation Archived  | `conversation.archived` |
| Transcript Updated     | `conversation.transcript_updated` |
| Summary Generated      | `conversation.summary_generated` |
| Recording Linked       | `conversation.recording_linked` |
| Conversation Deleted   | `conversation.deleted` |
