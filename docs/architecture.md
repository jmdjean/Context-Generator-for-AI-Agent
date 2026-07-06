# Architecture

## Overview

`ai-project-docs` is a CLI tool with a pipeline architecture. The user runs a single command; the tool reads a target repository, sends relevant context to an AI provider, and writes structured documentation into a `.ai-docs/` folder inside that repository.

Each stage of the pipeline is isolated in its own module. No module reaches into another module's internals. All data passed between stages is expressed as types defined in `src/domain/`.

---

## Layers

```
┌─────────────────────────────────────────────────┐
│  src/cli.ts          CLI surface                │
│  src/config/         Arg parsing, env vars      │
│  src/core/           Pipeline orchestration     │
├─────────────────────────────────────────────────┤
│  src/scanner/        File system reading        │  planned
│  src/ai/             OpenRouter integration     │  planned
│  src/docs/           Documentation writing      │  planned
├─────────────────────────────────────────────────┤
│  src/domain/         Types only — no behavior   │  ✅ done
│  src/utils/          Pure shared helpers        │  ✅ done
└─────────────────────────────────────────────────┘
```

The domain layer sits beneath everything. It has no dependencies on any other layer. All other layers depend on it.

---

## Analysis pipeline

The full pipeline is defined declaratively in `src/domain/pipeline.ts` as `ANALYSIS_PIPELINE`. It is the authoritative description of what the tool does, step by step.

```
 1. Resolve Configuration      process.argv, process.env       → RuntimeConfig
 2. Load Repository Metadata   targetProjectPath               → RepositoryInfo
 3. Scan Repository Structure  RepositoryInfo                  → RepositoryNode (tree)
 4. Detect Technologies        RepositoryNode, RepositoryInfo  → TechnologyProfile
 5. Build Repository Model     RepositoryInfo + tree + profile → ProjectContext
 6. Analyze Architecture       ProjectContext                  → AnalysisResult
 7. Generate Documentation     ProjectContext, AnalysisResult  → DocumentModel[]
 8. Write Documentation        DocumentModel[]                 → .ai-docs/ files
 9. Validate Documentation     DocumentModel[], file paths     → validation report
10. Save Incremental State     ProjectContext, DocumentModel[] → .ai-docs/.state.json
```

Steps 1 and (partially) 5 are implemented. Steps 2–4 and 6–10 are planned.

---

## Domain model

All data flowing through the pipeline has an explicit type defined in `src/domain/`:

| Type | Produced by step | Consumed by step |
|---|---|---|
| `RuntimeConfig` | 1 — Resolve Configuration | all steps |
| `RepositoryInfo` | 2 — Load Metadata | 3, 5 |
| `RepositoryNode` | 3 — Scan Structure | 4, 5 |
| `TechnologyProfile` | 4 — Detect Technologies | 5 |
| `ProjectContext` | 5 — Build Repository Model | 6, 7 |
| `AnalysisResult` | 6 — Analyze Architecture | 7, 10 |
| `DocumentModel[]` | 7 — Generate Plan | 8, 9, 10 |

`ProjectContext` is the central aggregate. It is built progressively: each pipeline stage adds its result to the context before passing it forward. Optional fields on `ProjectContext` encode which stages have completed.

---

## CLI / Config flow (current implementation)

```
process.argv
   │
   ▼
cli.ts
   ├─ No args        → usage error, exit 1
   ├─ --help         → printHelp(), exit 0
   └─ Otherwise      → resolveConfig(argv)
                            │
                            ▼
                         config/index.ts
                            ├─ parseArgs()          — extracts flags from argv
                            ├─ resolveApiKey()      — flag beats OPENROUTER_API_KEY env var
                            ├─ validate target path — required, must exist, must be directory
                            └─ validate docsDir     — must not be empty
                            │
                            ▼
                         RuntimeConfig { targetProjectPath, docsDir, openRouterApiKey? }
                            │
                            ▼
                         core/index.ts → run(config)
                            └─ prints summary; warns if API key is absent
```

Key invariant: `process.argv` and `process.env` are read only inside `src/config/`. Every other module receives a `RuntimeConfig` or a domain type.

---

## Key design decisions

**Domain types before implementation.** `src/domain/` was created before any scanner, AI, or docs logic. This means every implementation has a precise contract to fulfill rather than inventing its own intermediate types.

**Pipeline over monolith.** Each stage produces a plain data structure consumed by the next. Stages are independently testable and replaceable.

**Config is the only environment reader.** `src/config/index.ts` is the single point of contact with `process.argv` and `process.env`. Every other module receives a typed struct.

**Fail fast, fail clearly.** Configuration validation runs before any I/O. Invalid inputs produce specific error messages at the CLI layer.

**Incremental updates by design.** Step 10 (Save Incremental State) is part of the pipeline from the start. Re-running the tool on a repository that hasn't changed significantly should be cheap.

**Scanner is deliberately not yet implemented.** The domain types define what the scanner must produce. Implementing the scanner against those contracts — rather than letting the scanner define them — keeps the design clean and the consumer modules stable.

---

## Configuration sources and priority

| Priority | Source | Applies to |
|---|---|---|
| 1 (highest) | CLI flag `--openrouter-key` | `openRouterApiKey` |
| 2 | Environment variable `OPENROUTER_API_KEY` | `openRouterApiKey` |
| 3 | Default value | `docsDir` → `.ai-docs` |
| 4 (planned) | Project config file `.ai-docs.json` | multiple fields |

---

## Error handling strategy

- Validate configuration before doing any I/O.
- Fail fast with a specific, actionable error message.
- Do not swallow errors silently.
- AI provider network errors will be retried with exponential back-off (planned).

---

## Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict) | Type safety, wide ecosystem, Node.js support |
| Runtime | Node.js ≥ 18 | LTS, built-in `fs/promises` |
| Domain layer | Plain interfaces, no classes | Framework-agnostic, easy to test, easy for agents to understand |
| AI provider | OpenRouter (planned) | Single API surface for multiple models |
| CLI parsing | Manual `process.argv` parsing | Simple interface; no framework dependency |
