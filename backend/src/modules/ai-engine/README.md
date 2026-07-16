# AI Engine Module

The AI Engine module serves as the primary language orchestration layer of the platform. It processes natural language caller input, maintains conversation state, automatically runs local tool retrieval loops, detects patient intents and entities, validates output structures, enforces confidence thresholds, defends against prompt injection, and posts auditable logs.

## Directory Structure

```text
ai-engine/
├── constants/      - Supported intents, default models, event names
├── controllers/    - Express chat/parse/audit controllers
├── dto/            - Request/Response data transfer contracts
├── errors/         - Custom exceptions (PromptInjection, LowConfidence, etc.)
├── events/         - Domain event types & InProcess publisher
├── interfaces/     - Service, repository, and provider contracts
├── repositories/   - Database audit log persistence
├── routes/         - API endpoint route mapping and RBAC wiring
├── services/       - AI provider logic, factory, and orchestration service
├── tests/          - Unit and integration tests
├── validators/     - Zod payload validation schemas
├── README.md       - Module documentation
└── index.ts        - Barrel export exports
```

## Architecture & Integration

### Provider Abstraction
The module is decoupled from specific LLM vendors through the `IAiProvider` interface. 
- `MockAiProvider`: Pattern matching engine for testing and local/offline development.
- `OpenAiProvider`: Client communicating directly with OpenAI's Chat Completions REST API using native `fetch` (complying with the "no OpenAI SDK" constraint).

### Local Function Execution Loop
When generating response outputs:
1. Retrieval tools (e.g. `getClinicInformation` or `checkAvailability`) are executed locally by the `AiEngineService` without returning to the client.
2. The resolved tool output is fed back to the AI provider in a loop to generate the final natural language reply.
3. State-changing tools (e.g. `bookAppointment`, `cancelAppointment`) are immediate execution stops, returning tool requests directly to the API response for the caller (voice-server) to process.

### Security & Auditing
- **Prompt Injection Defense**: Inputs are screened against adversarial patterns (e.g. overrides, prompt leak requests).
- **Isolation**: Tenant constraints are enforced at route and controller boundaries.
- **Audit Trails**: Actions publish events and write to `ai_audit_logs` in PostgreSQL.
