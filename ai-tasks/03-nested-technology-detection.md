# Task 03 - Nested technology detection

## Objective

Surface languages/frameworks/tooling from nested project manifests into `technologies` (and/or per-module tech signals) so multi-package repos are not reported as “frameworks: none”.

## Why This Task Exists

Repos like jarvis-smart-phone have Express under `bridge-server/` while root detection only sees TypeScript. START_HERE and architecture prompts then understate the stack.

## Scope

- Extend technology detection to consider nested manifests already visible in the repository tree / module list
- Aggregate into root `technologies` and/or attach signals on modules
- Keep framework-specific deep analysis in `src/plugins/technology/`; core aggregates detection signals only

## Out Of Scope

- Module discovery rules (Task 01)
- AI stages or renderers
- Claiming frameworks not evidenced by manifests/deps

## Likely Files Or Areas

- `src/detectors/technology-detector.ts`
- `src/detectors/package-manager-detector.ts`
- Related tests under `src/detectors/`
- Possibly consume module relative paths from PKM once modules exist

## Dependencies

- Task 01 (modules list improves targeting of nested packages)

## Implementation Notes

- Stack-agnostic aggregation — Express, Spring, ASP.NET, etc. only when detected
- Prefer high-confidence signals from dependency/devDependency names and known config files
- Do not walk outside `RepositoryBoundary`

## Deliverables

- Nested package frameworks appear in technology profile for multi-package fixtures
- Tests for at least one JS nested framework and one non-JS signal if feasible from existing detection hooks

## Validation

- `npm run build`
- Detector unit tests + fixture asserting nested framework is listed

## Suggested Agent Brief

Implement Task 03 from `ai-tasks/03-nested-technology-detection.md`. After Task 01 modules exist, detect tech from nested manifests and aggregate into PKM technologies without inventing frameworks. Keep deep framework logic in technology plugins.
