# Architecture

## Overview

`ai-project-docs` is a CLI tool with a pipeline architecture. The user runs a single command; the tool reads a target repository, assembles a **Project Knowledge Model (PKM)**, and runs generators that produce structured outputs — starting with deterministic Markdown in `.ai-docs/`. AI-powered analysis is planned for a later stage.

Each stage of the pipeline is isolated in its own module. No module reaches into another module's internals. Analysis stages produce typed outputs that the knowledge builder maps into `ProjectKnowledge`. Generators consume only the PKM.

---

## Project Knowledge Model (PKM)

The PKM (`src/knowledge/`) is the application's single source of truth. It is analogous to an **AST in a compiler**:

- **Analysis stages** (scanner, detectors, planner, future AI) gather facts about the repository.
- **The knowledge builder** assembles those facts into one structured `ProjectKnowledge` object.
- **Generators** (Markdown writer today; Cursor rules, skills, agent packs later) read from the PKM — never from raw repository data.

This separation means a new output format only needs a new generator. It does not re-scan the repository or re-detect technologies.

### PKM sections

| Section | Contents today | Future |
|---|---|---|
| `metadata` | Schema version, timestamps, generator version, project name | — |
| `repository` | Mapped from `RepositoryInfo` | Tree (`repositoryTree`), ignore rules |
| `technologies` | Mapped from `TechnologyProfile` | Deeper stack signals |
| `documentation` | `DocumentationPlan` | Generated document contents |
| `analysis` | Folder knowledge (`folderContexts`), module knowledge (`modules`), dependency graph (`dependencyGraph`), conventions (`conventions`), navigation map (`navigationMap`); AI fields pending | Architecture |

### Integration rule

**Future modules must consume `ProjectKnowledge`.** Do not pass `RepositoryInfo`, `TechnologyProfile`, or `DocumentationPlan` directly to generators. Upstream producers may still emit their own types; the knowledge builder maps them into the PKM at the **Build Project Knowledge** pipeline step.

---

## Layers

```
┌─────────────────────────────────────────────────┐
│  src/cli.ts          CLI surface                │
│  src/config/         Arg parsing, env vars      │
│  src/core/           Pipeline orchestration     │  ✅ done
├─────────────────────────────────────────────────┤
│  src/scanner/        File system reading        │  ✅ metadata + recursive tree scan
│  src/detectors/      Technology detection       │  ✅ done — top-level detection
│  src/analyzers/      PKM enrichment analyzers   │  ✅ folder, module, dependency, conventions
│  src/knowledge/      Project Knowledge Model    │  ✅ done — PKM types + builder
│  src/ai/             OpenRouter integration     │  planned
│  src/docs/           Generators (Markdown…)     │  ✅ planning + PKM-powered rendering + writing
├─────────────────────────────────────────────────┤
│  src/domain/         Pipeline + legacy types    │  ✅ done
│  src/utils/          Pure shared helpers        │  ✅ done
└─────────────────────────────────────────────────┘
```

The domain layer defines pipeline contracts and legacy analysis types. The PKM layer (`src/knowledge/`) is the application contract for all generators.

---

## Analysis pipeline

The full pipeline is defined declaratively in `src/domain/pipeline.ts` as `ANALYSIS_PIPELINE`. It is the authoritative description of what the tool does, step by step.

```
 1. Resolve Configuration      process.argv, process.env       → RuntimeConfig
 2. Load Repository Metadata   targetProjectPath               → RepositoryInfo       ✅
 3. Scan Repository Structure  RepositoryInfo                  → RepositoryNode (tree)  ✅
 4. Detect Technologies        RepositoryNode, RepositoryInfo  → TechnologyProfile    ✅
 5. Build Repository Model     RepositoryInfo + tree + profile → ProjectContext
 6. Analyze Architecture       ProjectContext                  → AnalysisResult
 7. Generate Documentation     RepositoryInfo, TechnologyProfile → DocumentationPlan  ✅
 8. Build Project Knowledge    RepositoryInfo + profile + plan → ProjectKnowledge     ✅
 9. Analyze Folder Knowledge  ProjectKnowledge                → FolderKnowledge[]    ✅
10. Analyze Modules           ProjectKnowledge                → ModuleKnowledge[]    ✅
11. Analyze Dependency Graph  ProjectKnowledge                → DependencyGraphKnowledge ✅
12. Analyze Conventions       ProjectKnowledge                → ConventionKnowledge[] ✅
13. Build AI Navigation Map   ProjectKnowledge                → NavigationMapKnowledge ✅
14. Write Documentation        ProjectKnowledge                → .ai-docs/*.md        ✅
15. Validate Documentation     DocumentModel[], file paths     → validation report
16. Persist Project Knowledge  ProjectKnowledge                → .ai-docs/knowledge/  ✅
```

Steps 1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, and 16 are implemented. Step 8 assembles the PKM in memory; step 9 enriches `knowledge.analysis.folderContexts`; step 10 enriches `knowledge.analysis.modules`; step 11 enriches `knowledge.analysis.dependencyGraph`; step 12 enriches `knowledge.analysis.conventions`; step 13 enriches `knowledge.analysis.navigationMap`; step 16 persists it as JSON; step 14 writes Markdown derived from the PKM. Steps 5, 6, and 15 still have placeholder handlers.

---

## Declarative pipeline vs execution orchestrator

The pipeline exists in two distinct forms, each in a different layer:

| Concern | Location | What it contains |
|---|---|---|
| **What** the pipeline does | `src/domain/pipeline.ts` | Step names, descriptions, input/output types — pure data, no runtime behavior |
| **How** the pipeline executes | `src/core/pipeline-orchestrator.ts` | Step loop, handler calls, status tracking, progress output, error collection |

`ANALYSIS_PIPELINE` in the domain layer is documentation. It can be read, inspected, and validated without running anything. The orchestrator reads that documentation at runtime and drives execution against it.

Adding a new pipeline step involves two changes: add the step to the domain definition, then wire its real handler into the orchestrator.

---

## Repository scanning

`src/scanner/repository-scanner.ts` implements step 3 (Scan Repository Structure). It receives `RepositoryInfo` and returns a `RepositoryNode` tree representing every file and directory under the project root.

The scanner:

- Starts from the target project root and walks recursively.
- Uses `RepositoryBoundary` (`resolvePathWithinRoot`) so paths never escape the repository.
- Applies ignore rules: built-in defaults, `.gitignore` patterns, and always skips `.git` and `node_modules`.
- Enforces `maxDepth` (default 12) and `maxFiles` (default 10,000) limits.
- Skips hidden entries unless `includeHidden` is true.
- Records `extension` and `sizeBytes` on file nodes; does **not** read file contents.

The tree is stored on `RepositoryInfo.repositoryTree`, mapped into `ProjectKnowledge.repository.repositoryTree` by the knowledge builder, and persisted to `repository-tree.json` alongside the full PKM snapshot.

**Future analyzers must consume the tree from PKM** — not re-scan the repository. One scan per pipeline run keeps folder analysis, module discovery, and dependency graph stages consistent.

---

`src/detectors/` bridges the gap between raw repository metadata (step 2) and the AI analysis (step 6). It runs after `RepositoryInfo` is built and before the AI is called.

Detection sources at this stage:
- **Top-level filenames** — `tsconfig.json`, `Dockerfile`, `docker-compose.yml` → languages and tooling
- **Lockfiles** — `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb` → package manager
- **`package.json` deps** — framework and tooling identification from `dependencies`/`devDependencies`

Detection intentionally avoids recursive directory scanning. The top-level metadata alone provides enough signal for the AI stage to choose the right documentation strategy. Deeper analysis (module boundaries, architectural patterns) is the AI's responsibility.

Result: `TechnologyProfile { languages, frameworks, packageManagers, tooling, confidence }`.

---

## Folder knowledge analysis

`src/analyzers/` implements deterministic PKM enrichment. The first analyzer — **folder knowledge** — runs at pipeline step 9 (Analyze Folder Knowledge), after the PKM is assembled and before Markdown is written.

### Why folder-level context matters

AI agents navigating an unfamiliar repository need to know what each directory is for before opening files. Without folder knowledge, agents guess from names (`lib` vs `libs`, `utils` vs `helpers`) and hallucinate responsibilities. Structured `FolderKnowledge` entries give agents:

- A **classification** (`source`, `test`, `config`, `documentation`, …)
- A **responsibility** sentence per folder
- **Important files** (README, config manifests) at that level
- **Child folders** for navigation

### Why analyzers consume PKM instead of re-scanning

The repository tree is scanned once (step 3) and stored in `knowledge.repository.repositoryTree`. Analyzers read that tree from PKM — they do not walk the filesystem again. This keeps folder analysis, future module discovery, and dependency graphs consistent with the same ignore rules and depth limits.

### Folder classifier

`src/analyzers/folder-classifier.ts` maps folder names and file-name signals to `FolderClassification` values deterministically. Examples: `src` → `source`, `__tests__` → `test`, `node_modules` → `dependency-cache`. No file contents are read.

### Folder analyzer

`src/analyzers/folder-analyzer.ts` walks the PKM tree and produces `FolderKnowledge[]`. It skips non-documentable folders (`node_modules`, `.git`, `dist`, `build`, `coverage`, `{docsDir}/knowledge`) and records important config files per folder.

Results are stored in `knowledge.analysis.folderContexts` and persisted to `analysis.json` and `folders.json`.

### Markdown from FolderKnowledge

`folder-structure.md` is rendered from `knowledge.analysis.folderContexts` by `src/docs/markdown-renderers/folder-structure-renderer.ts` — grouping folders by classification, listing responsibilities and important files — without re-walking the tree.

---

## Module discovery analysis

The second deterministic analyzer — **module discovery** — runs at pipeline step 10 (Analyze Modules), immediately after folder knowledge is assembled.

### Why module knowledge is different from folder knowledge

Folder knowledge describes **every directory** in the repository tree: classification, depth, important files, and child folders. Module knowledge describes **meaningful architectural units** — applications, libraries, features, platform core modules — that agents use to navigate the project at a higher level.

A folder like `src/utils` is classified as `source` with tooling responsibilities. A module entry for `src/knowledge` is typed as `core` with a sentence explaining its role in the Project Knowledge Model. Agents load module knowledge to decide *where to start*; they load folder knowledge to understand *what surrounds a specific path*.

### Module classifier and analyzer

`src/analyzers/module-classifier.ts` maps structural paths to `ModuleType` values using deterministic heuristics:

- Monorepo containers: `apps/*` → `application`, `packages/*` → `package`, `libs/*` → `library`
- Source containers: `src/features/*` → `feature`, `src/modules/*` → `feature`
- Direct source modules: `src/knowledge`, `src/scanner`, `src/analyzers`, … → `core`
- Group folders: `src/components` → `component-group`, `src/services` → `service-group`
- Documentation: `docs`, `.ai-docs` → `documentation`

`src/analyzers/module-analyzer.ts` consumes `knowledge.analysis.folderContexts` and `knowledge.technologies` — not the filesystem. It produces `ModuleKnowledge[]` with name, path, type, optional framework hint, responsibility, important files, related folders, signals, and confidence.

Results are stored in `knowledge.analysis.modules` and persisted to `analysis.json` and `modules.json`.

### Why deterministic heuristics come before AI analysis

Structural folder names (`apps/`, `packages/`, `src/features/`) are reliable signals that do not require reading file contents or calling an AI provider. Deterministic module discovery gives agents a baseline navigation map on every pipeline run — fast, reproducible, and free of model variance.

AI architecture analysis (step 6, future) will enrich deeper fields like conventions and navigation graphs. Framework-specific module analyzers (Angular NgModules, NestJS modules, Nx projects) can be added later as specialized classifiers that extend the same PKM section without replacing the structural baseline.

### Dependency graph analyzer

The third deterministic analyzer — **dependency graph** — runs at pipeline step 11 (Analyze Dependency Graph), immediately after module discovery.

Folder and module knowledge describe *what exists* in the repository. The dependency graph describes *how modules relate* — which module imports another, with evidence and confidence. Agents use this to understand impact before making changes: if `src/core` imports `src/knowledge`, a change to the PKM contract may require updates in the orchestrator.

`src/analyzers/import-parser.ts` performs lightweight, regex-based extraction of TypeScript and JavaScript import specifiers (`import … from`, side-effect imports, `export … from`, `require()`). It reads only `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs` files under discovered module paths — not the entire repository. It does not use an AST parser yet.

`src/analyzers/dependency-graph-analyzer.ts` consumes `ProjectKnowledge`, uses `ModuleKnowledge` entries as graph nodes, resolves relative import paths to target modules, and creates `imports` edges with evidence (`sourceFile`, `importPath`) and confidence (`high` when the import resolves directly to a module, `medium` when it resolves under a module path, `low` when inferred weakly).

Results are stored in `knowledge.analysis.dependencyGraph` and persisted to `analysis.json` and `dependencies.json`.

**Limitations of regex-based import parsing:** dynamic imports, path aliases (`@/…`), template literals, and non-JS/TS imports are not detected. Future AST-based analyzers can replace or augment `import-parser.ts` without changing the PKM contract.

### Convention analyzer

The fourth deterministic analyzer — **conventions** — runs at pipeline step 12 (Analyze Conventions), after the dependency graph is built.

Conventions answer the question agents most often get wrong: *what patterns does this project already follow?* An agent that does not know a project uses TypeScript strict mode, co-located `*.test.ts` files, or a `src/domain`-stays-pure rule will silently break those patterns. Convention knowledge makes the patterns explicit, structured, and evidence-backed.

`src/analyzers/convention-classifier.ts` contains the pure detection rules — one function per category (documentation, repository structure, TypeScript, package management, testing, generated context, architecture) plus tolerant parsing of tsconfig/package.json text. `src/analyzers/convention-analyzer.ts` builds the detection input from the PKM (repository tree index, detected technologies, module knowledge) and performs the only file access the analyzer is allowed: safe reads of `tsconfig.json` and `package.json` at the repository root, resolved through `RepositoryBoundary`. No recursive scanning, no arbitrary source reads, no AI calls.

Each `ConventionKnowledge` entry carries a `category`, `name`, `description`, `evidence[]` (`type`, `source`, `detail`), and `confidence` (`high`/`medium`/`low`). Structured conventions — unlike a plain `string[]` — can be filtered by category, ranked by confidence, and audited from their evidence. Deterministic detection runs before any AI analysis so every pipeline run produces the same reproducible convention baseline; the future AI stage extends it rather than replacing it.

Results are stored in `knowledge.analysis.conventions` and persisted to `analysis.json` and `conventions.json`. `conventions.md` is rendered from this PKM section by `src/docs/markdown-renderers/conventions-renderer.ts`.

### AI Navigation Map

The fifth deterministic analyzer — the **AI Navigation Map** — runs at pipeline step 13 (Build AI Navigation Map), after all other deterministic analysis is complete. It is the bridge between raw PKM data and practical agent usage.

The other analyzers answer *what is this project*: its folders, modules, dependencies, and conventions. The navigation map answers the question an agent asks first: *given the task I am about to do, what should I read?* Without it, agents either load everything (wasted tokens) or guess (broken conventions).

`src/analyzers/navigation-map-builder.ts` defines one deterministic `NavigationRule` per task type — `architecture-change`, `new-feature`, `bug-fix`, `test-change`, `documentation-change`, `config-change`, `dependency-change`, `ai-agent-integration`. Each rule lists recommended PKM knowledge sections, recommended Markdown documents, task-specific warnings, and *candidate* module/folder matchers. `src/analyzers/navigation-map-analyzer.ts` resolves those candidates against actual PKM data: `relatedModules` and `relatedFolders` contain only paths that exist in `analysis.modules` and `analysis.folderContexts` — empty arrays when nothing matches, never invented paths.

Confidence is verification-based: `high` only when every recommended knowledge section is populated in the PKM and every recommended document is in the documentation plan; entries degrade to `medium`/`low` as recommendations become unverifiable.

The MVP map is deterministic by design — no OpenRouter, no filesystem access. The same PKM always yields the same navigation map, giving agents a reproducible reading list on every run. A future AI stage can extend the map with project-specific task types without replacing the baseline.

Results are stored in `knowledge.analysis.navigationMap` and persisted to `analysis.json` and `navigation-map.json`. `agent-navigation.md` is rendered from this PKM section by `src/docs/markdown-renderers/agent-navigation-renderer.ts`; future agent-specific exporters (Cursor rules, skills, agent packs) must consume the same section rather than hardcoding reading lists.

---

## Documentation planning

`src/docs/documentation-planner.ts` implements step 7 (Generate Documentation Plan). It receives `docsDir` and `TechnologyProfile` and returns a `DocumentationPlan` — a deterministic, typed manifest of which documents will be written to `.ai-docs/`.

**Planning is separate from generation.** The plan commits to a file list before any AI calls or file writes happen. This allows:
- Future steps (Write Documentation, Validate Documentation) to work against a known manifest.
- Agents to understand what context files will exist before any are written.
- The plan to be logged, cached, or inspected independently.

**Plan structure:**

| Source | Documents |
|---|---|
| `core` | README.md, architecture.md, folder-structure.md, agent-navigation.md, conventions.md, dependency-map.md, change-log.md |
| `agent` | AGENTS.md, ai-context.md, implementation-guide.md |
| `technology` | Framework-specific docs based on `TechnologyProfile.frameworks` |

The `strategy` field on `DocumentationPlan` encodes which technology-specific document set was activated (e.g. `standard-angular`, `standard-react-nestjs`, or `standard` for no known framework).

## Project Knowledge assembly

`src/knowledge/knowledge-builder.ts` implements step 8 (Build Project Knowledge). It receives `RepositoryInfo`, `TechnologyProfile`, and `DocumentationPlan` and returns `ProjectKnowledge` — a pure mapping with no filesystem, AI, or scanner logic.

The PKM is the application contract. Every generator downstream reads from `ProjectKnowledge` instead of the raw pipeline outputs.

## Project Knowledge persistence

`src/knowledge/knowledge-writer.ts` implements step 16 (Persist Project Knowledge). It writes the in-memory `ProjectKnowledge` to `.ai-docs/knowledge/` inside the target repository:

| File | Contents |
|---|---|
| `project-knowledge.json` | Full `ProjectKnowledge` snapshot |
| `repository.json` | Repository metadata only (tree excluded — use `repository-tree.json`) |
| `repository-tree.json` | Repository tree only (when scan completed) |
| `technologies.json` | Technologies section + `schemaVersion` + `generatedAt` |
| `documentation.json` | Documentation section + `schemaVersion` + `generatedAt` |
| `analysis.json` | Analysis section including `folderContexts`, `modules`, `dependencyGraph`, `conventions`, and `navigationMap` |
| `folders.json` | Folder knowledge only (when analysis ran) |
| `modules.json` | Module knowledge only (when module analysis ran) |
| `dependencies.json` | Dependency graph only (when dependency graph analysis ran) |
| `conventions.json` | Convention knowledge only (when convention analysis ran) |
| `navigation-map.json` | AI navigation map only (when the navigation map was built) |

Path resolution uses `resolvePathWithinRoot()` via `knowledge-paths.ts` — writes never escape the target project root. JSON files are tool-managed machine state and are always overwritten on each persist run (no Markdown marker policy).

**Why persist?** The PKM becomes a reusable artifact for debugging, external integrations, future incremental diffing, and agent-specific exporters. Markdown is a human/agent-readable *derivative*; JSON knowledge is the canonical persisted form.

## Documentation writing

`src/docs/documentation-writer.ts` implements step 14 (Write Documentation). It receives `ProjectKnowledge` and writes Markdown files into `<repository.rootPath>/<documentation.plan.docsDir>/`.

The writer is a **generator**: it reads only from the PKM. It does not receive `RuntimeConfig` and does not call the scanner or detectors directly.

### PKM-powered Markdown renderers

Rendering is split from writing. `src/docs/markdown-renderers/` contains one small deterministic renderer per key document, plus a dispatch registry:

| Document | Renderer | PKM sections rendered |
|---|---|---|
| `architecture.md` | `architecture-renderer.ts` | technologies, modules, architectural conventions, dependency graph summary, architecture-change guidance |
| `folder-structure.md` | `folder-structure-renderer.ts` | folder contexts grouped by classification, responsibilities, important files, ignored folders |
| `dependency-map.md` | `dependency-map-renderer.ts` | graph nodes, edges, per-edge import evidence, lightweight-graph warning |
| `conventions.md` | `conventions-renderer.ts` | conventions grouped by category with description, confidence, and evidence |
| `agent-navigation.md` | `agent-navigation-renderer.ts` | per-task-type reading lists, related modules/folders, warnings |
| `ai-context.md` | `ai-context-renderer.ts` | PKM summary, read-first list, key modules, key conventions, current limitations |
| `implementation-guide.md` | `implementation-guide-renderer.ts` | safe-change steps seasoned with actual module and navigation data |

Documents without a dedicated renderer (`README.md`, `change-log.md`, `AGENTS.md`, technology docs) fall back to the generic deterministic template in `document-template.ts`. The writer reports both counts (`PKM-powered documents` / `Generic documents`).

**Renderer rules:** renderers are presentation-only. They must not analyze the repository, read the filesystem, or call AI — facts come exclusively from the PKM, which remains the source of truth. Markdown is a derived output. Renderers stay small and deterministic: the same PKM always yields the same Markdown, and missing PKM sections render as honest "not available yet" notes.

### Write safety

The writer is intentionally conservative:

- It creates the docs directory if it does not exist.
- It never deletes files.
- It only overwrites files that start with the generated-file marker `<!-- Generated by AI Project Docs. Safe to update. -->`.
- It skips unmarked files with a warning so user-created documentation is preserved.

Future AI stages will enrich PKM sections; the same renderers then surface the richer data without changing the ownership rule.

---

## Placeholder execution

Until a real handler is implemented for a step, `executePipeline` calls `runPlaceholderStep` for that step. The placeholder returns immediately and marks the step `completed`. This keeps the full pipeline runnable and traceable before all implementations exist while allowing real handlers to be introduced safely one step at a time.

Real handlers are plugged in by replacing the placeholder call for the relevant step inside `executePipeline`. Handler logic should never be added directly to `cli.ts` or `run()`.

---

## Execution result

`executePipeline` returns a `PipelineExecutionResult`:

```typescript
interface PipelineExecutionResult {
  success: boolean;
  steps: ExecutedPipelineStep[];
  startedAt: string;
  finishedAt: string;
  errors: PipelineExecutionError[];
  projectKnowledge?: ProjectKnowledge;     // primary pipeline artifact
}
```

Each `ExecutedPipelineStep` carries the step name, its final `PipelineStepStatus`, timestamps, and an optional message. `PipelineExecutionError` records the step name, a human-readable message, and the original cause.

---

## Domain model and PKM

Analysis stages produce typed outputs defined in `src/domain/` and `src/docs/`. The knowledge builder maps them into `ProjectKnowledge`:

| Type | Produced by step | Mapped into PKM section |
|---|---|---|
| `RuntimeConfig` | 1 — Resolve Configuration | (not in PKM — runtime only) |
| `RepositoryInfo` | 2 — Load Metadata | `knowledge.repository` |
| `RepositoryNode` | 3 — Scan Structure | (future: `knowledge.repository`) |
| `TechnologyProfile` | 4 — Detect Technologies | `knowledge.technologies` |
| `DocumentationPlan` | 7 — Generate Plan | `knowledge.documentation.plan` |
| `AnalysisResult` | 6 — Analyze Architecture | (future: `knowledge.analysis`) |
| `ProjectKnowledge` | 8 — Build Project Knowledge | consumed by all generators |

`ProjectContext` in `src/domain/context.ts` remains for the future AI analysis stage. Generators must use `ProjectKnowledge`, not `ProjectContext`.

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
                            ├─ parseArgs()
                            ├─ resolveApiKey()
                            ├─ validate target path
                            └─ validate docsDir
                            │
                            ▼
                         RuntimeConfig
                            │
                            ▼
                         core/index.ts → run(config)
                            └─ executePipeline(config)
                                 ├─ Load Repository Metadata
                                 │    scanner/repository-loader → RepositoryInfo
                                 ├─ Detect Technologies
                                 │    detectors/technology-detector → TechnologyProfile
                                 ├─ Generate Documentation Plan
                                 │    docs/documentation-planner → DocumentationPlan
                                 ├─ Build Project Knowledge
                                 │    knowledge/knowledge-builder → ProjectKnowledge
                                 ├─ Write Documentation
                                 │    docs/documentation-writer → .ai-docs/*.md
                                 ├─ Persist Project Knowledge
                                 │    knowledge/knowledge-writer → .ai-docs/knowledge/*.json
                                 └─ (remaining steps: placeholder)
```

Key invariant: `process.argv` and `process.env` are read only inside `src/config/`. Every other module receives a `RuntimeConfig` or a domain type.

---

## Key design decisions

**PKM before generators.** The Project Knowledge Model is assembled before any output is written. Generators read from `ProjectKnowledge` — they do not re-analyze the repository.

**Domain types before implementation.** `src/domain/` and `src/knowledge/` were created before downstream logic. Every implementation has a precise contract to fulfill rather than inventing its own intermediate types.

**Pipeline over monolith.** Each stage produces a plain data structure consumed by the next. Stages are independently testable and replaceable.

**Declarative definition, separate execution.** The pipeline definition in `src/domain/` is pure data. The orchestrator in `src/core/` is the only place that knows how to execute it.

**Detection before AI.** Technology detection runs from top-level metadata before the AI stage. This provides a cheap, high-confidence signal that lets the AI focus on architecture analysis rather than inferring the stack from source code.

**Plan before generate.** The documentation plan (step 7) commits to a deterministic file manifest before any content is generated or written. Future generation steps work against this manifest rather than deciding on-the-fly which files to create.

**Deterministic write before AI enrichment.** Step 14 writes predictable Markdown rendered from PKM data already available in the pipeline — deterministic renderers for key documents, a generic template for the rest. This validates ownership rules, path safety, and incremental file updates before introducing AI-generated architecture analysis.

**Config is the only environment reader.** `src/config/index.ts` is the single point of contact with `process.argv` and `process.env`.

**Placeholder skeleton before real handlers.** The full pipeline runs end-to-end with placeholder steps for unimplemented stages. This validates the execution flow and gives future implementors a clear location to plug in real behavior.

**Fail fast, fail clearly.** Configuration validation runs before any I/O. A failed step marks the pipeline `success: false` and surfaces a `PipelineExecutionError`.

**Incremental updates by design.** The generated-file marker is the first incremental safety mechanism: tool-managed files can be refreshed while user-managed files are preserved. Step 10 (Save Incremental State) will later add finer-grained regeneration.

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
