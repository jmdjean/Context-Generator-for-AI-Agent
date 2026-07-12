# Task 04 - Architecture AI stage upgrade

## Objective

Upgrade the architecture-stage prompt and JSON schema to emit stack-agnostic orientation fields (`purpose`, `layers`, `asciiDiagram`, `keyConstraints`, `envVars`, `runCommands`, `risks`, `agentGuidance`) grounded only in the PKM summary + operational context.

## Why This Task Exists

Current architecture output is a prose blob that does not feed a jarvis-quality START_HERE. Richer structured enrichment enables generic entry docs without hardcoding a product.

## Scope

- Expand `AI_RESPONSE_JSON_SCHEMA` / architecture validation parsing
- Update `buildArchitectureStagePrompt` and system instruction: never assume Angular/Java/C#/Electron unless listed in PKM
- Include operational context and real modules (not docsDir) in the compact summary payload
- Store structured fields in `stagedDocumentation.architecture` (backward compatible with existing summary/content consumers)

## Out Of Scope

- Capability map / router stages (Task 05)
- Renderer layout for START_HERE (Task 07) — expose data only
- Calling providers with raw source files

## Likely Files Or Areas

- `src/ai/constants.ts`
- `src/ai/prompt-builder.ts`
- `src/ai/ai-analysis-service.ts`
- `src/ai/staged-documentation.ts`
- `src/knowledge/project-knowledge.ts` (staged architecture shape if needed)
- `src/ai/ai-analysis.test.ts`

## Dependencies

- Task 01 (correct modules in summary)
- Task 02 (operational context in summary)

## Implementation Notes

- Providers remain transport-only
- Prefer omitting empty arrays over inventing env/scripts
- Keep response size capped; validate and warn-on-failure as today

## Deliverables

- Architecture stage accepts/stores richer JSON
- Prompt includes operational facts + modules
- Unit tests with fake provider covering schema parse and “no invent” rules in prompt text

## Validation

- `npm run build`
- `npm test` for `src/ai` architecture stage tests

## Suggested Agent Brief

Implement Task 04 from `ai-tasks/04-architecture-stage-upgrade.md`. Upgrade architecture schema/prompt/parsing to structured orientation fields, feed operationalContext + real modules, forbid assuming stacks not in PKM. Do not change Markdown renderers yet.
