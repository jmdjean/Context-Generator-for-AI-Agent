# src/validation

**Responsibility:** Validating generated outputs — checking that the Markdown documentation in `.ai-docs/` and the persisted knowledge JSON in `.ai-docs/knowledge/` are complete and consistent enough for AI agents to trust.

Validation runs as the final pipeline step (**Validate Documentation**), after documentation is written and the PKM is persisted, so it sees exactly the outputs a future agent will load.

---

## Files

| File | Role |
|---|---|
| `validation-result.ts` | Result model: `ValidationSeverity`, `ValidationIssue`, `ValidationSummary`, `ValidationResult`, `buildValidationResult()` |
| `knowledge-validator.ts` | `validateKnowledge()` — persisted knowledge files, snapshot structure, analysis sections, PKM-internal consistency |
| `documentation-validator.ts` | `validateDocumentation()` — docs directory, planned documents, generated marker, key document content, navigation references |
| `index.ts` | Public exports + `validateGeneratedOutputs()` combining both validators into one `ValidationResult` |
| `validation.test.ts` | Unit tests for all checks against a temp-directory fixture project |

---

## What validation checks

### Knowledge validation (`validateKnowledge`)

- The five core knowledge files exist: `project-knowledge.json`, `repository.json`, `technologies.json`, `documentation.json`, `analysis.json` → **error** when missing.
- `project-knowledge.json` parses as JSON and carries `metadata.schemaVersion`, `metadata.generatedAt`, repository data, and technology data → **error** when broken.
- The analysis sections `folderContexts`, `modules`, `dependencyGraph`, `conventions`, and `navigationMap` are populated → **warning** when missing, **info** when present but empty.
- Consistency: dependency graph nodes match discovered modules (**warning**), folder contexts use valid relative paths (**error**), module paths exist in folder knowledge or the repository tree (**warning**).

### Documentation validation (`validateDocumentation`)

- The docs directory exists → **error** when missing.
- Every required planned document exists → **error** when missing; documents the writer intentionally skipped as user-managed are reported as **info**, never errors.
- Generated files carry the generated marker; unmarked files are user-managed → **info**.
- Key documents (`architecture.md`, `folder-structure.md`, `dependency-map.md`, `conventions.md`, `agent-navigation.md`, `ai-context.md`, `implementation-guide.md`) have content beyond the marker → **error** when empty (empty non-key documents are **warnings**).
- Navigation map recommended documents reference planned documents → **warning** for unknown references.

---

## Errors vs warnings vs info

| Severity | Meaning | Effect |
|---|---|---|
| `error` | The context layer is broken or misleading — an agent loading it would be misled | Fails the Validate Documentation step and the pipeline |
| `warning` | An actionable gap or inconsistency the context survives | Reported, pipeline passes |
| `info` | A benign fact worth knowing (user-managed file preserved, AI stage pending) | Reported in the summary only |

Validation fails **only** on errors. The MVP deliberately prefers actionable warnings over strict failure: a small repository with an empty analysis section, or a hand-written doc replacing a generated one, is a state to report — not a reason to abort a pipeline that otherwise produced usable context.

## Why validation is lightweight in the MVP

Validators check the **outputs derived from the PKM** — they do not re-analyze the project. Deterministic generation means most invariants are guaranteed by construction; validation exists to catch what construction cannot: files deleted or corrupted between runs, user edits, renderer regressions, and drift between PKM sections. Deep semantic checks (does `architecture.md` accurately describe the code?) require the AI stage and belong to a later iteration.

## Why validation protects AI agents

Agents trust `.ai-docs/` blindly — that is the point of a context layer. Stale or incomplete context is worse than no context: an agent reading an empty `architecture.md` or a navigation map that points to missing documents will make confidently wrong decisions. Validation is the gate that keeps the promise "if it is in `.ai-docs/`, you can rely on it".

## Rules for validators

- Validators may **read** generated docs and knowledge files; they must never mutate or delete files.
- Validators must not call AI providers.
- Validators must not re-scan repository source — they validate outputs against the in-memory PKM, not the project itself.
- New checks should emit `ValidationIssue` values with a stable kebab-case `code`, a human-readable `message`, and a `recommendation` when there is an obvious fix.

## Where future stronger validation goes

- **Schema validation** of every persisted knowledge file (not just the full snapshot) against versioned JSON schemas.
- **Cross-run drift detection** once incremental state exists: compare `generatedAt`/input hashes to flag stale documents.
- **Content assertions** per renderer: verify each key document contains the sections its renderer promises.
- **AI-assisted semantic validation** (post-MVP): check that documentation claims match the code.

Add new checks as functions inside the existing validators (or a new `*-validator.ts` for a new concern) and compose them in `validateGeneratedOutputs()`.
