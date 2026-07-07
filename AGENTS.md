# AGENTS.md — Guide for AI Coding Agents

This file is the mandatory starting point for any AI agent working inside this repository. Read it before opening any source file.

---

## What this project does

`ai-project-docs` is a CLI tool that analyzes software repositories and generates AI-readable documentation. It is evolving into a **Context Engineering platform** whose single source of truth is the **Project Knowledge Model (PKM)** in `src/knowledge/`.

---

## Project Knowledge Model (PKM)

All future features must integrate through the PKM.

The PKM (`ProjectKnowledge`) is assembled at pipeline step **Build Project Knowledge** and consumed by all **generators** (Markdown writer today; Cursor rules, skills, agent packs later).

**Integration rule:** Generators must receive `ProjectKnowledge`. They must not depend directly on `RepositoryInfo`, `TechnologyProfile`, or `DocumentationPlan`.

| If you are building… | Read… | Produce or consume… |
|---|---|---|
| Scanner / detector / planner | `src/domain/` types | Stage output types (mapped into PKM by knowledge builder) |
| Knowledge enrichment | `src/knowledge/project-knowledge.ts` | Updated `ProjectKnowledge` sections |
| Deterministic analyzer | `src/analyzers/` | Enrich `ProjectKnowledge` (e.g. `analysis.folderContexts`) |
| Any generator (docs, rules, skills…) | `src/knowledge/` | Consume `ProjectKnowledge` |

Upstream analysis stages may still emit their own types. The knowledge builder (`src/knowledge/knowledge-builder.ts`) maps them into the PKM. Do not bypass this step.

---

## Where to start

Before touching any code, load context in this order:

1. **This file** — understand the repository conventions and PKM integration rule.
2. [`docs/architecture.md`](docs/architecture.md) — understand the system design, layer diagram, and pipeline.
3. [`docs/folder-structure.md`](docs/folder-structure.md) — understand where each concern lives.
4. [`src/knowledge/README.md`](src/knowledge/README.md) — understand the Project Knowledge Model.
5. [`src/domain/README.md`](src/domain/README.md) — understand analysis-stage types.
6. The `README.md` of the specific folder you are about to modify.

Do not start from `src/` without reading the above. You will make wrong assumptions.

---

## Understanding the domain model

Analysis-stage types live in `src/domain/`. The application contract for generators lives in `src/knowledge/`. Before implementing any feature, read the relevant types:

- **Implementing the scanner?** Read `src/domain/repository.ts`. Your code must produce `RepositoryInfo` and `RepositoryNode`.
- **Adding a new detector?** Read `src/domain/technology.ts`. Your code must contribute to `TechnologyProfile`.
- **Adding a new document type or framework plan?** Read `src/docs/documentation-plan.ts` and `src/docs/documentation-planner.ts`. Add a new function returning `PlannedDocument[]` and call it from `buildTechnologyDocuments`.
- **Implementing a deterministic analyzer?** Read `src/analyzers/README.md`. Consume `ProjectKnowledge`; enrich `analysis.folderContexts`, `analysis.modules`, `analysis.dependencyGraph`, or future analysis sections. Do not scan the filesystem or call OpenRouter.
- **Building or extending the PKM?** Read `src/knowledge/project-knowledge.ts` and `src/knowledge/knowledge-builder.ts`. Map new analysis outputs into `ProjectKnowledge` sections.
- **Implementing the AI integration?** Read `src/domain/analysis.ts` and `src/domain/context.ts`. Future: enrich `knowledge.analysis` from `AnalysisResult`.
- **Implementing PKM persistence?** Read `src/knowledge/knowledge-paths.ts` and `src/knowledge/knowledge-writer.ts`. Use `resolvePathWithinRoot()` — never write outside the target repo.
- **Implementing a generator (docs writer, future formats)?** Read `src/knowledge/`. Consume `ProjectKnowledge` in memory or load from `.ai-docs/knowledge/project-knowledge.json`.
- **Implementing deterministic document rendering or writing?** Read `src/docs/documentation-plan.ts`, `src/docs/document-template.ts`, and `src/docs/documentation-writer.ts`. Preserve the generated-file marker policy and do not overwrite unmarked files.
- **Understanding the full pipeline?** Read `src/domain/pipeline.ts`. The `ANALYSIS_PIPELINE` constant is the authoritative description of every step, its input, and its output.
- **Wiring a real handler into execution?** Read `src/core/pipeline-orchestrator.ts`. Replace the placeholder call for the relevant step and import the handler from the appropriate module.

Do not invent intermediate types for concepts that already have a PKM section or domain type. Do not modify types to fit an implementation detail — adapt the implementation to fit the contract.

---

## Declarative pipeline vs execution orchestrator

The pipeline appears in two places. Do not confuse them:

| Location | Role |
|---|---|
| `src/domain/pipeline.ts` | **What** the pipeline does. Pure data — step names, descriptions, input/output types. No runtime behavior. |
| `src/core/pipeline-orchestrator.ts` | **How** the pipeline executes. The step loop, handler dispatch, status tracking, error collection. |

When you add a new pipeline step:
1. Add it to `ANALYSIS_PIPELINE` in `src/domain/pipeline.ts`.
2. Add a real handler in the appropriate module (`src/scanner/`, `src/detectors/`, `src/knowledge/`, `src/ai/`, or `src/docs/`).
3. Wire the handler into `executePipeline` in `src/core/pipeline-orchestrator.ts`.

Never put scanner logic, detection logic, AI calls, or file writes directly inside `src/cli.ts` or `src/core/index.ts`.

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
- `src/core/` — orchestration only. Receives `RuntimeConfig`, drives `executePipeline`, calls stage handlers in order. No scanner logic, no detection logic, no AI calls, no file I/O.
- `src/scanner/` — reads the target repository from disk, produces `RepositoryInfo` and `RepositoryNode`.
- `src/detectors/` — detects technology stack from `RepositoryInfo`, produces `TechnologyProfile`. No directory walking.
- `src/knowledge/` — Project Knowledge Model. Builder assembles `ProjectKnowledge`; writer persists it to `.ai-docs/knowledge/`.
- `src/docs/` — documentation planning and writing (generators). `documentation-writer.ts` writes from `ProjectKnowledge` only.
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
- A complete domain model (`src/domain/`) defining analysis-stage types and the declarative pipeline.
- A Project Knowledge Model (`src/knowledge/`) with types and `buildProjectKnowledge()`.
- A pipeline orchestrator (`src/core/`) that runs all 14 steps and returns `PipelineExecutionResult`.
- Step 2 (Load Repository Metadata) implemented in `src/scanner/repository-loader.ts`.
- Step 3 (Scan Repository Structure) implemented in `src/scanner/repository-scanner.ts` — produces `RepositoryNode` tree with ignore rules and safety limits.
- Step 4 (Detect Technologies) implemented in `src/detectors/technology-detector.ts` and `src/detectors/package-manager-detector.ts`.
- Step 7 (Generate Documentation Plan) implemented in `src/docs/documentation-planner.ts` — produces a `DocumentationPlan` with core, agent, and technology-specific documents.
- Step 8 (Build Project Knowledge) implemented in `src/knowledge/knowledge-builder.ts` — assembles `ProjectKnowledge`.
- Step 9 (Analyze Folder Knowledge) implemented in `src/analyzers/folder-analyzer.ts` — produces `FolderKnowledge[]` in `analysis.folderContexts`.
- Step 10 (Analyze Modules) implemented in `src/analyzers/module-analyzer.ts` — produces `ModuleKnowledge[]` in `analysis.modules`.
- Step 11 (Analyze Dependency Graph) implemented in `src/analyzers/dependency-graph-analyzer.ts` — produces `DependencyGraphKnowledge` in `analysis.dependencyGraph`.
- Step 12 (Write Documentation) implemented in `src/docs/documentation-writer.ts` — writes Markdown from `ProjectKnowledge`.
- Step 14 (Persist Project Knowledge) implemented in `src/knowledge/knowledge-writer.ts` — writes JSON to `.ai-docs/knowledge/`.

The scanner full tree walk (step 3) is implemented. The AI integration (step 6) and validation (step 13) are not yet implemented.

---

## How to build and verify

```bash
npm install
npm run build          # compiles TypeScript to dist/ with zero errors
npm test               # runs unit tests for scanner, detectors, knowledge, and analyzers
node dist/cli.js .     # runs the pipeline against this project; shows detected technologies
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
- Do not add scanner logic, directory walks, or `fs` reads to `src/cli.ts` or `src/core/`. Those belong in `src/scanner/`.
- Do not add deterministic analysis logic to `src/scanner/` or `src/core/`. Analyzers belong in `src/analyzers/`.
- Do not add technology detection logic to `src/scanner/`. Detection belongs in `src/detectors/`.
- Do not put real handler logic directly into `executePipeline`. Import and call handler functions from their respective modules.
- Do not write PKM JSON files from `src/docs/` — persistence belongs in `src/knowledge/knowledge-writer.ts`.
- Do not pass `RepositoryInfo`, `TechnologyProfile`, or `DocumentationPlan` directly to generators — use `ProjectKnowledge`.
- Do not add new document templates to `src/core/` or `src/detectors/`. Document template functions belong in `src/docs/documentation-planner.ts`.
- Do not overwrite user-created files inside `.ai-docs/`. Only files starting with `<!-- Generated by AI Project Docs. Safe to update. -->` may be updated by the writer.
