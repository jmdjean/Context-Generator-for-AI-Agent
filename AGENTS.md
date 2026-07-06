# AGENTS.md — Guide for AI Coding Agents

This file is the mandatory starting point for any AI agent working inside this repository. Read it before opening any source file.

---

## What this project does

`ai-project-docs` is a CLI tool that analyzes software repositories and generates AI-readable documentation. Its own structure is a living example of the documentation philosophy it promotes.

---

## Where to start

Before touching any code, load context in this order:

1. **This file** — understand the repository conventions.
2. [`docs/architecture.md`](docs/architecture.md) — understand the system design, layer diagram, and pipeline.
3. [`docs/folder-structure.md`](docs/folder-structure.md) — understand where each concern lives.
4. [`src/domain/README.md`](src/domain/README.md) — understand the core types you will work with.
5. The `README.md` of the specific folder you are about to modify.

Do not start from `src/` without reading the above. You will make wrong assumptions.

---

## Understanding the domain model

All data that flows through the pipeline is typed in `src/domain/`. Before implementing any feature, read the relevant types:

- **Implementing the scanner?** Read `src/domain/repository.ts`. Your code must produce `RepositoryInfo` and `RepositoryNode`.
- **Implementing the AI integration?** Read `src/domain/analysis.ts` and `src/domain/context.ts`. Consume `ProjectContext`, produce `AnalysisResult`.
- **Implementing the docs writer?** Read `src/domain/documentation.ts`. Consume `DocumentModel[]`.
- **Understanding the full pipeline?** Read `src/domain/pipeline.ts`. The `ANALYSIS_PIPELINE` constant is the authoritative description of every step, its input, and its output.

Do not invent intermediate types for concepts that already have a domain type. Do not modify domain types to fit an implementation detail — adapt the implementation to fit the domain.

---

## Repository conventions

### TypeScript
- Strict mode is enabled in `tsconfig.json`. All code must pass `tsc` with no errors.
- Prefer `const` and explicit types over `let` and inference where the intent is non-obvious.
- Keep each module focused on a single responsibility.
- No `any` unless it is genuinely unavoidable and the reason is documented inline.
- Use `interface` for object shapes. Use `type` for unions, aliases, and intersections.

### Comments
- Do not add comments that describe *what* the code does. Well-named identifiers already do that.
- Only add a comment when the *why* is non-obvious: a hidden constraint, a workaround, or a subtle invariant.

### Folder ownership

- `src/cli.ts` — argument routing only. Delegates immediately to `config/` and `core/`. No logic.
- `src/domain/` — pure types only. No behavior, no Node.js imports, no dependencies on other `src/` modules.
- `src/config/` — all configuration concerns. **The only place that reads `process.argv` and `process.env`.**
- `src/core/` — orchestration only. Receives `RuntimeConfig`, calls pipeline stages in order.
- `src/scanner/` — reads the target repository from disk, produces `RepositoryInfo` and `RepositoryNode`.
- `src/docs/` — writes documentation files to disk, consumes `DocumentModel[]`.
- `src/ai/` — calls OpenRouter, consumes `ProjectContext`, produces `AnalysisResult`.
- `src/utils/` — pure utility functions with no side effects and no domain knowledge.

### Configuration

All runtime configuration flows through `src/config/index.ts`. It is the single source of `RuntimeConfig`. When adding a new configuration option:

1. Add it to `RuntimeConfig` in `src/config/index.ts`.
2. Add its CLI flag to the parser.
3. Add its environment variable fallback if applicable.
4. Update `printHelp()`.
5. Update `src/config/README.md` and `docs/architecture.md`.

### Dependencies
- Prefer the Node.js standard library over third-party packages.
- Every new dependency needs a clear justification.
- No dependency should be added speculatively for future use.

### Documentation
- Every folder must have a `README.md` explaining its responsibility.
- If you add a new folder, you must add a `README.md` to it.
- If you change the architecture, update `docs/architecture.md`.
- If you change the folder structure, update `docs/folder-structure.md`.
- If you add or change a domain type, update `src/domain/README.md`.

---

## Implementation status

The project has:
- A working CLI with full argument parsing and runtime configuration resolution.
- A complete domain model (`src/domain/`) defining all types and the declarative pipeline.

The scanner, AI, and docs modules are scaffolded but not yet implemented. Before implementing any planned feature, check [`README.md`](README.md) for the current status table.

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
- Do not import Node.js built-ins inside `src/domain/`.
- Do not invent data structures for concepts that already have a domain type.
- Do not add error handling for scenarios that cannot happen given the surrounding code.
- Do not add abstractions for hypothetical future requirements.
- Do not skip updating documentation when you change structure or behavior.
