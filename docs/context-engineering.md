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
- **Analysis** — folder knowledge (`folderContexts`), module knowledge (`modules`), dependency graph (`dependencyGraph`), conventions (`conventions`), navigation map (`navigationMap`); architecture (future)

Generators (the Markdown writer today; Cursor rules, skills, and agent packs later) read from the PKM. They do not scan the repository or re-detect technologies themselves.

**Plugins** enrich the PKM between assembly and generation. Analyzer plugins consume the PKM and return `PluginResult` contributions; `PluginManager` merges them. Technology plugins add framework-specific knowledge without the core knowing Angular, React, or NestJS internals. Plugins never rescan the repository — they read `knowledge.repository.repositoryTree` and prior `analysis.*` sections, using `RepositoryBoundary` only for whitelisted config reads.

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
| `analysis.json` | Analysis section including `folderContexts`, `modules`, `dependencyGraph`, `conventions`, and `navigationMap` |
| `folders.json` | Folder knowledge only (when analysis ran) |
| `modules.json` | Module knowledge only (when module analysis ran) |
| `dependencies.json` | Dependency graph only (when dependency graph analysis ran) |
| `conventions.json` | Convention knowledge only (when convention analysis ran) |
| `navigation-map.json` | AI navigation map only (when the navigation map was built) |
| `change-summary.json` | PKM diff vs the previous run (when change detection ran) |
| `document-impact.json` | Selective regeneration decisions (when change detection ran) |
| `agent-exports.json` | Agent export results (when `--export-agents` ran) |

Future generators and external tools should prefer loading persisted JSON over re-analyzing the repository. **Change detection** compares `project-knowledge.json` across runs and records results in `change-summary.json`. Selective Markdown regeneration uses `document-impact.json`. Agent export results are recorded in `agent-exports.json` when `--export-agents` runs.

### Markdown context files

Markdown is an **output derived from the PKM** — presentation, not analysis. Each key document is produced by a registered template in `src/templates/` that wraps a small deterministic renderer in `src/docs/markdown-renderers/`. Templates consume PKM data only; they never scan the repository or call AI. It answers the questions an agent asks at the start of every task:

- **What is this project's architecture?** → `architecture.md` (technologies, modules, dependency summary)
- **Where do I start for my task?** → `agent-navigation.md` (per-task-type reading lists from the navigation map)
- **What does each folder do?** → `folder-structure.md` (folder contexts, classifications, responsibilities)
- **What are the conventions?** → `conventions.md` (structured conventions with confidence and evidence)
- **What are the key dependencies?** → `dependency-map.md` (graph nodes, edges, import evidence)
- **What should I load first?** → `ai-context.md` (PKM summary, key modules, key conventions, limitations)
- **How do I change things safely?** → `implementation-guide.md`

Each file is written so that an agent loading it gains enough context to make correct decisions without reading the source code first. Templates and renderers never perform repository analysis of their own — the PKM remains the source of truth, and documents state honestly when a PKM section has not been populated yet. Documents without a registered template use a generic deterministic fallback until they get one; richer AI analysis is layered into the PKM later and flows through the same templates.

### Agent export files

Agent exporters (`src/exporters/`) translate the same PKM into portable context files for specific agent runtimes. They are generators — not analyzers — and follow the same rules as Markdown renderers:

- Consume `ProjectKnowledge` only; never scan the repository or call OpenRouter.
- Write derived outputs under the configured docs folder or agent-specific paths (for example `.cursor/rules/` for Cursor).
- Respect the generated-file marker; skip user-managed files without it.

Enable exports with `--export-agents`. Choose a target with `--target`:

| Target | Output |
|---|---|
| `generic` (default) | `.ai-docs/agent-pack/AGENTS.generated.md` |
| `cursor` | `.cursor/rules/ai-project-docs.mdc` |
| `all` | Both generic pack and Cursor rule |

The **generic exporter** writes a portable agent pack with a project summary, reading order, task navigation from `navigationMap`, key modules, conventions, dependency graph summary, and agent safety rules.

The **Cursor exporter** writes an always-on Cursor rule (`.mdc`) with the same PKM-derived facts formatted for Cursor: project summary, mandatory reading order, architecture boundaries, module map, convention summary, navigation map by task type, dependency graph summary, safety rules, and an explicit instruction that the PKM in `.ai-docs/knowledge/` is the source of truth.

Cursor rules are derived from the PKM — they do not re-analyze the repository. Agent-specific files must never become the source of truth; regenerate them when PKM sections change. Future Claude Code, Codex, and Copilot exporters will follow the same contract.

Export results are stored in `analysis.agentExports` and persisted to `agent-exports.json`. Exported files are safe to regenerate whenever the underlying PKM sections change.

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

`folderContexts` lives in `knowledge.analysis.folderContexts` and is persisted to `analysis.json` and `folders.json`. `folder-structure.md` renders from this data via the `markdown.folder-structure` template and `folder-structure-renderer.ts` — it does not re-derive structure from the tree.

### 7. Module discovery gives agents an architectural map

Folder knowledge answers "what is this directory?" Module knowledge answers "what are the meaningful units of this project?" Deterministic heuristics detect modules from common structural patterns — `apps/*`, `packages/*`, `src/features/*`, `src/knowledge`, and similar paths — without reading file contents or calling AI.

Each `ModuleKnowledge` entry includes a module type (`application`, `library`, `feature`, `core`, …), a responsibility sentence, related folders, and confidence. Agents use module knowledge to choose an entry point before diving into folder-level detail.

`modules` lives in `knowledge.analysis.modules` and is persisted to `analysis.json` and `modules.json`. Deterministic structural discovery runs on every pipeline run; AI architecture analysis and framework-specific analyzers (Angular, NestJS, Nx) can enrich the same PKM section later without replacing the baseline.

### 8. Dependency graph helps agents understand impact

Module knowledge tells agents *where* to start. The dependency graph tells agents *what depends on what*. The MVP analyzer detects `imports` edges between discovered modules by parsing relative TypeScript and JavaScript import statements — no AST, no OpenRouter, no full re-scan.

Each edge includes evidence (`sourceFile`, `importPath`) and confidence (`high`, `medium`, `low`). Before changing `src/domain`, an agent can read the graph to see that `src/core`, `src/docs`, and `src/knowledge` import from it — reducing the risk of breaking downstream modules.

`dependencyGraph` lives in `knowledge.analysis.dependencyGraph` and is persisted to `analysis.json` and `dependencies.json`. Regex-based parsing is intentionally lightweight and deterministic; it misses dynamic imports, path aliases, and non-JS/TS imports. Future AST-based analyzers can extend or replace `src/analyzers/import-parser.ts` while writing to the same PKM section.

### 9. Convention knowledge stops agents from breaking project patterns

Every project has patterns an agent must not break: strict TypeScript, co-located `*.test.ts` files, a pure `src/domain`, npm as the package manager, generated docs under `.ai-docs/`. When these patterns are implicit, agents rediscover them per task — or miss them and produce code that compiles but violates the project's own rules.

The convention analyzer makes patterns explicit as `ConventionKnowledge` entries. Each one is **structured** — `category`, `name`, `description`, `evidence`, `confidence` — rather than a plain string, so an agent can:

- load only the categories relevant to its task (e.g. `testing` conventions before writing tests),
- weigh `high`-confidence conventions as hard constraints and `low`-confidence ones as hints,
- verify any convention from its evidence (`{ "type": "config", "source": "tsconfig.json", "detail": "compilerOptions.strict is enabled" }`) instead of trusting an unexplained assertion.

Detection is fully deterministic and runs **before** any AI analysis: the same repository always yields the same convention baseline, at zero token cost, with no model variance. The future AI stage adds interpretation on top of this baseline instead of inventing conventions from scratch — evidence-backed deterministic facts anchor the AI's output.

`conventions` lives in `knowledge.analysis.conventions` and is persisted to `analysis.json` and `conventions.json`. `conventions.md` renders from this PKM section via the `markdown.conventions` template and `conventions-renderer.ts` — grouping by category and surfacing evidence — it does not re-derive conventions from the repository.

### 10. The navigation map tells agents what to read, per task

Folder knowledge, modules, the dependency graph, and conventions describe the project. The **AI Navigation Map** turns that description into action: for each common task type (`architecture-change`, `new-feature`, `bug-fix`, `test-change`, `documentation-change`, `config-change`, `dependency-change`, `ai-agent-integration`) it lists which PKM sections to load, which Markdown documents to read, which modules and folders are involved, and which guardrails to respect.

This is the bridge between raw PKM data and practical agent usage. An agent about to fix a bug does not need the full documentation plan or every folder context — it needs `modules`, `dependencyGraph`, and `conventions`, plus the warning to fix root causes rather than patching generated output. The map encodes those decisions once, deterministically, instead of leaving each agent to guess.

Three properties make the map trustworthy:

- **It never invents paths.** `relatedModules` and `relatedFolders` are resolved against actual `analysis.modules` and `analysis.folderContexts` entries; when nothing matches they are empty arrays.
- **Confidence is verification-based.** An entry is `high` confidence only when every recommended knowledge section is populated and every recommended document is in the documentation plan.
- **It is deterministic in the MVP.** No AI, no filesystem access — the same PKM always produces the same map, at zero token cost.

`navigationMap` lives in `knowledge.analysis.navigationMap` and is persisted to `analysis.json` and `navigation-map.json`. Agent exporters and future output formats must consume this PKM section rather than embedding their own reading lists, so that every output format gives agents the same navigation guidance.

### 11. Agent exporters derive context without re-analysis

Markdown documents answer "what should an agent know about this project?" Agent exporters answer "how should this project's context be packaged for a specific agent runtime?" Both are **derived outputs** from the same PKM.

The generic exporter (`--export-agents --target generic`) produces a portable agent pack under `.ai-docs/agent-pack/`. The Cursor exporter (`--export-agents --target cursor`) produces `.cursor/rules/ai-project-docs.mdc`. Use `--target all` to run both. Claude Code, Codex, and Copilot exporters will follow the same contract: consume PKM, write formatted files, never analyze the repository. Export results live in `analysis.agentExports` and `agent-exports.json`.

Agent-specific files are presentation layers. They must never replace the PKM as the source of truth — when outputs disagree, trust `.ai-docs/knowledge/project-knowledge.json`.

### 12. Documentation must be kept current

Stale documentation is worse than no documentation. It misleads agents into making decisions based on outdated information. The tool persists a PKM snapshot on every run. **Detect Changes** (step 15) compares the current PKM against the previous snapshot, recording `analysis.changeSummary` and `change-summary.json`. **Write Documentation** (step 16) then regenerates only impacted generated Markdown based on `analysis.documentImpact` — not every file on every run. User-created docs without the generated marker remain protected. This is not file watching or background sync.

### 13. Safe ownership matters

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

When `--ai` runs successfully, `analysis.aiInsights` is persisted in the PKM and surfaced by PKM-powered Markdown renderers (`architecture.md`, `ai-context.md`, `implementation-guide.md`, `agent-navigation.md`). Renderers append a clearly labeled **AI Insights** section after deterministic content. They consume already-persisted PKM data only — they never call AI providers or re-analyze the repository. Deterministic PKM sections remain authoritative; AI output is optional enrichment.

---

## Provider-based AI layer

The AI stage runs through a **provider architecture** (`src/ai/providers/`): the analysis service depends on the `AIProvider` contract, and concrete backends are resolved by id at runtime. OpenRouter is the built-in default (`--ai-provider openrouter`); OpenAI, Anthropic, Gemini, Azure OpenAI, Ollama, and local models can be added by registering new providers without changing the analysis service.

This design exists to protect the context-engineering guarantees regardless of backend:

- **Providers consume PKM summaries only.** The prompt builder (`src/ai/prompt-builder.ts`) owns every string sent to any provider — a compact, truncation-annotated PKM summary with no source code, no secrets, and no absolute paths. A provider cannot widen its own input: it receives a finished prompt string and returns raw output.
- **Deterministic PKM stays authoritative.** Whatever backend produces the insights, the response is parsed, validated, and length-capped before `analysis.aiInsights` is written — and invalid output simply warns and continues. Swapping providers can change the *quality* of enrichment, never the *authority* of deterministic sections.
- **Templates and exporters never call AI.** They read already-persisted PKM data. The provider layer is reachable only from pipeline step 14.

---

## Placeholder handlers and why they exist

Steps that haven't been implemented yet run a placeholder handler that returns immediately without doing real work. This is not a shortcut — it is a deliberate design decision:

1. **Visible flow.** The full pipeline output is observable from day one, before all I/O or AI logic is written.
2. **Safe iteration.** Future implementors know exactly where to plug in real behavior: replace the placeholder call for the relevant step in `executePipeline`.
3. **No silent gaps.** A step that hasn't been implemented yet still appears in the progress output and in `PipelineExecutionResult`. Nothing is hidden.

Placeholder handlers are replaced step by step as real implementations are added.

---

## How the pipeline supports incremental documentation

Generating documentation for a large repository is expensive. Doing it on every save is impractical without knowing what actually changed. The pipeline addresses this in two phases:

**Phase 1 (implemented): change detection.** Step 15 (Detect Changes) loads the previous PKM from `.ai-docs/knowledge/project-knowledge.json`, compares it to the current in-memory PKM, and records a deterministic `ChangeSummary` in `analysis.changeSummary` and `change-summary.json`. The CLI prints which sections changed (modules, dependency graph, technologies, etc.).

**Phase 2 (implemented): selective regeneration.** `document-impact-analyzer.ts` maps `changedSections` to affected Markdown documents and stores `analysis.documentImpact` (persisted to `document-impact.json`). Step 16 (Write Documentation) regenerates only impacted tool-managed files on incremental runs; initial runs regenerate every planned document. The generated-file marker policy protects user-managed files. Unchanged generated files are left on disk as-is — nothing is deleted.

**Why persisted PKM enables this.** Without a machine-readable baseline on disk, each run has no memory of the previous analysis. The PKM snapshot makes cross-run comparison deterministic, testable, and independent of git history or file watchers.

This model also makes the tool composable: a CI system can run it on every commit, inspect `change-summary.json`, and eventually update only the documentation sections affected by that commit's changes.

---

## Why plugins consume PKM instead of rescanning

The repository is scanned once at pipeline step 3. That tree is stored in `knowledge.repository.repositoryTree` and never re-walked during analysis.

Plugins follow the same rule as generators:

1. **Read PKM sections** — `repository`, `technologies`, and prior `analysis.*` contributions from earlier plugins in the execution order.
2. **Return contributions** — `PluginResult` with folder, module, convention, dependency, or navigation knowledge.
3. **Use bounded file access only** — `RepositoryBoundary` permits reads of whitelisted config files (`tsconfig.json`, `package.json`) and module-scoped import parsing. No arbitrary directory walks.

Rescanning would break three guarantees:

- **Consistency** — folder, module, and dependency analysis would see different ignore rules or depth limits.
- **Performance** — large repositories would be walked multiple times per run.
- **Safety** — `RepositoryBoundary` enforcement would need to be duplicated in every plugin.

The core owns scanning. Plugins own interpretation. Generators own presentation. See [`docs/plugins.md`](plugins.md) for the full plugin contract.

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
