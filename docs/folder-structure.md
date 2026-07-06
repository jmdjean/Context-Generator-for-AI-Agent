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

**When to modify:** Only when the top-level user-facing interface changes. All logic changes go in `config/` or `core/`.

---

### `src/domain/`

Pure TypeScript types — the domain model for the entire application. No behavior, no imports from Node.js APIs or any other `src/` module.

Defines:
- `RepositoryNodeType`, `RepositoryNode`, `RepositoryInfo` — the repository being analyzed
- `TechnologyConfidence`, `TechnologyProfile` — detected technologies
- `AnalysisResult` — output of the AI analysis stage
- `DocumentSection`, `DocumentModel` — the documentation being generated
- `AgentInstruction` — structured instructions for AI agents
- `PipelineStepStatus`, `AnalysisPipelineStep`, `ANALYSIS_PIPELINE` — the declarative pipeline
- `ProjectContext` — the central aggregate passed through the pipeline

All types are exported from `src/domain/index.ts`.

**When to modify:** When a new concept is introduced, an existing concept needs a new field, or a type needs to be renamed. Domain changes require updating any module that implements the changed contract.

---

### `src/core/`

Orchestration. Receives a validated `RuntimeConfig` and runs the pipeline by calling scanner, AI, and docs modules in order. Contains no domain logic of its own.

**When to modify:** When the overall execution flow changes (new pipeline stage, changed order, new branching based on config).

---

### `src/config/`

Everything related to resolving runtime configuration. The only module that reads `process.argv` and `process.env`.

Produces: `RuntimeConfig { targetProjectPath, docsDir, openRouterApiKey? }`

Exports: `RuntimeConfig`, `resolveConfig()`, `printHelp()`, `isHelpRequested()`.

**When to modify:** When a new configuration option is added, a new environment variable is supported, or validation rules change.

---

### `src/scanner/`

Everything related to reading the target repository from disk. Produces `RepositoryInfo` and `RepositoryNode` (tree) as defined in `src/domain/`.

Does not interpret what it finds — that is the AI's job.

**When to modify:** When the set of things we read from the target repository changes.

**Status:** Planned. Implement against `RepositoryInfo` and `RepositoryNode` from `src/domain/`.

---

### `src/docs/`

Everything related to writing the `.ai-docs/` documentation folder. Consumes `DocumentModel[]` as defined in `src/domain/` and writes files to disk.

**When to modify:** When the output format, folder structure, or file naming changes.

**Status:** Planned. Implement against `DocumentModel` and `DocumentSection` from `src/domain/`.

---

### `src/ai/`

Everything related to the AI provider (OpenRouter). Consumes `ProjectContext`, produces `AnalysisResult` as defined in `src/domain/`.

Contains no file I/O.

**When to modify:** When the AI provider, model, prompt strategy, or response format changes.

**Status:** Planned. Implement against `ProjectContext` and `AnalysisResult` from `src/domain/`.

---

### `src/utils/`

Shared utility functions with no side effects and no domain knowledge.

Currently contains:
- `fs.ts` — `resolveAbsolutePath`, `pathExists`, `isDirectory`

**When to modify:** When a utility is needed by two or more modules. Functions used in only one module stay in that module.

---

## `docs/` — Project documentation

Human- and agent-readable documentation about the project itself.

| File | Contents |
|---|---|
| `architecture.md` | System design, pipeline overview, layer diagram, key decisions |
| `folder-structure.md` | This file — folder responsibility map |
| `context-engineering.md` | Core philosophy: how domain types prevent hallucination, incremental updates |

**When to modify:** When the architecture or folder responsibilities change. Every structural change to `src/` must be reflected here.

---

## What does NOT belong here

- **Generated output.** The `.ai-docs/` folder is written into the *target* repository, not this one.
- **Build artifacts.** `dist/` is in `.gitignore`.
- **Temporary files.** Use the OS temp directory; never committed.
