# Task 06 - Module docs fan-out and structured cards

## Objective

Upgrade per-module AI documentation to skip documentation-only modules and render module cards as structured Markdown sections (not concatenated prose).

## Why This Task Exists

On poor discovery runs, AI wasted calls on `docs` / docsDir. Even when modules are correct, module card content is unreadable run-on text.

## Scope

- Filter `modulePlan` / `runModuleDocumentationStage` to skip documentation-only modules (use Task 01 helper/flag)
- Keep JSON schema fields; ensure renderer emits sections: Summary, Purpose, Entry points, Key behaviors, Dependencies, Out of scope, Agent guidance
- Prefer concrete `importantFiles` and dependency edges in prompts and cards
- No UI-framework assumptions in prompts

## Out Of Scope

- Capability map stage (Task 05)
- AI_START_HERE / AGENTS renderers (Task 07)
- Changing module discovery itself (Task 01)

## Likely Files Or Areas

- `src/ai/module-documentation-stage.ts`
- `src/ai/prompt-builder.ts` (module prompt rules)
- `src/docs/documentation-planner.ts` (plan entries filter if needed)
- `src/docs/markdown-renderers/module-document-renderer.ts`
- Related tests (`ai-analysis.test.ts`, markdown renderer tests)

## Dependencies

- Task 01 (docsDir / documentation module filter)

## Implementation Notes

- Sequential fan-out remains
- Isolated failures stay non-fatal
- Deterministic module facts remain authoritative; AI is enrichment

## Deliverables

- Documentation-only modules not sent to the provider by default
- Module Markdown cards with proper headings/lists
- Unit tests for filter + renderer formatting

## Validation

- `npm run build`
- Tests asserting docsDir modules are skipped and rendered content has section headings

## Suggested Agent Brief

Implement Task 06 from `ai-tasks/06-module-docs-fanout-and-cards.md`. Skip documentation-only modules in AI fan-out and fix module card rendering to structured Markdown. Depend on Task 01’s filter/helper.
