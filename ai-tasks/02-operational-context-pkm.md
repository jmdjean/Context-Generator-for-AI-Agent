# Task 02 - Operational context in PKM

## Objective

Add stack-agnostic `analysis.operationalContext` to the PKM (purpose, run commands/tasks when detectable, env var **keys** only) from safe config and README reads.

## Why This Task Exists

Agent entry docs need purpose, how-to-run, and env orientation. Today START_HERE invents generic “TypeScript project” prose because these facts are missing from the PKM.

## Scope

- Define PKM types for operational context (e.g. purpose, runCommands, envVars)
- Analyzer or plugin contribution that reads only allowlisted files via `RepositoryBoundary` (README, root/child manifests, `.env.example` or equivalent templates)
- Persist section via knowledge writer / split JSON if applicable
- Omit sections honestly when data is absent — never invent `ng serve` or stack-specific commands

## Out Of Scope

- Rendering START_HERE sections (Task 07)
- AI prompt changes beyond ensuring the new PKM field can be summarized later (minimal wiring OK; full architecture schema is Task 04)
- Framework-specific runbooks

## Likely Files Or Areas

- `src/knowledge/project-knowledge.ts`
- `src/knowledge/knowledge-builder.ts` / knowledge writer / paths
- `src/analyzers/` (new operational analyzer or extension of convention analyzer)
- `src/plugins/builtin/` (plugin registration)
- `src/domain/` only if a pure type belongs there — prefer PKM analysis section
- Tests colocated with the new analyzer / knowledge types

## Dependencies

- Task 01 preferred (module-aware package scripts), but root-level reads can ship if 01 is late — coordinate so child package scripts can attach to modules when modules exist

## Implementation Notes

- Keys only for env — never values/secrets
- English field names and docs
- Generators must not re-read the filesystem; they consume PKM only

## Deliverables

- `operationalContext` present on completed runs when signals exist
- Unit tests for purpose/scripts/env-key extraction and empty-repo honesty

## Validation

- `npm run build`
- Unit tests covering README description, npm scripts, `.env.example` keys, and missing-file cases

## Suggested Agent Brief

Implement Task 02 from `ai-tasks/02-operational-context-pkm.md`. Add `analysis.operationalContext` with safe boundary reads, persist it, and test empty vs populated cases. Do not invent commands for undetected stacks. Leave Markdown renderer polish to Task 07.
