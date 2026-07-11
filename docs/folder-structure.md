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

### `src/ui/`

Local Web UI entry point — a `node:http` server bound to `127.0.0.1` plus static HTML/CSS/JS. Alternative to the CLI for interactive runs; does not replace `src/cli.ts`.

Contains:
- `index.ts` — process entry; resolves port (`AI_PROJECT_DOCS_UI_PORT` / `--port`, default `3847`) and starts the server
- `server.ts` — static file serving + API routing
- `config-mapper.ts` — HTTP JSON body → `buildRuntimeConfig()` (no argv parsing)
- `progress-bridge.ts` — reserved for SSE progress (later)
- `routes/providers.ts` — `GET /api/providers`
- `routes/run.ts` — `POST /api/run` via `executePipeline` + `buildRunSummaryData` (never `run()`)
- `public/` — form UI (`index.html`, `styles.css`, `app.js`), copied to `dist/ui/public/` on build

**When to modify:** When adding UI routes, changing the local server contract, or extending the browser form. Pipeline behavior changes belong in `src/core/` and related modules — not here.

**Status:** ✅ MVP — localhost server, providers + run APIs, browser form.

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

**Status:** ✅ Orchestration skeleton done. Steps 1–4, 7–14, and 16 use real handlers. Steps 5, 6, and 15 run as placeholders.

---

### `src/config/`

Everything related to resolving runtime configuration. The only module that reads `process.argv` and `process.env`.

Produces: `RuntimeConfig { targetProjectPath, docsDir, openRouterApiKey? }`

Exports: `RuntimeConfig`, `resolveConfig()`, `printHelp()`, `isHelpRequested()`.

**When to modify:** When a new configuration option is added, a new environment variable is supported, or validation rules change.

**Status:** ✅ Done.

---

### `src/scanner/`

Everything related to reading the target repository from disk. Produces `RepositoryInfo` and `RepositoryNode` tree as defined in `src/domain/`.

Does not interpret what it finds — that is `src/detectors/` and `src/ai/`'s job.

Contains:
- `repository-loader.ts` — `loadRepositoryMetadata(config)` reads top-level directory entries and returns `RepositoryInfo`.
- `repository-boundary.ts` — safe path resolution within the target repository root.
- `ignore-rules.ts` — default ignored paths, `.gitignore` loading, entry filtering.
- `scanner-options.ts` — `ScannerOptions` with depth, file count, and hidden-file limits.
- `repository-scanner.ts` — `scanRepository(repositoryInfo)` walks the tree and returns a `RepositoryNode`.

**When to modify:** When the set of things we read from the target repository changes (new key files, deeper scanning, ignore-rule support).

**Status:** ✅ Done — top-level metadata loader and full recursive tree scan with ignore rules and safety limits.

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

### `src/analyzers/`

Deterministic repository analyzers that enrich the Project Knowledge Model without re-scanning the filesystem or calling OpenRouter.

Contains:
- `folder-classifier.ts` — maps folder names and file signals to `FolderClassification`
- `folder-analyzer.ts` — walks `knowledge.repository.repositoryTree` and produces `FolderKnowledge[]`
- `module-constants.ts` — module path patterns, responsibilities, and structural helpers
- `module-classifier.ts` — maps structural paths to `ModuleType` using deterministic heuristics
- `module-analyzer.ts` — discovers `ModuleKnowledge[]` from folder knowledge
- `import-parser.ts` — lightweight regex-based TypeScript/JavaScript import extraction
- `dependency-graph-analyzer.ts` — builds `DependencyGraphKnowledge` from module imports
- `convention-classifier.ts` — pure deterministic convention detection rules per category
- `convention-analyzer.ts` — builds `ConventionKnowledge[]` from the PKM plus safe reads of `tsconfig.json`/`package.json`
- `navigation-map-builder.ts` — per-task-type navigation rules and related module/folder resolution
- `navigation-map-analyzer.ts` — builds `NavigationMapKnowledge` from the PKM
- `index.ts` — public exports

**Integration rule:** Analyzers consume `ProjectKnowledge` and write results into PKM sections (e.g. `knowledge.analysis.folderContexts`, `knowledge.analysis.modules`, `knowledge.analysis.dependencyGraph`, `knowledge.analysis.conventions`, `knowledge.analysis.navigationMap`). They must not re-scan the repository, call OpenRouter, or write Markdown. Selective safe reads of well-known root config files through `RepositoryBoundary` are the only permitted file access.

**When to modify:** When adding a new deterministic analyzer (framework-specific module detection, AST-based import parsing) or extending classification/convention/navigation rules.

**Status:** ✅ Folder knowledge analyzer (step 9), module discovery analyzer (step 10), dependency graph analyzer (step 11), convention analyzer (step 12), and AI navigation map (step 13) implemented. Pipeline steps 9–13 execute these through built-in plugins in `src/plugins/builtin/`.

---

### `src/plugins/`

Plugin contracts, registry, manager, and built-in/technology plugin implementations. The pipeline invokes analyzer plugins through `PluginManager` instead of calling `src/analyzers/` directly.

Contains:
- `plugin-contract.ts`, `analyzer-plugin.ts`, `technology-plugin.ts` — plugin interfaces
- `plugin-context.ts` — safe runtime surface (`ProjectKnowledge`, `RuntimeConfig`, `RepositoryBoundary`, `PluginLogger`)
- `plugin-result.ts`, `plugin-merger.ts` — contribution types and PKM merge logic
- `plugin-registry.ts`, `plugin-manager.ts` — static registration and execution
- `pipeline-integration.ts` — bridge used by `pipeline-handlers.ts`
- `builtin/` — built-in analyzer plugins wrapping `src/analyzers/`
- `technology/` — placeholder technology plugins (Angular, React, NestJS, Node.js)

**Integration rule:** Plugins consume `ProjectKnowledge` through `PluginContext` and return `PluginResult`. They must not access pipeline internals, rescan the repository, or write output files. Framework-specific logic belongs in technology plugins — not in the core.

**When to modify:** When adding a new analyzer or technology plugin, extending plugin contracts, or enabling future dynamic plugin loading.

**Status:** ✅ Plugin infrastructure, built-in analyzer plugins, and technology placeholders implemented. Dynamic loading not yet implemented.

See also: [`docs/plugins.md`](plugins.md).

---

### `src/knowledge/`

The Project Knowledge Model (PKM). Defines `ProjectKnowledge` and the pure mapping logic that assembles it from pipeline outputs.

Contains:
- `project-knowledge.ts` — PKM types
- `knowledge-builder.ts` — `buildProjectKnowledge()` pure mapping
- `knowledge-paths.ts` — safe path resolution for `.ai-docs/knowledge/`
- `knowledge-writer.ts` — `persistProjectKnowledge()` writes JSON snapshots
- `accessors.ts` — read helpers for generators
- `index.ts` — public exports

**Integration rule:** Generators consume `ProjectKnowledge`. Persistence belongs here — not in `src/docs/` or `src/scanner/`.

**When to modify:** When a new knowledge section is added, when persistence format changes, or when schema version changes.

**Status:** ✅ Done — types, builder, persistence, pipeline integration.

---

### `src/templates/`

Lightweight template engine for generated documentation. Separates PKM data, document renderers, Markdown templates, and file writing.

Contains:
- `template-context.ts` — `TemplateContext`, `TemplateDefinition`, `TemplateRenderResult` contracts.
- `template-registry.ts` — lookup for registered templates by output path.
- `markdown-template.ts` — built-in Markdown template definitions wrapping PKM renderers.
- `template-engine.ts` — `buildTemplateContext()`, `renderDocumentWithTemplate()`, `renderDocumentationPlan()`.
- `template-engine.test.ts` — registry and rendering tests.

Templates consume **PKM only**. They are presentation-only, deterministic, and never write files — `src/docs/documentation-writer.ts` owns disk output. User-custom templates are not supported yet; the registry is built-in only for v1.

**When to modify:** When adding a new key document template, registering a new built-in template, or extending the template contract.

**Status:** ✅ Done — template engine, registry, eight key Markdown templates (including `ai-readiness.md`), generic fallback, documentation writer integration.

---

### `src/readiness/`

Deterministic **AI Readiness Score** — a versioned 0–100 Context Engineering assessment computed from the PKM and the validation result only.

Contains:
- `ai-readiness-model.ts` — pure types (`AIReadinessKnowledge`, categories, findings, gaps, recommendations), level boundaries, clamp/round helpers. Leaf module safely referenced by `src/knowledge`.
- `ai-readiness-rules.ts` — versioned scoring rules: repository signals, six weighted categories (weights total 100%), finding builders, grounded recommendation actions.
- `ai-readiness-calculator.ts` — category and overall score calculation, strengths/gaps/recommendations derivation, `analysis.aiReadiness` enrichment.
- `ai-readiness-renderer.ts` — presentation only: the `ai-readiness.md` template and the pipeline console report.

Never rescans the repository, never calls AI providers, never mutates source code, never writes files itself (the documentation writer and knowledge writer own disk output). Deterministic: identical PKM input produces identical output.

**When to modify:** When adding or tuning readiness findings, weights, or thresholds (bump `AI_READINESS_SCORING_VERSION`), or extending the readiness report.

**Status:** ✅ Done — model, versioned rules, calculator, renderer, pipeline step, persistence, validation, tests.

---

### `src/docs/`

Documentation planning, PKM-powered Markdown rendering, and writing. Decides which files to generate, renders their content through the template engine from `ProjectKnowledge`, and writes them into the target repository's `.ai-docs/` folder.

Contains:
- `documentation-plan.ts` — application-level types: `DocumentationPlan`, `PlannedDocument`, `DocumentPriority`, `DocumentSource`.
- `documentation-planner.ts` — `createDocumentationPlan(docsDir, technologyProfile)` returns a deterministic `DocumentationPlan` based on the detected technology stack.
- `document-template.ts` — generic fallback Markdown template for documents without a registered template.
- `markdown-renderers/` — one small deterministic renderer per key document (including playbook routing docs, module-plan, and per-module cards) plus shared helpers (`render-helpers.ts`).
- `documentation-write-order.ts` — stage-aware sort (`baseline` → `routing` → `architecture` → `module-plan` → `module` → `readiness`) using `PlannedDocument` metadata.
- `documentation-writer.ts` — `writeDocumentation(knowledge)` renders via `src/templates/template-engine.ts`, writes planned docs in stage order into the target project's docs directory.
- `markdown-renderers.test.ts` — renderer dispatch and content tests (delegates to template engine).

The plan includes core docs (always), agent docs (always), and technology-specific docs (Angular, React, or NestJS suites; fallback `technology-overview.md` when none match). Renderers behind templates are **presentation-only**: they translate PKM data into Markdown and never analyze the repository. The generated-file marker distinguishes tool-managed files from user-managed files.

**When to modify:** When new document types are added, new framework document sets are supported, or a document gets its own PKM-powered template.

**Status:** Planning implemented (step 7). Template engine and PKM-powered Markdown writing implemented (step 16). PKM JSON persistence is in `src/knowledge/` (step 19), not here.

---

### `src/ai/`

Everything related to the AI provider (OpenRouter). Consumes `ProjectContext`, produces `AnalysisResult` as defined in `src/domain/`.

Contains no file I/O.

**When to modify:** When the AI provider, model, prompt strategy, or response format changes.

**Status:** ✅ Optional OpenRouter enrichment when `--ai` is set.

---

### `src/exporters/`

Agent-specific context exporters. Consumes `ProjectKnowledge`, writes derived agent context files under the docs folder or agent-specific paths (for example `.cursor/rules/`).

Contains:
- `exporter-contract.ts` — `AgentExporter` interface and export types
- `exporter-constants.ts` — default targets and output paths
- `export-target-resolver.ts` — CLI target parsing and validation
- `exporter-registry.ts` — registry and target resolution helpers
- `export-file-writer.ts` — shared write policy (generated-file marker)
- `generic-agent-pack-renderer.ts` — pure PKM → Markdown rendering
- `generic-agent-exporter.ts` — generic agent pack for `--export-agents --target generic`
- `cursor-rules-renderer.ts` — pure PKM → Cursor `.mdc` rule rendering
- `cursor-exporter.ts` — Cursor rules for `--export-agents --target cursor`
- `agent-export-service.ts` — orchestrates exporters and enriches `analysis.agentExports`

Does not scan the repository, detect technologies, or call OpenRouter. Respects the generated-file marker policy.

**When to modify:** When adding a new agent target (Claude Code, Codex, Copilot) or extending export formats.

**Status:** ✅ Generic and Cursor exporters done. Other targets planned.

---

### `src/incremental/`

Incremental state loading and deterministic change detection between pipeline runs.

Contains:
- `state-loader.ts` — safe read of previous `project-knowledge.json`
- `change-detector.ts` — compares previous vs current PKM sections
- `change-summary.ts` — re-exports `ChangeSummaryKnowledge` types from the PKM
- `index.ts` — enrichment helper and CLI output formatter

Implements pipeline step **Detect Changes** and **document impact analysis**. Does not write files (persistence is in `src/knowledge/knowledge-writer.ts`). Selective Markdown regeneration is performed by `src/docs/documentation-writer.ts` using `analysis.documentImpact`.

**When to modify:** When change detection rules expand, new PKM sections need diff support, or document impact mappings change.

**Status:** ✅ Change detection done. Selective regeneration planned.

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

- **Generated output.** The `.ai-docs/` folder is written into the *target* repository, not this one. Tool-managed files are identified by a marker comment so user-created files can be preserved safely.
- **Build artifacts.** `dist/` is in `.gitignore`.
- **Temporary files.** Use the OS temp directory; never committed.
- **Scanner logic in `src/core/`.** Directory walks, `fs` reads, and file pattern matching belong in `src/scanner/`, not in the orchestrator.
- **Detection logic in `src/scanner/`.** Interpreting what files mean (TypeScript, Docker, React) belongs in `src/detectors/`.
- **Documentation planning in `src/core/`.** Deciding which files to generate belongs in `src/docs/documentation-planner.ts`, not in the orchestrator.
