# Task 05 - Capability map and router AI stages

## Objective

Add two optional `--ai` pipeline stages: capability map inventory and router enrichment, writing results into `stagedDocumentation` for later playbook docs.

## Why This Task Exists

Agents need task/area routing and feature/integration briefs derived from **detected** structure, not a fixed product taxonomy.

## Scope

- New prompts + JSON schemas for:
  - `capabilityMap`: capped `features[]`, `domains[]`, `integrations[]` with name, summary, entryPaths, relatedModules
  - `router`: task/area routes pointing at real planned doc paths / modules
- Wire into `ANALYSIS_PIPELINE` + `pipeline-handlers.ts` (sequential, after architecture)
- Persist status/warnings like existing staged stages
- Language-agnostic prompts; invent nothing not in PKM

## Out Of Scope

- Planning `features/<slug>/index.md` files on disk (Task 08)
- Rewriting CONTEXT_ROUTER renderer (Task 07) beyond ensuring PKM fields exist
- Parallel fan-out (keep sequential for cost control)

## Likely Files Or Areas

- `src/domain/pipeline.ts`
- `src/core/pipeline-handlers.ts`
- `src/core/pipeline-orchestrator.ts` (dispatch only)
- `src/ai/prompt-builder.ts`, `src/ai/constants.ts`
- New `src/ai/*-stage.ts` modules
- `src/ai/staged-documentation.ts`
- `src/ai/index.ts` exports
- AI stage tests with fake providers

## Dependencies

- Task 01
- Task 04 (architecture context available to later stages)

## Implementation Notes

- Default: run when `--ai` is on; optional skip flags may be added if needed
- Skip/no-op cleanly when modules empty
- Names come from PKM folders/modules, not jarvis partition names

## Deliverables

- Two new pipeline stages producing PKM staged sections
- Tests for success, invalid JSON warn-and-continue, and empty-module skip

## Validation

- `npm run build`
- AI stage unit tests; pipeline handler tests if applicable

## Suggested Agent Brief

Implement Task 05 from `ai-tasks/05-capability-map-and-router-stages.md`. Add capability-map and router AI stages to the declarative pipeline and handlers, with stack-agnostic prompts and PKM persistence. Do not implement feature Markdown planners yet (Task 08).
