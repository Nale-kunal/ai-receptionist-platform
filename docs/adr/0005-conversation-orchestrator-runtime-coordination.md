# ADR 0005: Conversation Orchestrator Owns Runtime Coordination

## Status
Accepted

## Context
A live call involves active handshakes, speech detection, user barge-in, transcript compilation, AI timeouts, and retries. Placing this coordination logic in the Voice Server or AI Engine degrades separation of concerns.

## Decision
The `ConversationOrchestrator` owns the runtime conversation state machine, turn manager, transcript manager, and timeout timers. It coordinates the interactions between transport, realtime adapters, configuration, and business modules.

## Consequences
- **Pros**: Isolated orchestration state, clean boundary for interruption management and turn ordering.
- **Cons**: Additional layer of events routing and context synchronization.

## Alternatives Considered
- Standard event bus handling routing directly. Rejected because a stateless event bus cannot coordinate conversational turn synchronization, timeout state shifts, and real-time barge-ins deterministically.
