# Task 07 - Playbook entry renderers

## Objective

Rewrite generic playbook entry documents — `AI_START_HERE.md`, `.ai-docs/AGENTS.md`, and `CONTEXT_ROUTER.md` — plus navigation rules so agents get a protocol-style entry flow from PKM (and staged AI enrichment when present).

## Why This Task Exists

These files are the agent UX. Today they are thin/generic or wrong-module tables. They must match the playbook job (orient → route → dive) without hardcoding any product stack.

## Scope

- Upgrade `ai-start-here-renderer.ts`: Purpose → Architecture (diagram/constraint) → Environment → How to run → Components → What to Load Next; omit empty sections
- Add dedicated `agents-renderer.ts` for planned `AGENTS.md` (Working on X → Read Y from modules/nav map, hard rules, tiny flow)
- Upgrade `context-router-renderer.ts` to merge navigation map + capability map + router staged data + module doc paths; “by area” from **actual** module paths
- Update `navigation-map-builder.ts` to recommend `AI_START_HERE` / `CONTEXT_ROUTER` first and real module cards
- Register templates in `markdown-template.ts` / registry as needed

## Out Of Scope

- Creating `features/<slug>/index.md` planner entries (Task 08)
- New AI stages (Tasks 04–05) — consume their PKM output only
- Cursor export / skills

## Likely Files Or Areas

- `src/docs/markdown-renderers/ai-start-here-renderer.ts`
- `src/docs/markdown-renderers/agents-renderer.ts` (new)
- `src/docs/markdown-renderers/context-router-renderer.ts`
- `src/analyzers/navigation-map-builder.ts`
- `src/templates/markdown-template.ts`
- `src/docs/markdown-renderers.test.ts`, `src/templates/template-engine.test.ts`

## Dependencies

- Task 02 (operational facts)
- Task 04 (architecture structured enrichment)
- Task 05 (capability/router staged data — degrade gracefully if absent)
- Task 06 (module card paths worth linking)

## Implementation Notes

- Presentation-only: no fs, no AI calls
- Label staged AI as enrichment; deterministic PKM remains authoritative
- Never hardcode “mobile UI / bridge” — derive labels from discovered modules

## Deliverables

- Richer START_HERE / AGENTS / CONTEXT_ROUTER from PKM fixtures in tests
- Navigation recommendations include playbook entry docs

## Validation

- `npm run build`
- Template/renderer unit tests with sample PKM including operationalContext + staged architecture

## Suggested Agent Brief

Implement Task 07 from `ai-tasks/07-playbook-entry-renderers.md`. Rebuild AI_START_HERE, AGENTS, and CONTEXT_ROUTER renderers plus nav rules for a generic agent protocol. Consume PKM/staged sections only; omit empty sections; no stack-specific hardcoding.
