# Context Engineering

## The problem this project solves

AI coding agents are limited not by their reasoning ability but by the quality of context they receive. When an agent opens a repository it has never seen before, it must guess: What does this project do? Where does the business logic live? What are the naming conventions? What changed recently?

Without good answers, the agent either reads too much (wastes tokens, loses focus) or too little (misses critical constraints and makes wrong assumptions). Both failure modes produce low-quality output.

**Context engineering** is the practice of structuring a project so that an agent can load exactly the right context — no more, no less — before it starts working.

---

## The Project Knowledge Model

The tool does not send agents directly to raw repository files. It first assembles a **Project Knowledge Model (PKM)** — a structured snapshot of everything currently known about the project.

The PKM lives in `src/knowledge/` as `ProjectKnowledge`. It contains:

- **Repository facts** — name, root path, detected config files, repository tree, ignore rules
- **Technology signals** — languages, frameworks, tooling, confidence
- **Documentation plan** — which context files will exist and why
- **Analysis** — folder knowledge (`folderContexts`), module knowledge (`modules`), dependency graph (`dependencyGraph`); architecture and navigation graph (future)

Generators (the Markdown writer today; Cursor rules, skills, and agent packs later) read from the PKM. They do not scan the repository or re-detect technologies themselves.

After each pipeline run, the PKM is **persisted** to `.ai-docs/knowledge/` as JSON. That folder is the machine-readable source of truth on disk. Markdown files in `.ai-docs/` are a derived, human/agent-friendly output — not the canonical stored knowledge.

---

## The documentation layer

The output of `ai-project-docs` is a `.ai-docs/` folder inside the target repository. This folder has two roles:

1. **`knowledge/`** — machine-readable JSON snapshots of `ProjectKnowledge` (canonical persisted state).
2. **Markdown files** — agent-readable context derived from the PKM (one output format among many).

### Persisted knowledge (`.ai-docs/knowledge/`)

| File | Purpose |
|---|---|
| `project-knowledge.json` | Full PKM snapshot — load this for complete context |
| `repository.json` | Repository facts only (tree in `repository-tree.json`) |
| `repository-tree.json` | Repository tree only (when scan completed) |
| `technologies.json` | Detected stack only |
| `documentation.json` | Documentation plan only |
| `analysis.json` | Analysis section including `folderContexts`, `modules`, and `dependencyGraph` |
| `folders.json` | Folder knowledge only (when analysis ran) |
| `modules.json` | Module knowledge only (when module analysis ran) |
| `dependencies.json` | Dependency graph only (when dependency graph analysis ran) |

Future generators and external tools should prefer loading persisted JSON over re-analyzing the repository. Incremental updates, diff-based refresh, and validation will compare these files across runs.

### Markdown context files

It answers the questions an agent asks at the start of every task:

- **What is this project?** → `project-overview.md`
- **Where do I start?** → `navigation-guide.md`
- **What does each folder do?** → `folder-structure.md`
- **What are the conventions?** → `conventions.md`
- **What are the key dependencies?** → `dependency-map.md`
- **What has changed recently?** → `recent-changes.md`

Each file is written so that an agent loading it gains enough context to make correct decisions without reading the source code first. In the current implementation, that starts with deterministic placeholders built from repository metadata and technology detection; richer AI analysis is layered in later.

---

## Principles

### 1. Agents should not read the whole repository blindly

A repository with 200 files and 50,000 lines of code cannot be fully loaded into an agent's context. The documentation layer provides a pre-digested map. The agent reads the map, identifies the relevant area, and reads only those source files.

### 2. Structure guides context

The folder structure of a project communicates intent. The documentation layer makes that intent explicit: each folder has a declared responsibility, and agents know where to look for what they need.

### 3. Precision reduces hallucination

Vague documentation produces confident but wrong answers. Every documentation section should be specific enough that an agent reading it makes the same decision a human expert would make.

This principle also applies to how this project is built. The **Project Knowledge Model** defines explicit, typed sections for every fact about a repository. When the scanner returns a `RepositoryInfo`, the knowledge builder maps it into `knowledge.repository`; when the documentation writer renders Markdown, it reads `knowledge.technologies` — there is no ambiguity about what data flows between stages. Named, typed contracts eliminate the gaps that hallucination fills.

### 4. Generators must not analyze the repository

A generator's job is to **translate** structured knowledge into an output format. It must not walk the filesystem, parse `package.json`, or infer the technology stack on its own.

If every generator performed its own analysis, outputs would disagree: the Markdown writer might detect React while a future Cursor rules generator might miss it. The PKM ensures every generator sees the same facts.

Analysis belongs in pipeline stages (scanner, detectors, future AI). Translation belongs in generators (`src/docs/` today; more formats later).

### 5. One repository scan per pipeline run

The recursive scanner (step 3) produces a `RepositoryNode` tree that is stored in the PKM as `knowledge.repository.repositoryTree` and persisted to `repository-tree.json`. Analyzers — folder knowledge (step 9), module discovery (step 10), and future stages (dependency graphs, AI documentation) — must consume this tree from PKM instead of walking the filesystem again.

Re-scanning independently would produce inconsistent results, waste I/O, and bypass the ignore rules that protect performance and quality. The PKM is the single source of truth for repository structure.

### 6. Folder classification reduces hallucination

Folder names alone are ambiguous. The folder classifier applies deterministic rules: `src` is `source`, `__tests__` is `test`, `dist` is `build-output`. Each `FolderKnowledge` entry includes the classification, evidence signals, and a one-sentence responsibility. Agents load this instead of inventing folder purposes from naming conventions.

`folderContexts` lives in `knowledge.analysis.folderContexts` and is persisted to `analysis.json` and `folders.json`. Future `folder-structure.md` generation should render from this data — not re-derive structure from the tree.

### 7. Module discovery gives agents an architectural map

Folder knowledge answers "what is this directory?" Module knowledge answers "what are the meaningful units of this project?" Deterministic heuristics detect modules from common structural patterns — `apps/*`, `packages/*`, `src/features/*`, `src/knowledge`, and similar paths — without reading file contents or calling AI.

Each `ModuleKnowledge` entry includes a module type (`application`, `library`, `feature`, `core`, …), a responsibility sentence, related folders, and confidence. Agents use module knowledge to choose an entry point before diving into folder-level detail.

`modules` lives in `knowledge.analysis.modules` and is persisted to `analysis.json` and `modules.json`. Deterministic structural discovery runs on every pipeline run; AI architecture analysis and framework-specific analyzers (Angular, NestJS, Nx) can enrich the same PKM section later without replacing the baseline.

### 8. Dependency graph helps agents understand impact

Module knowledge tells agents *where* to start. The dependency graph tells agents *what depends on what*. The MVP analyzer detects `imports` edges between discovered modules by parsing relative TypeScript and JavaScript import statements — no AST, no OpenRouter, no full re-scan.

Each edge includes evidence (`sourceFile`, `importPath`) and confidence (`high`, `medium`, `low`). Before changing `src/domain`, an agent can read the graph to see that `src/core`, `src/docs`, and `src/knowledge` import from it — reducing the risk of breaking downstream modules.

`dependencyGraph` lives in `knowledge.analysis.dependencyGraph` and is persisted to `analysis.json` and `dependencies.json`. Regex-based parsing is intentionally lightweight and deterministic; it misses dynamic imports, path aliases, and non-JS/TS imports. Future AST-based analyzers can extend or replace `src/analyzers/import-parser.ts` while writing to the same PKM section.

### 9. Documentation must be kept current

Stale documentation is worse than no documentation. It misleads agents into making decisions based on outdated information. The tool supports incremental updates: step 10 of the pipeline (Save Incremental State) persists a snapshot of the current analysis so that future runs only regenerate sections that reflect actual changes.

### 10. Safe ownership matters

Generated files in `.ai-docs/` are owned by the tool, but user-created files must still be protected. Every tool-managed file starts with a marker comment:

```md
<!-- Generated by AI Project Docs. Safe to update. -->
```

The writer updates only files with that marker. If a file exists without the marker, it is preserved and skipped with a warning. This allows safe incremental adoption: teams can keep hand-written docs alongside generated docs without risking accidental overwrite.

---

## How structured knowledge reduces hallucination

Without a single knowledge model, agents implementing different pipeline stages would make independent assumptions:
- The scanner might call a field `filePath`; a generator might expect `path`.
- One generator might expect `modules` to be a list of strings; the analysis might return objects.
- A Markdown writer and a future skills generator might detect different frameworks from the same repository.

These mismatches are invisible until runtime, and they invite the agent to guess at the right structure.

The **Project Knowledge Model** removes guesswork by declaring one structured object that every generator reads. Analysis stages populate sections of the PKM; generators consume them. Agents do not invent parallel data structures; they implement against the PKM contract.

`src/domain/` still defines the typed outputs of individual analysis stages. `src/knowledge/` defines how those outputs are assembled into the application contract.

---

## Repository scanning and ignore rules

Step 3 (Scan Repository Structure) walks the target repository recursively and builds a `RepositoryNode` tree. The scanner:

- Uses `RepositoryBoundary` so resolved paths never escape the project root.
- Applies built-in ignore patterns, `.gitignore` rules, and always skips `.git` and `node_modules`.
- Enforces depth and file-count limits to stay safe on large repositories.
- Records file extensions and sizes without reading file contents.

Ignore rules protect **performance** (skipping `node_modules`, `dist`, caches) and **quality** (excluding generated artifacts from the tree). Effective patterns are stored on `knowledge.repository.ignoredPaths`.

The tree becomes part of the PKM at step 8 and is persisted at step 11. Load `repository-tree.json` or `project-knowledge.json` when you need structure — do not re-scan.

---

## How technology detection helps AI agents choose the right strategy

A `TechnologyProfile` is computed in step 4 before the AI stage runs (step 6). It answers:

- Is this a TypeScript project? → generate typed interface docs, avoid generic JS conventions.
- Is this an Angular project? → document NgModules, services, dependency injection patterns.
- Is this a Next.js project? → document pages, API routes, server components, data fetching.
- Is this a NestJS API? → document controllers, modules, providers, guards.
- Does it use Jest? → include testing conventions in the documentation.

Without this pre-computed signal, the AI stage would need to infer the stack by reading source files — wasting tokens and increasing the chance of hallucination. `TechnologyProfile` provides a reliable, high-confidence input that narrows the AI's focus to what actually matters for this project.

Detection is intentionally shallow at this stage. It reads only top-level config files and `package.json` dependencies. This is fast, safe, and reliable. Deeper architecture analysis (module boundaries, patterns, conventions) is the AI stage's responsibility.

---

## Declarative pipeline vs execution skeleton

The pipeline exists in two distinct forms:

**`src/domain/pipeline.ts`** defines the pipeline as a data structure — step names, descriptions, input types, output types. It is documentation that can be read and reasoned about without running any code.

**`src/core/pipeline-orchestrator.ts`** implements how those steps are executed — the step loop, handler dispatch, status tracking, error collection, and console progress output. It reads the declarative pipeline at runtime and drives execution against it.

This separation exists for the same reason domain types exist: to make intent explicit and prevent implementation details from leaking into the wrong layer. Agents should never add scanner logic, detection logic, AI calls, or file writes directly to `src/cli.ts` or `run()`. Those concerns belong in their respective modules; the orchestrator calls them.

---

## Documentation planning — deciding before generating

Step 7 (Generate Documentation Plan) produces a `DocumentationPlan` before any content is written. This is not an optimisation — it is a structural principle.

**Why plan first?** Documentation generation is expensive. Before calling the AI or writing any files, the pipeline commits to a deterministic file manifest based solely on `TechnologyProfile`. This manifest answers the same questions a reader would ask when opening `.ai-docs/` for the first time:

- What files will exist?
- What is each file's purpose?
- Which are required for all projects vs. specific to this stack?

**How technology detection influences the plan.** The `frameworks` array in `TechnologyProfile` selects which technology document suite to include: Angular, React, NestJS, or the generic fallback. Multiple frameworks produce multiple suites simultaneously. The plan's `strategy` field records which path was taken (`standard`, `standard-angular`, `standard-react-nestjs`, etc.).

**How agents use the plan.** An agent working in a repository that has a `DocumentationPlan` in the pipeline result knows exactly what `.ai-docs/` files will exist before they are written. It can reason about the final context layer structure, report missing files, or decide which documents to load for a given task — all without reading any already-written files.

**Where new document templates go.** New framework support is added to `src/docs/documentation-planner.ts` as a new function (e.g. `vueDocuments()`). The planner calls it when the framework is detected. This keeps the pipeline orchestrator clean and the document set extensible without touching any other module.

---

## Deterministic writing before AI analysis

The first documentation writer does not call OpenRouter and does not attempt deep architecture analysis. That is intentional.

Writing deterministic placeholders first has four benefits:

- It proves the docs directory layout and file manifest are correct.
- It validates the overwrite policy before model-generated content exists.
- It gives AI agents an immediate, honest baseline context layer.
- It creates stable file targets that future AI enrichment can update safely.

This is an example of safe incremental documentation: start with what the pipeline knows for sure, then enrich the same files as later stages become available.

---

## Placeholder handlers and why they exist

Steps that haven't been implemented yet run a placeholder handler that returns immediately without doing real work. This is not a shortcut — it is a deliberate design decision:

1. **Visible flow.** The full pipeline output is observable from day one, before all I/O or AI logic is written.
2. **Safe iteration.** Future implementors know exactly where to plug in real behavior: replace the placeholder call for the relevant step in `executePipeline`.
3. **No silent gaps.** A step that hasn't been implemented yet still appears in the progress output and in `PipelineExecutionResult`. Nothing is hidden.

Placeholder handlers are replaced step by step as real implementations are added.

---

## How the pipeline supports incremental documentation

Generating documentation for a large repository is expensive. Doing it on every save is impractical. The pipeline addresses this with step 10 (Save Incremental State):

- Today, files generated by the writer can be refreshed safely because they carry the generated-file marker.
- After a successful future run, a `.ai-docs/.state.json` file will record which `DocumentModel` sections were generated and from what input hash.
- On the next run, the pipeline compares the current `ProjectContext` against the saved state.
- Only sections whose inputs have changed since the last run are regenerated.

This means that fixing a typo in one file does not re-analyze the entire repository. The incremental model also makes the tool composable: a CI system can run it on every commit, and only the documentation sections affected by that commit's changes will be updated.

---

## How AI agents should use these types before adding features

Before implementing any pipeline stage or generator:

1. Read `src/knowledge/README.md` to understand the PKM and the integration rule.
2. Read `src/domain/README.md` to understand analysis-stage types.
3. Find the pipeline step you are implementing in `ANALYSIS_PIPELINE` (in `src/domain/pipeline.ts`). Read its `input` and `output` fields — these are your contract.
4. If you are building a **generator**, consume `ProjectKnowledge` — not `RepositoryInfo`, `TechnologyProfile`, or `DocumentationPlan` directly.
5. If you are building an **analysis stage**, produce the declared output type; the knowledge builder will map it into the PKM.
6. Wire the new handler into `src/core/pipeline-orchestrator.ts` — replace the placeholder call for that step.
7. Do not add scanner, detection, AI, or docs logic to `src/cli.ts` or `src/core/index.ts`.

This sequence prevents the most common agent failure: implementing something that works in isolation but doesn't connect cleanly to the rest of the pipeline.

---

## What good context looks like

Good context is:

- **Specific to the project.** Not generic ("this is a Node.js project") but precise ("this is a Next.js 14 app using the App Router, TypeScript, Vitest for unit tests, and Playwright for e2e tests — see `TechnologyProfile` in the pipeline result").
- **Structured for navigation.** An agent reading `navigation-guide.md` should know in two minutes where to make a change.
- **Honest about what is incomplete.** If a section is unimplemented, the documentation says so explicitly. Agents should not assume that silence means completeness.
- **Written at the right altitude.** Architecture docs describe the system; folder docs describe a module; convention docs describe a pattern. Mixing altitudes produces noise.

---

## How this project documents itself

This repository follows the same principles it promotes.

- `AGENTS.md` is the mandatory entry point for any agent working here.
- `src/knowledge/` defines the Project Knowledge Model — the single source of truth for all generators.
- `src/domain/` defines analysis-stage types and the declarative pipeline.
- Each `src/` subfolder has a `README.md` that declares its responsibility and constraints.
- `docs/` contains architecture and philosophy documentation that an agent can load before touching source code.
- `README.md` tracks implementation status so agents know what is done and what is planned.

Maintaining this documentation is not optional. It is part of the definition of done for every change.
