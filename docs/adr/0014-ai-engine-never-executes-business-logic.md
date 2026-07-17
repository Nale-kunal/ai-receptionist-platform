# ADR 0014: AI Engine Never Executes Business Logic

## Status
Accepted

## Context
Merging natural language generation with business workflow execution creates massive logic branches that are hard to audit, debug, or swap across models.

## Decision
The core generative AI engine remains strictly responsible for natural language intent resolution and speech generation. It can never run database mutations or make business assumptions. Every mutation or information lookup must route through standard tool pipelines.

## Consequences
- **Pros**: Clean code architecture, modularity, easy provider transitions.
- **Cons**: Requires explicit schema definitions for every logic path.

## Alternatives Considered
- Direct business service triggers in AI provider adapters. Rejected as it couples providers directly to database operations.
