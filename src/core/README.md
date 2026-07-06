# src/core

**Responsibility:** Pipeline orchestration — turning the declarative pipeline into a safe, traceable execution flow.

This module is the central coordinator. It receives a validated `RuntimeConfig` from the CLI layer and drives the full pipeline from start to finish. It contains no domain logic and no I/O of its own — it only coordinates calls to other modules.

---

## Files

| File | Role |
|---|---|
| `index.ts` | Public entry point. Exports `run()` and re-exports orchestrator types. |
| `pipeline-orchestrator.ts` | Execution engine. Loads pipeline steps, runs handlers, tracks status, prints progress, returns a structured result. |

---

## Exports

### `run(config: RuntimeConfig): Promise<void>`

Called by `src/cli.ts`. Prints the configuration summary, delegates execution to `executePipeline`, and prints the final status line.

### `executePipeline(config: RuntimeConfig): Promise<PipelineExecutionResult>`

Drives the full pipeline. For each step in `ANALYSIS_PIPELINE`:
1. Initializes an `ExecutedPipelineStep` as `pending`.
2. Marks it `running` and records `startedAt`.
3. Calls the step's handler (real handlers for metadata loading, technology detection, documentation planning, and deterministic documentation writing; placeholders for the remaining steps).
4. Marks it `completed` (or `failed` on error) and records `finishedAt`.
5. Prints `✓ <name>` or `✗ <name>` to the console.

Returns a `PipelineExecutionResult` with per-step records, timing, and any errors.

### Application-level types

```typescript
interface ExecutedPipelineStep {
  name: string;
  description: string;
  status: PipelineStepStatus;   // reuses the domain union type
  startedAt?: string;
  finishedAt?: string;
  message?: string;
}

interface PipelineExecutionError {
  stepName: string;
  message: string;
  cause?: unknown;
}

interface PipelineExecutionResult {
  success: boolean;
  steps: ExecutedPipelineStep[];
  startedAt: string;
  finishedAt: string;
  errors: PipelineExecutionError[];
}
```

---

## Declarative pipeline vs execution orchestrator

`src/domain/pipeline.ts` defines **what** the pipeline does: its steps, their names, inputs, and outputs. It is a data structure — no execution logic lives there.

`src/core/pipeline-orchestrator.ts` defines **how** those steps are executed: it loads the declarative steps, runs a handler for each one, tracks results, and reports progress. The orchestrator owns the execution lifecycle; the domain owns the contract.

This separation means the pipeline definition can be read as documentation without pulling in any runtime behavior, and the orchestrator can evolve its execution strategy (retry logic, parallelism, conditional skipping) without touching the domain layer.

---

## Placeholder execution

Unimplemented pipeline steps run `runPlaceholderStep()`, which returns immediately with a status message. This is intentional — the skeleton exists so the execution flow is visible, traceable, and testable before real handlers exist.

When implementing a real handler for a step, replace the call inside the loop with a call to the appropriate module (`src/scanner/`, `src/ai/`, `src/docs/`). Do not add handler logic directly to the orchestrator.

---

## How to plug in a real handler

1. Locate the relevant step index in `ANALYSIS_PIPELINE` (by name).
2. Import the implementing function from the appropriate module.
3. Inside `executePipeline`, replace `runPlaceholderStep(domainStep)` for that step with a call to the real handler, passing the required inputs.
4. Update this README to reflect the new handler.
5. Update `docs/architecture.md`.

---

## What belongs here

- The `run()` function that assembles and presents the execution result.
- The `executePipeline()` function that drives the step loop.
- Application-level execution types (`ExecutedPipelineStep`, `PipelineExecutionResult`, `PipelineExecutionError`).
- Logic that decides which steps to skip (e.g. skip AI stage if no API key is present).
- Top-level error handling that catches step failures and surfaces them to the CLI.

## What does NOT belong here

- Argument parsing — that is `src/config/`'s responsibility.
- File I/O — that belongs in `src/scanner/` or `src/docs/`.
- AI calls — that belongs in `src/ai/`.
- Domain types — those belong in `src/domain/`.
- Scanner logic — never add `fs` reads or directory walks to this module.

---

## Current pipeline (implemented)

```
executePipeline(config)
  ├─ Resolve Configuration        → (done in config layer before run() is called)
  ├─ Load Repository Metadata     → scanner/repository-loader → RepositoryInfo        ✅
  ├─ Scan Repository Structure    → placeholder ✓
  ├─ Detect Technologies          → detectors/technology-detector → TechnologyProfile  ✅
  ├─ Build Repository Model       → placeholder ✓
  ├─ Analyze Architecture         → placeholder ✓
  ├─ Generate Documentation Plan  → docs/documentation-planner → DocumentationPlan     ✅
  ├─ Write Documentation          → docs/documentation-writer → DocumentationWriteResult ✅
  ├─ Validate Documentation       → placeholder ✓
  └─ Save Incremental State       → placeholder ✓
```

## Planned pipeline (real handlers)

```
executePipeline(config)
  ├─ Resolve Configuration        → (done in config layer before run() is called)
  ├─ Load Repository Metadata     → scanner.loadMetadata(config)                       ✅
  ├─ Scan Repository Structure    → scanner.scanTree(repositoryInfo)
  ├─ Detect Technologies          → detectors.detectTechnologies(repositoryInfo)        ✅
  ├─ Build Repository Model       → assembleContext(repositoryInfo, tree, profile)
  ├─ Analyze Architecture         → ai.analyze(projectContext)
  ├─ Generate Documentation Plan  → docs.createDocumentationPlan(...)                  ✅
  ├─ Write Documentation          → docs.writeDocumentation(config, repositoryInfo, technologyProfile, documentationPlan)
  ├─ Validate Documentation       → docs.validate(documentModels)
  └─ Save Incremental State       → docs.saveState(projectContext, documentModels)
```
