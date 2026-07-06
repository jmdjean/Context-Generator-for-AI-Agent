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

- `src/cli.ts` — argument parsing only. Delegates immediately to `config/` and `core/`. No logic.
- `src/config/` — all configuration concerns: parsing CLI flags, reading environment variables, validation, and the `RuntimeConfig` type. **The rest of the application never reads `process.argv` or `process.env` directly.**
- `src/core/` — orchestration only. Receives a validated `RuntimeConfig` and runs the pipeline in order.
- `src/scanner/` — everything related to reading the target repository on disk.
- `src/docs/` — everything related to generating or writing documentation files.
- `src/ai/` — everything related to calling the AI provider (OpenRouter).
- `src/utils/` — pure utility functions with no side effects and no domain knowledge.

Cross-cutting concerns belong in `utils/`. Business logic belongs in the owning module.

### Configuration

All runtime configuration flows through `src/config/index.ts`. It exports:
- `RuntimeConfig` — the validated configuration type passed to the rest of the application.
- `resolveConfig(argv)` — reads flags, falls back to environment variables, validates, and returns `RuntimeConfig`.
- `printHelp()` — prints usage information.
- `isHelpRequested(argv)` — checks for `--help` / `-h`.

When adding a new configuration option:
1. Add it to `RuntimeConfig`.
2. Add its CLI flag to the parser in `config/index.ts`.
3. Add its environment variable fallback if applicable.
4. Update validation logic.
5. Update `printHelp()`.
6. Update `src/config/README.md` and `docs/architecture.md`.

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

The project has a working CLI with full argument parsing and runtime configuration resolution. The scanner, AI, and docs modules are scaffolded but not yet implemented.

Before implementing any planned feature, check [`README.md`](README.md) for the current status table so you know what is already done.

---

## How to build and verify

```bash
npm install
npm run build          # compiles TypeScript to dist/ with zero errors
node dist/cli.js .     # verify the CLI resolves config for the current directory
node dist/cli.js --help
```

The build must succeed with zero TypeScript errors before any commit.

---

## What to avoid

- Do not modify files in `dist/` — it is a build artifact.
- Do not read `process.argv` or `process.env` outside of `src/config/`.
- Do not add error handling for scenarios that cannot happen given the surrounding code.
- Do not add abstractions for hypothetical future requirements.
- Do not skip updating documentation when you change structure or behavior.
