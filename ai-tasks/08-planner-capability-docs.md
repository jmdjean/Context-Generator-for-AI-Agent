# Task 08 - Planner capability docs

## Objective

Expand the documentation plan with `code/index.md` and capability briefs (`features/<slug>/index.md`, `integrations/<slug>/index.md` when capability map exists), and update status/impact tracking for the new paths.

## Why This Task Exists

Entry routers need somewhere concrete to send agents after orientation. Stubs must be honest (`Partial`) when AI capability map is missing.

## Scope

- Extend `documentation-planner.ts` / module-plan expansion to plan:
  - `code/index.md` entry-point index
  - feature/integration stubs from `stagedDocumentation.capabilityMap` when present
  - honest Partial stubs from modules only when capability map absent
- Add or extend renderers for these documents (PKM-only)
- Update `DOCUMENTATION_STATUS` renderer and `document-impact-analyzer` for new paths
- Validator expectations if playbook required set grows carefully (avoid breaking runs without AI)

## Out Of Scope

- Full domain encyclopedias
- Product partitions / PONTO
- Re-implementing entry renderers (Task 07)

## Likely Files Or Areas

- `src/docs/documentation-planner.ts`
- New renderers under `src/docs/markdown-renderers/`
- `src/templates/markdown-template.ts`
- `src/incremental/document-impact-analyzer.ts`
- `src/docs/markdown-renderers/documentation-status-renderer.ts`
- Planner / writer / validator tests

## Dependencies

- Task 05 (capability map shape)
- Task 07 (routing docs should link to these paths)

## Implementation Notes

- Slugs from capability names must be filesystem-safe
- Generated marker policy unchanged
- Without `--ai`, still produce useful `code/index.md` from modules

## Deliverables

- Planned and rendered `code/index.md`
- Feature/integration docs when capability map present
- Status/impact aware of new documents

## Validation

- `npm run build`
- Planner/renderer tests with and without capability map
- Documentation validator still passes on fixture runs

## Suggested Agent Brief

Implement Task 08 from `ai-tasks/08-planner-capability-docs.md`. Plan and render `code/index.md` plus capability briefs from PKM, update status/impact, keep Partial honesty when AI map is missing.
