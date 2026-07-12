# Task 09 - Multi-target verification

## Objective

Verify the end-to-end agent-docs quality upgrade against in-repo fixtures and one real multi-package target (`jarvis-smart-phone`), using generic success criteria — not Angular-specific expectations.

## Why This Task Exists

Unit tests can pass while the agent navigation story still fails. This task is the acceptance gate for the plan.

## Scope

- Run pipeline against fixtures: `fixture-monorepo`, `fixture-typescript`, new root-package / non-JS-manifest fixtures (no `--ai` required for discovery checks)
- Run against `C:\projeto\jarvis-smart-phone` with `--ai` into a **fresh** docs dir
- Check success criteria from the plan:
  - Real application modules discovered (not only docs/docsDir)
  - Technologies reflect nested packages when present
  - START_HERE has purpose and only detected env/scripts
  - Module AI docs target app modules; structured Markdown
  - CONTEXT_ROUTER routes by discovered areas
  - START_HERE → router → module card → code path works
- Record gaps/failures; fix only clear regressions found in this verification pass if they are small; otherwise file follow-ups in the task notes

## Out Of Scope

- Implementing new features not already delivered by Tasks 01–08
- Modifying jarvis-desktop documentation
- Committing secrets or logging API keys

## Likely Files Or Areas

- `package.json` scripts (`build`, `test`, `smoke`)
- `test/fixtures/`
- CLI: `node dist/cli.js`
- Output docs dir for jarvis run (user-chosen fresh folder)

## Dependencies

- Tasks 01–08 complete (or explicitly note which are missing if verifying a partial ship)

## Implementation Notes

- English notes for any verification report appended under `ai-tasks/` if needed
- Treat AI readiness score as secondary; navigation correctness is primary
- Do not require jarvis-desktop parity of partitions/skills

## Deliverables

- Written verification notes (can be `ai-tasks/09-verification-notes.md`) with pass/fail per criterion
- Commands used and key module lists from PKM

## Validation

- `npm run build`
- `npm test`
- Fixture pipeline runs without `--ai` for discovery
- Optional `--ai` run on jarvis-smart-phone with API key available in the environment

## Suggested Agent Brief

Execute Task 09 from `ai-tasks/09-multi-target-verification.md`. Build/test, run fixtures for discovery, then smoke jarvis-smart-phone with `--ai` into a fresh docs folder. Report against generic success criteria; do not hardcode Angular expectations.
