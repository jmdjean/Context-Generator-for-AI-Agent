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
- `PipelineStepStatus`, `AnalysisPipelineStep`, `ANALYSIS_PIPELINE` — the declarative pipeline definition
- `ProjectContext` — the central aggregate passed through the pipeline

All types are exported from `src/domain/index.ts`.

**When to modify:** When a new concept is introduced, an existing concept needs a new field, or a type needs to be renamed. Domain changes require updating any module that implements the changed contract.

**Status:** ✅ Done.

---

### `src/core/`

Orchestration. Turns the declarative pipeline defined in `src/domain/pipeline.ts` into a runnable execution flow.

Contains:
- `index.ts` — the public `run()` entry point called by `cli.ts`; prints config summary and technology profile; re-exports orchestrator types.
- `pipeline-orchestrator.ts` — `executePipeline()`, per-step status tracking, console progress output, and the application-level execution types (`ExecutedPipelineStep`, `PipelineExecutionResult`, `PipelineExecutionError`).

Does not contain scanner logic, detection logic, AI calls, or file I/O. When future modules are implemented, `executePipeline` calls their exported functions — the logic stays in those modules, not here.

**When to modify:** When the overall execution flow changes — a new pipeline stage is wired in, step ordering changes, or conditional logic is added.

**Status:** ✅ Orchestration skeleton done. Steps 2 (Load Repository Metadata) and 4 (Detect Technologies) use real handlers. All other steps run as placeholders.

---

### `src/config/`

Everything related to resolving runtime configuration. The only module that reads `process.argv` and `process.env`.

Produces: `RuntimeConfig { targetProjectPath, docsDir, openRouterApiKey? }`

Exports: `RuntimeConfig`, `resolveConfig()`, `printHelp()`, `isHelpRequested()`.

**When to modify:** When a new configuration option is added, a new environment variable is supported, or validation rules change.

**Status:** ✅ Done.

---

### `src/scanner/`

Everything related to reading the target repository from disk. Produces `RepositoryInfo` and (planned) `RepositoryNode` tree as defined in `src/domain/`.

Does not interpret what it finds — that is `src/detectors/` and `src/ai/`'s job.

Contains:
- `repository-loader.ts` — `loadRepositoryMetadata(config)` reads top-level directory entries and returns `RepositoryInfo`.

**When to modify:** When the set of things we read from the target repository changes (new key files, deeper scanning, ignore-rule support).

**Status:** Minimal implementation done. Full directory tree walk (for step 3, Scan Repository Structure) is planned.

---

### `src/detectors/`

Technology detection from top-level repository metadata. Consumes `RepositoryInfo`, produces `TechnologyProfile` as defined in `src/domain/`.

Does not walk directories recursively. Reads only well-known top-level files (`package.json`, lockfiles, `tsconfig.json`, `Dockerfile`).

Contains:
- `technology-detector.ts` — `detectTechnologies(repositoryInfo)` builds a full `TechnologyProfile`.
- `package-manager-detector.ts` — `detectPackageManager(repositoryInfo)` returns the package manager name from lockfile presence.

**When to modify:** When support for new frameworks, languages, tooling, or package managers is added. When deeper config-file-based detection is introduced. Do not add directory-walking logic here.

**Status:** ✅ Done — detects TypeScript, JavaScript, Docker; Angular, React, Vue, Svelte, Next.js, Nuxt, NestJS, Express; Vite, Jest, Vitest, Cypress, Playwright, ESLint, Prettier; pnpm, yarn, npm, bun.

---

### `src/docs/`

Everything related to writing the `.ai-docs/` documentation folder. Consumes `DocumentModel[]` as defined in `src/domain/` and writes files to disk.

**When to modify:** When the output format, folder structure, or file naming changes.

**Status:** Planned. Implement against `DocumentModel` and `DocumentSection` from `src/domain/`. Wire into `executePipeline` in `src/core/pipeline-orchestrator.ts` once ready.

---

### `src/ai/`

Everything related to the AI provider (OpenRouter). Consumes `ProjectContext`, produces `AnalysisResult` as defined in `src/domain/`.

Contains no file I/O.

**When to modify:** When the AI provider, model, prompt strategy, or response format changes.

**Status:** Planned. Implement against `ProjectContext` and `AnalysisResult` from `src/domain/`. Wire into `executePipeline` in `src/core/pipeline-orchestrator.ts` once ready.

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
- **Scanner logic in `src/core/`.** Directory walks, `fs` reads, and file pattern matching belong in `src/scanner/`, not in the orchestrator.
- **Detection logic in `src/scanner/`.** Interpreting what files mean (TypeScript, Docker, React) belongs in `src/detectors/`.
