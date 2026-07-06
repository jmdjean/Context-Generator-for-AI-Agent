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
│  src/core/           Pipeline orchestration     │  ✅ done
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

Step 1 is fully implemented (in `src/config/`). Steps 2–10 have placeholder handlers in the orchestrator skeleton; real implementations are planned.

---

## Declarative pipeline vs execution orchestrator

The pipeline exists in two distinct forms, each in a different layer:

| Concern | Location | What it contains |
|---|---|---|
| **What** the pipeline does | `src/domain/pipeline.ts` | Step names, descriptions, input/output types — pure data, no runtime behavior |
| **How** the pipeline executes | `src/core/pipeline-orchestrator.ts` | Step loop, handler calls, status tracking, progress output, error collection |

`ANALYSIS_PIPELINE` in the domain layer is documentation. It can be read, inspected, and validated without running anything. The orchestrator reads that documentation at runtime and drives execution against it.

This separation means that adding a new pipeline step involves two changes: add the step to the domain definition, then wire its real handler into the orchestrator.

---

## Placeholder execution

Until a real handler is implemented for a step, `executePipeline` calls `runPlaceholderStep` for that step. The placeholder returns immediately with a message and marks the step `completed`. This keeps the full pipeline runnable, the output visible, and the overall execution flow testable before any scanner, AI, or docs logic exists.

Real handlers are plugged in by replacing the placeholder call for the relevant step inside `executePipeline`. Handler logic should never be added directly to `cli.ts` or `run()`.

---

## Execution result

`executePipeline` returns a `PipelineExecutionResult`:

```typescript
interface PipelineExecutionResult {
  success: boolean;
  steps: ExecutedPipelineStep[];   // one record per pipeline step
  startedAt: string;               // ISO 8601
  finishedAt: string;
  errors: PipelineExecutionError[];
}
```

Each `ExecutedPipelineStep` carries the step name, its final `PipelineStepStatus`, timestamps, and an optional message. `PipelineExecutionError` records the step name, a human-readable message, and the original cause.

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

## CLI / Config / Core flow

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
                            ├─ prints config summary
                            └─ executePipeline(config)
                                 ├─ for each ANALYSIS_PIPELINE step:
                                 │    mark running → call handler → mark completed/failed
                                 │    print ✓/✗ step name
                                 └─ return PipelineExecutionResult
```

Key invariant: `process.argv` and `process.env` are read only inside `src/config/`. Every other module receives a `RuntimeConfig` or a domain type.

---

## Key design decisions

**Domain types before implementation.** `src/domain/` was created before any scanner, AI, or docs logic. This means every implementation has a precise contract to fulfill rather than inventing its own intermediate types.

**Pipeline over monolith.** Each stage produces a plain data structure consumed by the next. Stages are independently testable and replaceable.

**Declarative definition, separate execution.** The pipeline definition in `src/domain/` is pure data. The orchestrator in `src/core/` is the only place that knows how to execute it. Agents adding new stages should never collapse these two concerns.

**Config is the only environment reader.** `src/config/index.ts` is the single point of contact with `process.argv` and `process.env`. Every other module receives a typed struct.

**Placeholder skeleton before real handlers.** The full pipeline runs end-to-end with placeholder steps. This validates the execution flow before any I/O or AI logic exists and gives future implementors a clear location to plug in real behavior.

**Fail fast, fail clearly.** Configuration validation runs before any I/O. Invalid inputs produce specific error messages at the CLI layer. A failed step marks the pipeline `success: false` and surfaces a `PipelineExecutionError` — it does not swallow the failure.

**Incremental updates by design.** Step 10 (Save Incremental State) is part of the pipeline from the start. Re-running the tool on a repository that hasn't changed significantly should be cheap.

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
- A failed pipeline step is recorded in `PipelineExecutionResult.errors` and causes `success: false`.
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
