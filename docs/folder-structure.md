# Folder Structure

This document maps every folder in the repository to its single responsibility. When you need to find or place code, start here.

---

## Root

```
/
├── src/           Source code (TypeScript)
├── dist/          Compiled output — never edit directly, not committed
├── docs/          Project-level documentation for humans and agents
├── package.json   Package metadata and scripts
├── tsconfig.json  TypeScript compiler configuration
├── README.md      Project overview and usage
└── AGENTS.md      Mandatory reading for AI coding agents
```

---

## `src/` — Source code

The source tree follows a pipeline model. Each sub-folder owns exactly one stage of the pipeline or one cross-cutting concern.

### `src/cli.ts`

The CLI entry point. Parses `process.argv`, validates that a target path was provided, and delegates to `src/core/`. Contains no business logic.

**When to modify:** Only when the user-facing interface changes (new flags, new output format). Logic changes go in `core/` or the relevant domain module.

---

### `src/core/`

Orchestration. Assembles the pipeline by calling config, scanner, AI, and docs modules in order. Contains no domain logic of its own — it only coordinates.

**When to modify:** When the overall execution flow changes (new stage, changed order, new branching).

---

### `src/config/`

Everything related to reading and validating user configuration. Responsible for:
- Reading CLI flags
- Reading environment variables (e.g. `OPENROUTER_API_KEY`)
- Reading any config file (e.g. `.ai-docs.json`)
- Producing a single validated `Config` object

**When to modify:** When a new configuration option is added or validation rules change.

---

### `src/scanner/`

Everything related to reading the target repository from disk. Responsible for:
- Walking the directory tree
- Identifying key files (`package.json`, `tsconfig.json`, lock files, etc.)
- Building a `RepositorySnapshot` data structure

Does not interpret or analyze what it finds — that is the AI's job.

**When to modify:** When the set of things we read from the target repository changes.

---

### `src/docs/`

Everything related to writing the `.ai-docs/` documentation folder. Responsible for:
- Creating the output folder structure
- Writing each documentation section to a file
- Managing incremental updates (only rewrite sections that changed)

Reads from the AI module's output. Does not call the AI directly.

**When to modify:** When the output format, folder structure, or file naming changes.

---

### `src/ai/`

Everything related to the AI provider (OpenRouter). Responsible for:
- Building prompts from `RepositorySnapshot`
- Calling the OpenRouter API
- Parsing and validating the response
- Retrying on transient errors

Contains no file I/O. Receives a snapshot and returns documentation content.

**When to modify:** When the AI provider, model, prompt strategy, or response format changes.

---

### `src/utils/`

Shared utility functions. Contains only pure functions with no side effects and no domain knowledge. Examples: path helpers, string formatters, retry logic.

**When to modify:** When you need a utility shared by two or more modules. Do not add utilities that are only used in one place — keep them in that module.

---

## `docs/` — Project documentation

Human- and agent-readable documentation about the project itself.

| File | Contents |
|---|---|
| `architecture.md` | System design, pipeline overview, key decisions |
| `folder-structure.md` | This file — folder responsibility map |
| `context-engineering.md` | Core philosophy behind the documentation approach |

**When to modify:** When the architecture or folder responsibilities change. Every structural change to `src/` must be reflected here.

---

## What does NOT belong here

- **Generated output.** The `.ai-docs/` folder is written into the *target* repository, not this one.
- **Build artifacts.** `dist/` is in `.gitignore`.
- **Temporary files.** Use the OS temp directory or a local scratch directory, never committed.
