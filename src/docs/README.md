# src/docs

**Responsibility:** Documentation planning, rendering, and writing — deciding which files to generate, rendering their Markdown from the Project Knowledge Model (PKM), and writing them into the target repository's `.ai-docs/` folder.

This module is split into three concerns that must stay separate:

1. **Planning** — deciding which documents to generate and what their purpose is.
2. **Rendering** — translating PKM data into Markdown, one small deterministic renderer per key document.
3. **Writing** — writing files to disk safely, without overwriting user-managed files.

---

## Files

| File | Role |
|---|---|
| `documentation-plan.ts` | Application-level types: `DocumentationPlan`, `PlannedDocument` |
| `documentation-planner.ts` | `createDocumentationPlan()` — deterministic plan from config + metadata |
| `document-template.ts` | `renderDeterministicDocument()` — generic fallback Markdown template with the generated-file marker |
| `markdown-renderers/` | PKM-powered renderers for key documents (see below) |
| `documentation-writer.ts` | `writeDocumentation()` — writes planned docs from `ProjectKnowledge`, preserves unmarked files, reports written/skipped and PKM-powered/generic counts |
| `markdown-renderers.test.ts` | Renderer dispatch and content tests |

---

## Markdown renderers

`markdown-renderers/` contains one renderer per key document plus the dispatch registry:

| File | Renders | Reads from PKM |
|---|---|---|
| `architecture-renderer.ts` | `architecture.md` | `technologies`, `analysis.modules`, `analysis.conventions`, `analysis.dependencyGraph`, `analysis.navigationMap` |
| `folder-structure-renderer.ts` | `folder-structure.md` | `analysis.folderContexts`, `repository.ignoredPaths` |
| `dependency-map-renderer.ts` | `dependency-map.md` | `analysis.dependencyGraph` (nodes, edges, evidence) |
| `conventions-renderer.ts` | `conventions.md` | `analysis.conventions` (category, description, confidence, evidence) |
| `agent-navigation-renderer.ts` | `agent-navigation.md` | `analysis.navigationMap` (task types, recommendations, warnings) |
| `ai-context-renderer.ts` | `ai-context.md` | Summary across all PKM sections |
| `implementation-guide-renderer.ts` | `implementation-guide.md` | `analysis.modules`, `analysis.navigationMap`, `metadata` |
| `render-helpers.ts` | — | Shared header/formatting helpers and the `MarkdownRenderer` type |
| `index.ts` | — | Registry + `renderPlannedDocument()` dispatch (PKM renderer or generic fallback) |

**Renderer rules:**

- Renderers are responsible for **presentation only**. They translate PKM facts into Markdown — they do not analyze the repository, read the filesystem, parse config files, or call AI.
- Renderers must be **small and deterministic**: the same PKM always produces the same Markdown.
- When a PKM section a renderer needs is missing (analysis has not run), the renderer degrades gracefully with an honest "not available yet" note — it never invents content.
- Every rendered document starts with the generated-file marker so the writer's ownership policy keeps working.
- Documents without a dedicated renderer (e.g. `README.md`, `change-log.md`, `AGENTS.md`, technology docs) fall back to the generic template in `document-template.ts`.

**Adding a renderer for a new document:**

1. Create `markdown-renderers/<name>-renderer.ts` exporting a `MarkdownRenderer` function.
2. Read only from `ProjectKnowledge`; use the helpers in `render-helpers.ts` for the header and formatting.
3. Register it in the `PKM_RENDERERS` map in `markdown-renderers/index.ts`.
4. Add content assertions to `markdown-renderers.test.ts`.

---

## PKM integration

The documentation writer is a **generator**. It consumes only `ProjectKnowledge` — no `RuntimeConfig`, `RepositoryInfo`, `TechnologyProfile`, or `DocumentationPlan`.

- `writeDocumentation(knowledge)` resolves paths from `knowledge.repository.rootPath` and `knowledge.documentation.plan.docsDir`.
- `renderPlannedDocument(document, knowledge)` dispatches to the PKM renderer for that document, or to the generic template when none exists.
- Markdown is an **output derived from the PKM**. The PKM (persisted to `.ai-docs/knowledge/`) remains the source of truth; Markdown generation must never perform repository analysis of its own.

When adding new rendering logic, read from the appropriate PKM section.

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

The writer stays deterministic as well. Key documents render real PKM data (folders, modules, dependency graph, conventions, navigation map) through the renderers in `markdown-renderers/`; remaining documents use the generic metadata template until they get their own renderer. No AI calls happen during writing.

---

## Application-level types

### `PlannedDocument`

```typescript
interface PlannedDocument {
  title: string;
  relativePath: string;    // path inside docsDir, e.g. 'architecture.md'
  purpose: string;         // one-sentence description for agents
  priority: 'required' | 'recommended' | 'optional';
  source: 'core' | 'technology' | 'agent';
  dependsOn?: string[];    // relativePaths this document depends on
}
```

**`source` values:**
- `core` — always generated; describes the project structure and architecture
- `agent` — always generated; optimized for AI agent consumption
- `technology` — generated only when the relevant technology is detected

**`priority` values:**
- `required` — always generated in every run
- `recommended` — generated by default but skippable
- `optional` — generated only when explicitly requested

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

This policy preserves hand-written documentation while still allowing safe incremental regeneration of files the tool owns.

## Why deterministic docs come before AI-generated docs

Deterministic docs are the safest first implementation of the writing stage:

- They prove the docs directory, path resolution, and overwrite rules work correctly.
- They give agents a stable baseline context layer immediately.
- They avoid pretending that AI analysis exists before that stage is ready — PKM-powered documents state their deterministic origin and current limitations explicitly.
- They make future enrichment obvious: the AI stage will enrich PKM sections, and the same renderers will automatically surface the richer data without changing ownership semantics.

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

- `DocumentationPlan` and `PlannedDocument` types.
- `createDocumentationPlan(docsDir, technologyProfile)` — receives docs directory name and detected technologies, returns a plan deterministically.
- PKM-powered Markdown renderers (`markdown-renderers/`) — presentation only.
- Deterministic Markdown rendering for planned documents.
- Safe overwrite rules for generated files only.
- Future: per-technology document template functions, incremental update logic.

## What does NOT belong here

- Technology detection — that belongs in `src/detectors/`.
- Repository scanning — that belongs in `src/scanner/`.
- Repository analysis of any kind — analyzers in `src/analyzers/` enrich the PKM; renderers only present it.
- AI calls — that belongs in `src/ai/`.
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
| PKM-powered renderers for 7 key documents | ✅ Done |
| Generic fallback template for remaining documents | ✅ Done |
| Incremental update logic beyond marker checks | Planned |

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
