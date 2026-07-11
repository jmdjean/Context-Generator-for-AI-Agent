# src/domain

**Responsibility:** Core domain model — the typed contracts that define every concept the application works with.

This module contains no behavior. It has no imports from Node.js APIs, no CLI logic, no OpenRouter calls, and no filesystem access. It is a pure TypeScript type layer that every other module depends on.

---

## Why this layer exists

A common failure mode in AI-assisted development is that different parts of a codebase use different implicit assumptions about what a "repository" or a "documentation file" actually is. When those assumptions conflict, the agent fills the gaps with hallucination.

The domain layer makes every concept explicit and shared:

- `scanner/` produces a `RepositoryNode` — not "some object with file info".
- `ai/` produces an `AnalysisResult` — not "a string from the model".
- `docs/` writes a `DocumentationPlan` deterministically today — and will later enrich those files from structured analysis rather than "whatever the AI said".
- Staged multi-agent documentation outputs (architecture context, module plans, per-module results) live in `ProjectKnowledge.analysis.stagedDocumentation` under `src/knowledge/` — not as ad hoc domain types here. Domain keeps analysis-stage contracts; the PKM holds generator-facing staged state.

When every module's input and output is a named, typed interface, there is nothing to guess.

---

## Why scanner implementation is intentionally delayed

The domain types were defined before the scanner because **the contract must precede the implementation**.

If the scanner were written first, its internal data structures would leak into every module that consumes it. Changing the scanner would break the consumer. Defining `RepositoryNode` and `RepositoryInfo` first gives the scanner a precise target and the consumers a stable contract — both sides can evolve independently.

This is also what makes the types useful to AI agents: an agent implementing the scanner already knows the exact shape it needs to produce. It does not need to read the consumer's source code to understand the expected output.

---

## Files

| File | Contents |
|---|---|
| `repository.ts` | `RepositoryNodeType`, `RepositoryNode`, `RepositoryInfo` |
| `technology.ts` | `TechnologyConfidence`, `TechnologyProfile` |
| `analysis.ts` | `AnalysisResult` |
| `documentation.ts` | `DocumentSection`, `DocumentModel` |
| `documentation-plan.ts` | `PlannedDocument`, `DocumentationPlan` — documentation manifest types |
| `agent.ts` | `AgentInstruction` |
| `pipeline.ts` | `PipelineStepStatus`, `AnalysisPipelineStep`, `ANALYSIS_PIPELINE` constant |
| `context.ts` | `ProjectContext` — the top-level aggregate |
| `index.ts` | Re-exports all public types and the pipeline constant |

---

## Type relationships

```
ProjectContext
  ├── repository: RepositoryInfo
  ├── repositoryTree?: RepositoryNode (recursive tree)
  ├── technologyProfile?: TechnologyProfile
  └── analysis?: AnalysisResult

DocumentModel
  └── sections: DocumentSection[]

ANALYSIS_PIPELINE
  └── AnalysisPipelineStep[] (declarative, not executable)
```

`ProjectContext` is the central aggregate. It is built progressively as pipeline stages complete: `repository` is populated in step 2, `repositoryTree` in step 3, `technologyProfile` in step 4, and `analysis` in step 6. The optional fields make this progression explicit in the type.

---

## The declarative pipeline (`pipeline.ts`)

`ANALYSIS_PIPELINE` is a constant that describes each step by name, description, input contract, and output contract. It does not execute anything.

Its purposes are:
1. **Documentation.** Any agent or developer can read the pipeline to understand the full execution model before looking at any implementation.
2. **Contract definition.** Each step's `input` and `output` strings describe what the implementing module must consume and produce.
3. **Future runtime tracking.** The `PipelineStepStatus` type exists so that a future orchestrator can copy this constant and update statuses as steps complete, giving the user a live progress view.

---

## Rules for this module

- No imports from `node:fs`, `node:path`, or any other Node.js built-in.
- No imports from `src/config`, `src/scanner`, `src/ai`, `src/docs`, or `src/utils`.
- No classes with methods. Only interfaces, type aliases, and plain constants.
- Every public type must be exported through `index.ts`.
- Intra-domain imports are allowed (e.g. `context.ts` imports from `repository.ts`).

---

## How AI agents should use these types

Before implementing any pipeline stage, read the relevant type in this module and treat it as the implementation contract:

- Implementing `scanner/`? Produce `RepositoryInfo` and `RepositoryNode`. The shape is already defined.
- Implementing `ai/`? Consume `ProjectContext`, produce `AnalysisResult`. The shape is already defined.
- Implementing deterministic `docs/` writing? Consume `DocumentationPlan` plus known metadata and preserve the generated-file marker policy.
- Implementing future rich `docs/` generation? Consume `DocumentModel[]` and write files. The shape is already defined.

Do not invent intermediate types for things that already have a domain type. Do not modify domain types to fit an implementation detail — change the implementation to fit the domain contract.
