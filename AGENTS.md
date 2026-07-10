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
| Deterministic analyzer | `src/analyzers/` (logic) + `src/plugins/` (execution) | Enrich `ProjectKnowledge` via `AnalyzerPlugin`; return `PluginContributions` through `PluginResult` |
| Technology plugin | `src/plugins/technology/` | Framework-specific `supports()` and `analyze()`; consume PKM only |
| Any generator (docs, rules, skills…) | `src/knowledge/` | Consume `ProjectKnowledge` |

Upstream analysis stages may still emit their own types. The knowledge builder (`src/knowledge/knowledge-builder.ts`) maps them into the PKM. Do not bypass this step.

---

## Safety constraints

These rules protect target repositories and keep the pipeline predictable for external users.

| Layer | Constraint |
|---|---|
| **Analyzers** | Must not modify source code. They enrich `ProjectKnowledge` in memory only. Permitted file reads are limited to well-known config files (`tsconfig.json`, `package.json`) through `RepositoryBoundary`. |
| **Scanner** | Must respect `RepositoryBoundary` — never read or write outside the resolved target repository root. Produces read-only `RepositoryInfo` and `RepositoryNode` data; permission-denied paths are skipped, not force-read. |
| **Generators** | Must consume `ProjectKnowledge` only. Markdown renderers and agent exporters are presentation-only — no repository analysis, no filesystem access, no AI calls. |
| **Exporters** | Must consume `ProjectKnowledge` only. Agent exporters write derived context files under the docs folder or agent-specific paths (for example `.cursor/rules/`); they do not analyze repositories or call AI providers. |
| **Validators** | Must not mutate files. `documentation-validator.ts` reads outputs and reports issues; it never repairs or rewrites documentation. |
| **Pipeline** | Core behavior must flow through `ANALYSIS_PIPELINE` and `executePipeline`. Do not bypass the pipeline from `cli.ts`, generators, exporters, or analyzers for scan, detect, analyze, write, validate, export, or persist steps. |
| **Writable boundary** | Markdown and PKM JSON write to the configured docs folder (default `.ai-docs/`). Registered agent exporters may also write tool-managed files to declared export paths (for example `.cursor/rules/`). Use `resolvePathWithinRoot()` — never write outside the target repo. User-managed files without the generated marker are preserved. |
| **Source code** | Project source files are never modified. User-managed docs without the generated marker are preserved on re-run. |

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
- **Implementing a deterministic analyzer?** Read `src/analyzers/README.md` for analysis logic. Pipeline execution goes through `src/plugins/` — implement or wrap logic as an `AnalyzerPlugin`, register it in `PluginRegistry`, and wire it via `PluginManager`. Consume `ProjectKnowledge` through `PluginContext`; use `context.boundary` for safe config reads. Return `PluginContributions` in `PluginResult` — do not mutate PKM directly. Enrich `analysis.folderContexts`, `analysis.modules`, `analysis.dependencyGraph`, `analysis.conventions`, `analysis.navigationMap`, or future analysis sections. Do not scan the filesystem or call AI providers.
- **Creating a technology plugin?** Read `docs/plugins.md` and `src/plugins/README.md`. Implement `TechnologyPlugin` with accurate `supports()` detection. Return `PluginResult` contributions — do not mutate PKM directly. Register in `PluginRegistry`. Do not add framework logic to `src/core/` or `src/analyzers/` unless it is shared structural baseline.
- **Building or extending the PKM?** Read `src/knowledge/project-knowledge.ts` and `src/knowledge/knowledge-builder.ts`. Map new analysis outputs into `ProjectKnowledge` sections.
- **Implementing the AI integration?** Read `src/ai/README.md` and `src/ai/ai-analysis-service.ts`. Optional enrichment writes `knowledge.analysis.aiInsights` from a compact PKM summary — never from raw source files. The service depends on the `AIProvider` contract, not on any concrete backend.
- **Adding an AI provider (OpenAI, Anthropic, Gemini, Azure OpenAI, Ollama, local models)?** Read `src/ai/providers/README.md`. Implement `AIProvider` in `src/ai/providers/<name>-provider.ts` and register it in `createDefaultAiProviderRegistry()`. Providers are transports: they receive fully assembled prompt strings and return raw output — no prompt building, no PKM access, no filesystem access, no source mutation. Do not modify `ai-analysis-service.ts` to add a backend.
- **Implementing PKM persistence?** Read `src/knowledge/knowledge-paths.ts` and `src/knowledge/knowledge-writer.ts`. Use `resolvePathWithinRoot()` — never write outside the target repo.
- **Implementing a generator (docs writer, future formats)?** Read `src/knowledge/`. Consume `ProjectKnowledge` in memory or load from `.ai-docs/knowledge/project-knowledge.json`.
- **Implementing an agent exporter?** Read `src/exporters/README.md`. Consume `ProjectKnowledge` only; register in `exporter-registry.ts`. Exporters write derived agent context files (generic pack and Cursor rules today; Claude Code, Codex, and Copilot later). Preserve the generated-file marker policy.
- **Implementing deterministic document rendering or writing?** Read `src/templates/README.md`, `src/docs/documentation-plan.ts`, `src/docs/document-template.ts`, `src/docs/markdown-renderers/`, and `src/docs/documentation-writer.ts`. The template engine (`src/templates/`) renders Markdown from the PKM; renderers behind templates are presentation-only — no repository analysis, no filesystem access, no AI. The documentation writer writes rendered output to disk. Preserve the generated-file marker policy and do not overwrite unmarked files.
- **Implementing incremental change detection?** Read `src/incremental/README.md`. Load the previous PKM from `.ai-docs/knowledge/project-knowledge.json`, compare against the current in-memory PKM, store `analysis.changeSummary`, and derive `analysis.documentImpact` for selective Markdown regeneration. Do not add file watching or git integration in this layer.
- **Adding a PKM-powered template for a document?** Create `src/docs/markdown-renderers/<name>-renderer.ts` (reads only from `ProjectKnowledge`), register a `TemplateDefinition` in `src/templates/markdown-template.ts`, and add tests in `src/templates/template-engine.test.ts`. Documents without a registered template fall back to the generic template in `document-template.ts`. User-custom templates are not supported yet.
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
- `src/docs/` — documentation planning and writing (generators). `documentation-writer.ts` writes rendered template output from `ProjectKnowledge` only.
- `src/templates/` — lightweight template engine. Renders Markdown from the PKM; does not write files, scan repositories, or call AI.
- `src/ai/` — optional AI enrichment behind the `AIProvider` contract (`src/ai/providers/`). The analysis service builds a compact PKM summary prompt and calls the selected provider (OpenRouter by default). Providers are pure transports.
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
- All project documentation must be written in English.
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
- A pipeline orchestrator (`src/core/`) that runs all 19 steps and returns `PipelineExecutionResult`.
- Step 2 (Load Repository Metadata) implemented in `src/scanner/repository-loader.ts`.
- Step 3 (Scan Repository Structure) implemented in `src/scanner/repository-scanner.ts` — produces `RepositoryNode` tree with ignore rules and safety limits.
- Step 4 (Detect Technologies) implemented in `src/detectors/technology-detector.ts` and `src/detectors/package-manager-detector.ts`.
- Step 7 (Generate Documentation Plan) implemented in `src/docs/documentation-planner.ts` — produces a `DocumentationPlan` with core, agent, and technology-specific documents.
- Step 8 (Build Project Knowledge) implemented in `src/knowledge/knowledge-builder.ts` — assembles `ProjectKnowledge`.
- Step 9–13 (analyzer pipeline steps) execute built-in plugins via `PluginManager` in `src/plugins/` — each wraps the corresponding `src/analyzers/` enrich function and returns `PluginContributions` merged by `plugin-merger.ts`.
- Step 9 (Analyze Folder Knowledge) — `builtin.folder-analyzer` → `folder-analyzer.ts` → `FolderKnowledge[]` in `analysis.folderContexts`.
- Step 10 (Analyze Modules) — `builtin.module-analyzer` → `module-analyzer.ts` → `ModuleKnowledge[]` in `analysis.modules`.
- Step 11 (Analyze Dependency Graph) — `builtin.dependency-analyzer` → `dependency-graph-analyzer.ts` → `DependencyGraphKnowledge` in `analysis.dependencyGraph`.
- Step 12 (Analyze Conventions) — `builtin.convention-analyzer` → `convention-analyzer.ts` → `ConventionKnowledge[]` in `analysis.conventions`.
- Step 13 (Build AI Navigation Map) — `builtin.navigation-analyzer` → `navigation-map-analyzer.ts` → `NavigationMapKnowledge` in `analysis.navigationMap`.
- Technology placeholder plugins registered: `technology.angular` (detection), `technology.react`, `technology.nest`, `technology.node` (supports only).
- Step 14 (Analyze AI Insights) implemented in `src/ai/ai-analysis-service.ts` — optional AI enrichment of `analysis.aiInsights` when `--ai` is set and an API key is available. The service resolves an `AIProvider` from `src/ai/providers/` (default: `openrouter`, selectable with `--ai-provider`) and sends a compact PKM summary only; invalid responses warn and continue.
- Step 15 (Detect Changes) implemented in `src/incremental/` — compares the current PKM against the previously persisted snapshot, records `analysis.changeSummary`, and derives `analysis.documentImpact` for selective regeneration.
- Step 16 (Write Documentation) implemented in `src/docs/documentation-writer.ts` — renders planned documents through `src/templates/template-engine.ts`, then writes Markdown from `ProjectKnowledge`, regenerating only impacted tool-managed files when `documentImpact` is present (all planned docs on initial run).
- Step 17 (Validate Documentation) implemented in `src/docs/documentation-validator.ts` — verifies written docs exist, carry the generated-file marker, and reports errors/warnings.
- Step 18 (Export Agent Context) implemented in `src/exporters/` — optional agent export when `--export-agents` is set. Runs generic and/or Cursor exporters based on `--target` (default: `generic`) and stores results in `analysis.agentExports`.
- Step 19 (Persist Project Knowledge) implemented in `src/knowledge/knowledge-writer.ts` — writes JSON to `.ai-docs/knowledge/` including `change-summary.json`, `document-impact.json`, and `agent-exports.json` when exports ran.
- A final CLI run summary in `src/core/run-summary.ts` — printed by `run()` after the pipeline completes.

The scanner full tree walk (step 3) is implemented. Legacy pipeline steps 5–6 (`Build Repository Model`, `Analyze Architecture`) remain skipped placeholders. Optional AI enrichment runs at step 14 after deterministic analyzers.

### Plugin architecture rules

- **Single orchestrator:** Pipeline handlers must call analyzers through `PluginManager` (`pipeline-integration.ts`), never by importing `enrichProjectKnowledgeWith*` directly.
- **Minimal lifecycle:** `supports()` → `analyze()` / `contribute()` / `export()`. No `initialize()` or `dispose()` in v1.
- **Error isolation:** Plugin failures produce `failed` status and warnings; they never corrupt `ProjectKnowledge` or stop unrelated plugins.
- **Contributions over mutation:** Return `PluginContributions` and let `PluginManager` merge. The legacy `result.knowledge` field is accepted for backward compatibility only.
- **Boundary injection:** Use `context.boundary` from `PluginContext` for safe file reads. Do not create parallel `RepositoryBoundary` instances inside plugins when context already provides one.
- **Parallel systems:** Markdown (`src/docs/`) and agent export (`src/exporters/`) are not plugin-wired yet. `DocumentationPlugin` and `ExporterPlugin` contracts are reserved for future unification.

---

## Interpreting CLI output

CLI output has two parts: a **pipeline checklist** printed while steps run (`✓` completed, `○` skipped, `✗` failed), followed by the final **run summary**. Parse the run summary — the checklist is progress feedback only.

The summary headline is the run verdict: `AI Project Docs completed` (success), `completed with validation errors`, or `completed with errors`. Sections use `Section:` headers with `- Key: value` bullet lines.

| Summary section | Present | Meaning for agents |
|---|---|---|
| `Project` / `Target` / `Docs` | always | Which repository was analyzed, the resolved path, and where generated outputs live (default `.ai-docs/`). |
| `Duration` / `Pipeline` | always | How long the run took and how many steps completed / skipped / failed. `Analyze AI Insights` shows `○` unless `--ai` and an API key are provided. `Export Agent Context` shows `○` unless `--export-agents` is provided. |
| `Technologies` | always | Detected stack from deterministic detection — use to confirm language/framework context. |
| `Knowledge` counts | always | How much structural analysis was produced (repository tree, files scanned, folders, modules, dependency edges, conventions, navigation entries, persisted knowledge files). |
| `AI Analysis` | only with `--ai` | Which provider (`--ai-provider`, default `openrouter`) and model were used (model from PKM when insights were generated) and whether insights were generated (`yes`, `no`, or `no (see warnings)` when the AI run failed). Absent section = AI analysis was off. |
| `Agent exporters` | only with `--export-agents` | Which targets ran and how many export files were written or skipped. Absent section = exports were off. |
| `Change detection` | always on completed runs | `Initial run: yes (baseline created)` on the first run. On incremental runs: `Changed sections` plus counts for added/removed modules, folders, or dependency edges when those sections changed. |
| `Document impact` | incremental runs only | Counts of impacted vs unchanged documents from selective regeneration. Omitted on initial runs (everything is impacted by definition). |
| `Documentation` | always | `Planned` = documents in the plan. `Written` = tool-managed files created or updated. `Skipped unchanged` = generated files left intact because their PKM sections did not change. `Skipped protected` = user-managed files preserved (no overwrite). |
| `Validation` | always | `Status: passed` means no blocking documentation errors. Non-zero warnings/errors list details underneath — often preserved user files or empty sections. `Status: not run` means the pipeline failed before validation. |
| `Errors` | failed runs only | One line per failed pipeline step. Presence of this section means outputs are unreliable. |
| `Next steps` | successful runs only | Human and agent entry points: `README.md`, `agent-navigation.md`, and `project-knowledge.json`; on incremental runs also `change-summary.json` and `document-impact.json`. |

Change detection is PKM snapshot comparison — not file watching or background sync. On incremental runs, only impacted generated Markdown is rewritten; user-created docs without the marker are always preserved.

If the headline says `completed with errors` or `completed with validation errors`, treat outputs as unreliable until the `Errors` section is resolved. The CLI uses these exit codes:

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | User or configuration error |
| `2` | Documentation validation failed |
| `3` | Unexpected runtime / pipeline error |

Steps marked `○` in the pipeline progress (e.g. `Build Repository Model`, `Analyze Architecture`, `Analyze AI Insights` without `--ai`, or `Export Agent Context` without `--export-agents`) are skipped by design. They do not indicate a failed run.

**AI insights are enrichment, not authority.** Deterministic PKM sections remain the source of truth. When `analysis.aiInsights` is present, PKM-powered Markdown renderers append a labeled **AI Insights** section to `architecture.md`, `ai-context.md`, `implementation-guide.md`, and `agent-navigation.md`. Renderers consume already-persisted PKM only — they never call AI providers.

The authoritative machine-readable output is `.ai-docs/knowledge/project-knowledge.json`. Markdown files are derived presentations of the PKM.

---

## How to build and verify

```bash
npm install
npm run build          # compiles TypeScript to dist/ with zero errors
npm test               # runs unit tests
npm run smoke          # end-to-end smoke test against a temp fixture
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
- Do not add deterministic analysis logic to `src/scanner/` or `src/core/`. Analyzer logic belongs in `src/analyzers/`; pipeline execution goes through `src/plugins/`.
- Do not add framework-specific analysis to the core. Use technology plugins in `src/plugins/technology/`.
- Do not add technology detection logic to `src/scanner/`. Detection belongs in `src/detectors/`.
- Do not put real handler logic directly into `executePipeline`. Import and call handler functions from their respective modules.
- Do not write PKM JSON files from `src/docs/` — persistence belongs in `src/knowledge/knowledge-writer.ts`.
- Do not pass `RepositoryInfo`, `TechnologyProfile`, or `DocumentationPlan` directly to generators — use `ProjectKnowledge`.
- Do not perform repository analysis inside Markdown renderers — they present PKM data only. Facts come from analyzers; the PKM remains the source of truth; Markdown is a derived output.
- Do not add new document templates to `src/core/` or `src/detectors/`. Document template functions belong in `src/docs/documentation-planner.ts`.
- Do not overwrite user-created files inside `.ai-docs/`. Only files starting with `<!-- Generated by AI Project Docs. Safe to update. -->` may be updated by the writer.
