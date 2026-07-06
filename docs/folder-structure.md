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

The CLI entry point. Reads `process.argv`, checks for `--help`, delegates to `config/` for validation, and delegates to `core/` for execution. Contains no logic of its own.

**When to modify:** Only when the top-level user-facing interface changes (new flag routing, different exit behavior). All logic changes go in `config/` or `core/`.

---

### `src/core/`

Orchestration. Receives a validated `RuntimeConfig` and runs the pipeline by calling scanner, AI, and docs modules in order. Contains no domain logic of its own.

**When to modify:** When the overall execution flow changes (new pipeline stage, changed order, new branching based on config).

---

### `src/config/`

Everything related to resolving runtime configuration. This is the only module that reads `process.argv` and `process.env`.

Responsible for:
- Parsing CLI flags (`--openrouter-key`, `--docs-dir`, `--help`)
- Reading environment variables (`OPENROUTER_API_KEY`)
- Applying defaults (`docsDir` → `.ai-docs`)
- Validating all inputs (path exists, is a directory, docs dir not empty)
- Producing the typed `RuntimeConfig` object

Exports: `RuntimeConfig`, `resolveConfig()`, `printHelp()`, `isHelpRequested()`.

**When to modify:** When a new configuration option is added, a new environment variable is supported, or validation rules change.

---

### `src/scanner/`

Everything related to reading the target repository from disk. Responsible for:
- Walking the directory tree (depth-limited, respecting `.gitignore`)
- Identifying key files (`package.json`, `tsconfig.json`, lock files, etc.)
- Sampling file content
- Building a `RepositorySnapshot` data structure

Does not interpret what it finds — that is the AI's job.

**When to modify:** When the set of things we read from the target repository changes.

**Status:** Planned.

---

### `src/docs/`

Everything related to writing the `.ai-docs/` documentation folder. Responsible for:
- Creating the output folder structure
- Writing each documentation section to a file
- Managing incremental updates (only rewrite sections that changed)

Does not call the AI. Reads from the AI module's output.

**When to modify:** When the output format, folder structure, or file naming changes.

**Status:** Planned.

---

### `src/ai/`

Everything related to the AI provider (OpenRouter). Responsible for:
- Building prompts from `RepositorySnapshot`
- Calling the OpenRouter API
- Parsing and validating the response
- Retrying on transient errors

Contains no file I/O. Receives a snapshot and returns documentation content.

**When to modify:** When the AI provider, model, prompt strategy, or response format changes.

**Status:** Planned.

---

### `src/utils/`

Shared utility functions with no side effects and no domain knowledge.

Currently contains:
- `fs.ts` — `resolveAbsolutePath`, `pathExists`, `isDirectory` (thin wrappers over `node:fs` / `node:path` used by multiple modules)

**When to modify:** When you need a utility used by two or more modules. Functions used in only one module stay in that module.

---

## `docs/` — Project documentation

Human- and agent-readable documentation about the project itself.

| File | Contents |
|---|---|
| `architecture.md` | System design, pipeline overview, CLI/config flow, key decisions |
| `folder-structure.md` | This file — folder responsibility map |
| `context-engineering.md` | Core philosophy behind the documentation approach |

**When to modify:** When the architecture or folder responsibilities change. Every structural change to `src/` must be reflected here.

---

## What does NOT belong here

- **Generated output.** The `.ai-docs/` folder is written into the *target* repository, not this one.
- **Build artifacts.** `dist/` is in `.gitignore`.
- **Temporary files.** Use the OS temp directory; never committed.
