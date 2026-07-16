# ADR 0002: Prompt Engine Owns Prompt Composition

## Status
Accepted

## Context
Prompts govern AI personality and intent detection. Direct inline string interpolation of system instructions across separate services leads to inconsistent behavior and version control issues.

## Decision
The `PromptEngine` module owns all prompt versioning, templates validation, cache optimization, and composition tasks. Other modules (like `AiEngine` and `ConversationOrchestrator`) must request prompts solely from this module.

## Consequences
- **Pros**: Centralized audit trails of exact prompt versions used, dynamic updates without code deployment.
- **Cons**: Introduce network/service call layers to resolve prompts during conversation setup.

## Alternatives Considered
- Storing prompt definitions inline in the configuration module. Rejected because it complicates prompt isolation and granular auditing.
