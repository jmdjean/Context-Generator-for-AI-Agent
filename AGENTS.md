# AGENTS.md — Guide for AI Coding Agents

This file is the mandatory starting point for any AI agent working inside this repository. Read it before opening any source file.

---

## What this project does

`ai-project-docs` is a CLI tool that analyzes software repositories and generates AI-readable documentation. Its own structure is a living example of the documentation philosophy it promotes.

---

## Where to start

Before touching any code, load context in this order:

1. **This file** — understand the repository conventions.
2. [`docs/architecture.md`](docs/architecture.md) — understand the system design.
3. [`docs/folder-structure.md`](docs/folder-structure.md) — understand where each concern lives.
4. The `README.md` of the specific folder you are about to modify.

Do not start from `src/` without reading the above. You will make wrong assumptions.

---

## Repository conventions

### TypeScript
- Strict mode is enabled in `tsconfig.json`. All code must pass `tsc` with no errors.
- Prefer `const` and explicit types over `let` and inference where the intent is non-obvious.
- Keep each module focused on a single responsibility.
- No `any` unless it is genuinely unavoidable and the reason is documented inline.

### Comments
- Do not add comments that describe *what* the code does. Well-named identifiers already do that.
- Only add a comment when the *why* is non-obvious: a hidden constraint, a workaround, or a subtle invariant.

### Folder ownership
- `src/core/` — orchestration only. It calls other modules; it does not implement logic.
- `src/config/` — everything related to reading and validating user configuration.
- `src/scanner/` — everything related to reading the target repository on disk.
- `src/docs/` — everything related to generating or writing documentation files.
- `src/ai/` — everything related to calling the AI provider (OpenRouter).
- `src/utils/` — pure utility functions with no side effects and no domain knowledge.

Cross-cutting concerns belong in `utils/`. Business logic belongs in the owning module.

### Dependencies
- Prefer the Node.js standard library over third-party packages.
- Every new dependency needs a clear justification.
- No dependency should be added speculatively for future use.

### Documentation
- Every folder must have a `README.md` explaining its responsibility.
- If you add a new folder, you must add a `README.md` to it.
- If you change the architecture, update `docs/architecture.md`.
- If you change the folder structure, update `docs/folder-structure.md`.

---

## Implementation status

The project is in the **foundation phase**. The CLI is wired up but does not yet scan or generate documentation.

Before implementing any planned feature, check [`README.md`](README.md) for the current status table so you know what is already done.

---

## How to build and verify

```bash
npm install
npm run build      # compiles TypeScript to dist/
node dist/cli.js ./some-path   # verify the CLI runs
```

The build must succeed with zero TypeScript errors before any commit.

---

## What to avoid

- Do not modify files in `dist/` — it is a build artifact.
- Do not add error handling for scenarios that cannot happen given the surrounding code.
- Do not add abstractions for hypothetical future requirements.
- Do not skip updating documentation when you change structure or behavior.
