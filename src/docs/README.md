# src/docs

**Responsibility:** Documentation planning, rendering orchestration, and writing — deciding which files to generate, routing rendering through the template engine, and writing Markdown into the target repository's `.ai-docs/` folder.

This module is split into four concerns that must stay separate:

1. **Planning** — deciding which documents to generate and what their purpose is.
2. **Rendering** — translating PKM data into Markdown via renderers (implementation detail behind templates).
3. **Templating** — dispatching documents to registered templates (`src/templates/`).
4. **Writing** — writing files to disk safely, without overwriting user-managed files.

---

## Pipeline flow

```
DocumentationPlan + ProjectKnowledge
        ↓
   TemplateEngine (src/templates/)
        ↓
   Rendered documents (content only)
        ↓
   DocumentationWriter (this module)
        ↓
   .ai-docs/*.md
```

The PKM remains the source of truth. Templates and renderers are presentation-only. The writer handles path resolution, generated-file protection, and disk I/O.

---

## Files

| File | Role |
|---|---|
| `documentation-plan.ts` | Application-level types: `DocumentationPlan`, `PlannedDocument` |
| `documentation-planner.ts` | `createDocumentationPlan()` + `expandProjectKnowledgeWithModuleDocumentationPlan()` — baseline and post-module plan expansion |
| `document-template.ts` | `renderDeterministicDocument()` — generic fallback Markdown template with the generated-file marker |
| `markdown-renderers/` | PKM-powered renderers for key documents (wrapped by templates in `src/templates/`) |
| `documentation-writer.ts` | `writeDocumentation()` — stage-aware ordered writes via `documentation-write-order.ts`, renders via template engine, supports selective regeneration via `DocumentImpactSummary`, preserves unmarked files |
| `documentation-write-order.ts` | `orderDocumentsForWriting()` — explicit stage → order → path sort for staged documentation |
| `documentation-validator.ts` | `validateDocumentation()` — verifies written docs exist, carry the generated marker, reports errors/warnings, and checks staged playbook/module-plan coverage against PKM metadata |
| `staged-documentation.integration.test.ts` | End-to-end PKM-backed staged plan → ordered write → render/validate (no live AI) |
| `markdown-renderers.test.ts` | Renderer dispatch and content tests (delegates to template engine) |

---

## Markdown renderers

`markdown-renderers/` contains one renderer per key document. These are **implementation details** behind registered templates in `src/templates/markdown-template.ts`:

| File | Renders | Reads from PKM |
|---|---|---|
| `architecture-renderer.ts` | `architecture.md` | `technologies`, `analysis.modules`, `analysis.conventions`, `analysis.dependencyGraph`, `analysis.navigationMap`, `analysis.stagedDocumentation.architecture` |
| `folder-structure-renderer.ts` | `folder-structure.md` | `analysis.folderContexts`, `repository.ignoredPaths` |
| `dependency-map-renderer.ts` | `dependency-map.md` | `analysis.dependencyGraph` (nodes, edges, evidence) |
| `conventions-renderer.ts` | `conventions.md` | `analysis.conventions` (category, description, confidence, evidence) |
| `agent-navigation-renderer.ts` | `agent-navigation.md` | `analysis.navigationMap` (task types, recommendations, warnings) |
| `ai-context-renderer.ts` | `ai-context.md` | Summary across all PKM sections + staged architecture enrichment |
| `implementation-guide-renderer.ts` | `implementation-guide.md` | `analysis.modules`, `analysis.navigationMap`, `metadata` |
| `ai-start-here-renderer.ts` | `AI_START_HERE.md` | `technologies`, `analysis.modules`, architectural conventions |
| `context-router-renderer.ts` | `CONTEXT_ROUTER.md` | `analysis.navigationMap` |
| `documentation-maintenance-renderer.ts` | `DOCUMENTATION_MAINTENANCE.md` | `analysis.navigationMap` |
| `documentation-status-renderer.ts` | `DOCUMENTATION_STATUS.md` | `analysis.stagedDocumentation`, playbook plan entries |
| `project-map-renderer.ts` | `PROJECT_MAP.md` | `analysis.modules`, `analysis.folderContexts`, planned docs |
| `module-documentation-plan-renderer.ts` | `module-documentation-plan.md` | `analysis.stagedDocumentation.modulePlan` |
| `module-document-renderer.ts` | `code/components/*.md` | `analysis.modules` + `analysis.stagedDocumentation.moduleResults` |
| `staged-architecture-renderer.ts` | *(section)* | Prefers staged architecture output; falls back to legacy `aiInsights` |
| `render-helpers.ts` | — | Shared header/formatting helpers and the `MarkdownRenderer` type |
| `index.ts` | — | Backward-compatible dispatch via template engine |

**Renderer rules:**

- Renderers are responsible for **presentation only**. They translate PKM facts into Markdown — they do not analyze the repository, read the filesystem, parse config files, or call AI.
- Renderers must be **small and deterministic**: the same PKM always produces the same Markdown.
- When a PKM section a renderer needs is missing (analysis has not run), the renderer degrades gracefully with an honest "not available yet" note — it never invents content.
- Every rendered document starts with the generated-file marker so the writer's ownership policy keeps working.
- Documents without a registered template (e.g. `README.md`, `change-log.md`, `AGENTS.md`, technology docs) fall back to the generic template in `document-template.ts`.

**Adding a template for a new document:**

1. Create `markdown-renderers/<name>-renderer.ts` exporting a `MarkdownRenderer` function.
2. Read only from `ProjectKnowledge`; use the helpers in `render-helpers.ts` for the header and formatting.
3. Register a `TemplateDefinition` in `src/templates/markdown-template.ts`.
4. Add content assertions to `src/templates/template-engine.test.ts` and `markdown-renderers.test.ts`.

See `src/templates/README.md` for the full template contract.

---

## PKM integration

The documentation writer is a **generator**. It consumes only `ProjectKnowledge` — no `RuntimeConfig`, `RepositoryInfo`, `TechnologyProfile`, or `DocumentationPlan`.

- `writeDocumentation(knowledge, impactSummary?)` resolves paths from `knowledge.repository.rootPath` and `knowledge.documentation.plan.docsDir`.
- Documents are written in stage-aware order (`baseline` → `routing` → `architecture` → `module-plan` → `module` → `readiness`), using `PlannedDocument.stage` / `order` metadata — not path heuristics.
- When `impactSummary` is omitted, every tool-managed planned document is rewritten (legacy behavior).
- When `impactSummary` is present, only impacted generated documents are rewritten; unchanged generated files are skipped; missing files are still created.
- `renderDocumentWithTemplate(document, knowledge)` in `src/templates/template-engine.ts` dispatches by output path, then by `generatorKind` for dynamic module cards (`staged-module`), or to the generic fallback.
- Markdown is an **output derived from the PKM**. The PKM (persisted to `.ai-docs/knowledge/`) remains the source of truth; Markdown generation must never perform repository analysis of its own.

When adding new rendering logic, read from the appropriate PKM section and register a template.

---

Documentation generation is expensive: it requires AI calls, rendering, file I/O, and validation. Before spending any of that, the pipeline decides **what** to generate.

A `DocumentationPlan` answers:
- Which files will exist in `.ai-docs/` after this run?
- What is the purpose of each file?
- Which files are required vs. recommended?
- Which files are technology-specific?
- In what order should files be generated?

This decoupling provides several benefits:
- The plan can be inspected and logged before any writing happens.
- Future steps (Write Documentation, Validate Documentation) have an explicit manifest to work against.
- The plan is deterministic — given the same inputs, it always produces the same list of documents.
- AI agents reading the plan know what context files will exist before any are written.

The writer stays deterministic as well. Key documents render real PKM data (folders, modules, dependency graph, conventions, navigation map) through templates and renderers; remaining documents use the generic metadata template until they get their own template. No AI calls happen during writing.

---

## Application-level types

### `PlannedDocument`

```typescript
interface PlannedDocument {
  title: string;
  relativePath: string;    // path inside docsDir, e.g. 'architecture.md'
  purpose: string;         // one-sentence description for agents
  priority: 'required' | 'recommended' | 'optional';
  source: 'core' | 'technology' | 'agent' | 'playbook' | 'module';
  dependsOn?: string[];    // relativePaths this document depends on
  stage?: DocumentationStage;
  generatorKind?: DocumentGeneratorKind;
  moduleId?: string;
  moduleName?: string;
  order?: number;
}
```

**`source` values:**
- `core` — always generated; describes the project structure and architecture
- `agent` — always generated; optimized for AI agent consumption
- `technology` — generated only when the relevant technology is detected
- `playbook` — agent-routing / maintenance docs added during module-plan expansion
- `module` — one document per discovered module

**`stage` / `generatorKind`:** tell writers and later templates which staged phase owns the document (`baseline`, `routing`, `architecture`, `module-plan`, `module`, `readiness`) and how the body is produced (`deterministic`, `staged-architecture`, `staged-module-plan`, `staged-module`, `generic`).

**`priority` values:**
- `required` — always generated in every run
- `recommended` — generated by default but skippable
- `optional` — generated only when explicitly requested

Early pipeline planning uses `createDocumentationPlan()`. After modules are known, **Generate Module Documentation Plan** calls `expandProjectKnowledgeWithModuleDocumentationPlan()` to add playbook routing docs, `module-documentation-plan.md`, and one `code/components/<slug>.md` entry per module, mirroring entries into `analysis.stagedDocumentation.modulePlan`.

### `DocumentationPlan`

```typescript
interface DocumentationPlan {
  docsDir: string;            // target docs directory name, e.g. '.ai-docs'
  documents: PlannedDocument[];
  generatedAt: string;        // ISO 8601 timestamp
  strategy: string;           // e.g. 'standard', 'standard-angular', 'standard-react-nestjs'
}
```

The `strategy` field is a short identifier summarizing which technology-specific document set was activated. Useful for logging, caching, and incremental update decisions.

---

## How technology detection influences the plan

`createDocumentationPlan` receives a `TechnologyProfile`. The `frameworks` array drives the technology-specific documents:

| Detected framework | Technology documents added |
|---|---|
| Angular | `angular-architecture.md`, `angular-folder-context.md`, `angular-testing.md` |
| React | `react-architecture.md`, `react-folder-context.md`, `react-testing.md` |
| NestJS | `nestjs-architecture.md`, `nestjs-modules.md`, `nestjs-testing.md` |
| None of the above | `technology-overview.md` (fallback) |

Multiple frameworks can be detected simultaneously (e.g. a NestJS + React full-stack project), producing documents for both.

---

## How agents use the plan

An AI agent reading a completed `DocumentationPlan` knows:
- **What files will exist** — it can reason about the final `.ai-docs/` structure before any writing begins.
- **What each file is for** — the `purpose` field gives a one-sentence description usable as context.
- **What order to generate** — `dependsOn` expresses ordering constraints for the generation step.
- **Which are tech-specific** — `source: 'technology'` documents can be skipped if the relevant technology is later found to be absent.

## Generated-file safety policy

Every generated file starts with this marker:

```md
<!-- Generated by AI Project Docs. Safe to update. -->
```

The writer uses that marker to decide whether a file may be overwritten on future runs:

- If the file does not exist, it is created.
- If the file exists and starts with the marker, it is treated as tool-managed and may be updated.
- If the file exists and does not start with the marker, it is treated as user-managed and is skipped with a warning.

This policy preserves hand-written documentation while still allowing safe incremental regeneration of files the tool owns. Selective regeneration is driven by PKM section changes (`analysis.documentImpact`) — not file watching or git history.

## Why deterministic docs come before AI-generated docs

Deterministic docs are the safest first implementation of the writing stage:

- They prove the docs directory, path resolution, and overwrite rules work correctly.
- They give agents a stable baseline context layer immediately.
- They avoid pretending that AI analysis exists before that stage is ready — PKM-powered documents state their deterministic origin and current limitations explicitly.
- They make future enrichment obvious: the AI stage enriches `analysis.aiInsights` in the PKM, and the same templates automatically surface the richer data without changing ownership semantics.

## AI insights in Markdown templates

Optional AI analysis (pipeline step 14, `--ai`) writes `analysis.aiInsights` into the PKM. Renderers behind templates read that section at write time (step 16) and append a labeled **AI Insights** block when insights are present.

| Rule | Detail |
|---|---|
| Source of truth | Deterministic PKM sections rendered above the AI block |
| Renderer input | `ProjectKnowledge` only — including already-persisted `analysis.aiInsights` |
| No AI calls | Templates and renderers never invoke OpenRouter or perform repository analysis |
| Opt-in | Without `--ai`, or when insights are missing or empty after sanitization, no AI section is rendered |
| Documents | `architecture.md`, `ai-context.md`, `implementation-guide.md`, `agent-navigation.md` |

Shared formatting lives in `markdown-renderers/ai-insights-renderer.ts`.

---

## Where future document templates should be added

When support for a new framework or category is added:

1. Add a new function (e.g. `vueDocuments()`) returning `PlannedDocument[]` for that technology.
2. Call it from `buildTechnologyDocuments()` when the framework is detected in `TechnologyProfile.frameworks`.
3. Ensure the framework is detected by `src/detectors/technology-detector.ts`.
4. Update this README with the new entry in the framework table above.

Do not add framework-specific logic directly to `executePipeline`. The orchestrator calls `createDocumentationPlan` — the plan is the right place to encode which documents belong to which technology.

---

## What belongs here

- `DocumentationPlan` and `PlannedDocument` types (including staged metadata).
- `createDocumentationPlan(docsDir, technologyProfile)` — receives docs directory name and detected technologies, returns a baseline plan deterministically.
- `expandProjectKnowledgeWithModuleDocumentationPlan(knowledge)` — expands the plan after module discovery and mirrors module-plan state into PKM.
- PKM-powered Markdown renderers (`markdown-renderers/`) — presentation only, wrapped by templates.
- Safe overwrite rules for generated files only.
- Future: per-technology document template functions.

## What does NOT belong here

- Template registry and dispatch — that belongs in `src/templates/`.
- Technology detection — that belongs in `src/detectors/`.
- Repository scanning — that belongs in `src/scanner/`.
- Repository analysis of any kind — analyzers in `src/analyzers/` enrich the PKM; renderers only present it.
- AI calls — that belongs in `src/ai/`. Renderers only read `analysis.aiInsights` from the PKM; they never call OpenRouter.
- Domain types (`DocumentModel`, `DocumentSection`) — those stay in `src/domain/`.

---

## Current status

| Capability | Status |
|---|---|
| Core document plan (7 files) | ✅ Done |
| Agent document plan (3 files) | ✅ Done |
| Angular technology plan (3 files) | ✅ Done |
| React technology plan (3 files) | ✅ Done |
| NestJS technology plan (3 files) | ✅ Done |
| Fallback technology plan (1 file) | ✅ Done |
| Deterministic writing to disk | ✅ Done |
| Generated-file marker protection | ✅ Done |
| Template engine with 7 key Markdown templates | ✅ Done |
| Generic fallback template for remaining documents | ✅ Done |
| Incremental update logic beyond marker checks | ✅ Done (selective regeneration via `documentImpact`) |

## Expected output structure (planned)

```
<target-repo>/
└── .ai-docs/
    ├── README.md
    ├── architecture.md
    ├── folder-structure.md
    ├── agent-navigation.md
    ├── conventions.md
    ├── dependency-map.md
    ├── change-log.md
    ├── AGENTS.md
    ├── ai-context.md
    ├── implementation-guide.md
    └── <technology-specific>.md
```
