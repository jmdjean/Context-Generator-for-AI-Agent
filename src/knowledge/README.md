# src/knowledge

**Responsibility:** The Project Knowledge Model (PKM) — the single source of truth for everything the application knows about a target repository.

This module defines PKM types, the pure mapping logic that assembles them, and the persistence layer that writes machine-readable JSON to disk.

---

## Why this module exists

Pipeline stages such as the scanner, detectors, and documentation planner each produce their own typed output. Downstream generators (Markdown writer, future Cursor rules, skills, agent packs) should not read those outputs directly — they should consume one unified model.

The PKM is that model. It is analogous to an AST in a compiler: analysis stages populate it; generators read from it.

---

## Files

| File | Role |
|---|---|
| `constants.ts` | `PROJECT_KNOWLEDGE_SCHEMA_VERSION`, `GENERATOR_VERSION` |
| `project-knowledge.ts` | PKM types: `ProjectKnowledge` and its section interfaces |
| `knowledge-builder.ts` | Mapping functions and `buildProjectKnowledge()` — pure, no I/O |
| `knowledge-paths.ts` | Safe path resolution for `.ai-docs/knowledge/` inside the target repo |
| `knowledge-writer.ts` | `persistProjectKnowledge()` — writes full and split JSON files |
| `accessors.ts` | Read helpers for generators (`getProjectRoot`, `getDocsDir`, etc.) |
| `index.ts` | Public exports |

---

## `ProjectKnowledge` structure

```typescript
interface ProjectKnowledge {
  metadata: KnowledgeMetadata;
  repository: RepositoryKnowledge;
  technologies: TechnologyKnowledge;
  documentation: DocumentationKnowledge;
  analysis: AnalysisKnowledge;
}
```

`metadata` is the canonical source for `schemaVersion`, `generatedAt`, `generatorVersion`, `projectName`, and `docsDir`. Generators should use accessors from `accessors.ts` instead of reaching into nested sections directly.

| Section | Source today | Status |
|---|---|---|
| `metadata` | Built by knowledge builder | ✅ Done |
| `repository` | Mapped from `RepositoryInfo` (includes `repositoryTree`) | ✅ Done |
| `technologies` | Mapped from `TechnologyProfile` | ✅ Done |
| `documentation` | Contains `DocumentationPlan` | ✅ Done |
| `analysis` | Folder knowledge (`folderContexts`), module knowledge (`modules`), dependency graph (`dependencyGraph`), conventions (`conventions`), navigation map (`navigationMap`); AI fields pending | Architecture |

---

## Persisted knowledge (`.ai-docs/knowledge/`)

After pipeline step **Persist Project Knowledge**, the target repository contains:

```
.ai-docs/
└── knowledge/
    ├── project-knowledge.json   # full ProjectKnowledge snapshot
    ├── repository.json          # repository metadata only (tree excluded)
    ├── repository-tree.json     # repository tree only (when scan completed)
    ├── technologies.json        # technologies section + schemaVersion + generatedAt
    ├── documentation.json       # documentation section + schemaVersion + generatedAt
    ├── analysis.json            # analysis section including folderContexts, modules, dependencyGraph, conventions, and navigationMap
    ├── folders.json             # folder knowledge only (when analysis ran)
    ├── modules.json             # module knowledge only (when module analysis ran)
    ├── dependencies.json        # dependency graph only (when dependency graph analysis ran)
    ├── conventions.json         # convention knowledge only (when convention analysis ran)
    └── navigation-map.json      # AI navigation map only (when the navigation map was built)
```

### `FolderKnowledge`

Folder-level context for AI agents lives in `analysis.folderContexts` as `FolderKnowledge[]`:

| Field | Purpose |
|---|---|
| `classification` | Deterministic category (`source`, `test`, `config`, …) |
| `responsibility` | One-sentence folder purpose |
| `importantFiles` | Notable config/doc files directly in the folder |
| `childFolders` | Immediate subdirectory names |
| `signals` | Evidence used for classification |
| `confidence` | `high`, `medium`, or `low` |

Populated by `src/analyzers/folder-analyzer.ts` at pipeline step **Analyze Folder Knowledge**. Future `folder-structure.md` generation should render from this data.

### `ModuleKnowledge`

Architectural module context for AI agents lives in `analysis.modules` as `ModuleKnowledge[]`:

| Field | Purpose |
|---|---|
| `type` | Module category (`application`, `library`, `feature`, `core`, …) |
| `framework` | Optional framework hint from `knowledge.technologies` |
| `responsibility` | One-sentence module purpose |
| `importantFiles` | Notable files from folder knowledge |
| `relatedFolders` | Immediate child folders for navigation |
| `signals` | Evidence used for classification |
| `confidence` | `high`, `medium`, or `low` |

Populated by `src/analyzers/module-analyzer.ts` at pipeline step **Analyze Modules**. Module knowledge is selective (meaningful units only); folder knowledge is exhaustive (every documentable directory). Agents use modules to choose an entry point, then folder knowledge to navigate locally.

### `DependencyGraphKnowledge`

Import relationships between modules for AI agents live in `analysis.dependencyGraph`:

| Field | Purpose |
|---|---|
| `nodes` | One node per discovered module (`id`, `name`, `type`, `relativePath`) |
| `edges` | Relationships (`from`, `to`, `type`, `evidence`, `confidence`) |
| `generatedAt` | ISO timestamp when the graph was built |

Populated by `src/analyzers/dependency-graph-analyzer.ts` at pipeline step **Analyze Dependency Graph**. The MVP uses lightweight regex-based import parsing (`src/analyzers/import-parser.ts`) — no AST yet. Agents use the graph to understand impact before changes: if `src/core` imports `src/knowledge`, a PKM change may require orchestrator updates.

Persisted to `analysis.json` and `dependencies.json`. Future AST-based analyzers can extend import detection without changing the PKM contract.

### `ConventionKnowledge`

Detected project conventions live in `analysis.conventions` as `ConventionKnowledge[]`:

| Field | Purpose |
|---|---|
| `category` | Convention area (`language`, `testing`, `documentation`, `architecture`, `repository-structure`, `package-management`, `generated-context`, `tooling`, `unknown`) |
| `name` | Short, stable convention name |
| `description` | One-sentence statement of the pattern to follow |
| `evidence` | `ConventionEvidence[]` — `type`, `source`, `detail` for every signal used |
| `confidence` | `high`, `medium`, or `low` |

Conventions are **structured, not plain strings**. A string like "uses TypeScript strict mode" cannot be filtered, weighed, or verified; a structured entry with category `language`, config evidence from `tsconfig.json`, and `high` confidence can. Agents load conventions before editing code so they extend existing patterns (test file naming, folder ownership, strict typing) instead of breaking them.

Populated by `src/analyzers/convention-analyzer.ts` at pipeline step **Analyze Conventions** — deterministically, from the PKM, the repository tree, detected technologies, module knowledge, and safe reads of `tsconfig.json`/`package.json` only. No AI is involved; the future AI stage can add lower-confidence conventions on top of this baseline.

Persisted to `analysis.json` and `conventions.json`. Future `conventions.md` generation must render from this PKM section — not re-derive conventions.

### `NavigationMapKnowledge`

The AI Navigation Map lives in `analysis.navigationMap`. It is the bridge between raw PKM data and practical agent usage: for each common task type it tells an agent which knowledge sections and documentation files to read *before* touching code.

| Field | Purpose |
|---|---|
| `entries` | One `NavigationEntry` per task type |
| `generatedAt` | ISO timestamp when the map was built |

Each `NavigationEntry` carries `taskType` (`architecture-change`, `new-feature`, `bug-fix`, `test-change`, `documentation-change`, `config-change`, `dependency-change`, `ai-agent-integration`), a `description`, `recommendedKnowledge` (PKM sections to load), `recommendedDocuments` (Markdown context files), `relatedModules` and `relatedFolders` (resolved from actual PKM data, never invented), `warnings` (task-specific guardrails), and `confidence`.

Populated by `src/analyzers/navigation-map-analyzer.ts` at pipeline step **Build AI Navigation Map** — deterministically, from data already in the PKM, with no filesystem access and no AI. Confidence is `high` only when every recommended knowledge section is populated and every recommended document is in the documentation plan.

Persisted to `analysis.json` and `navigation-map.json`. Future agent-specific exporters (Cursor rules, skills, agent packs) and `agent-navigation.md` generation must consume this section instead of hardcoding their own reading lists — one navigation contract, many output formats.

### Why PKM is persisted

- **Reusable artifact** — knowledge survives beyond a single pipeline run.
- **Debugging** — inspect exactly what the tool knew when it generated outputs.
- **Future incremental updates** — compare persisted snapshots to detect changes.
- **External integrations** — agents, CI, and other tools can read JSON without re-running analysis.
- **Agent-specific exporters** — future generators can load persisted knowledge instead of rebuilding it.

### Persistence rules

- JSON knowledge files are **machine-readable source of truth** on disk.
- They are tool-managed state: always overwritten on each successful persist step.
- No generated-file marker policy applies to JSON knowledge files (unlike Markdown).
- Paths are resolved with `resolvePathWithinRoot()` — writes never escape the target project root.
- Markdown in `.ai-docs/` is only **one output format** derived from PKM; JSON knowledge is the canonical persisted form.

### Future consumption

Generators and exporters should prefer loading `project-knowledge.json` (or split section files) over re-scanning the repository. In-memory `ProjectKnowledge` during a pipeline run and persisted JSON on disk represent the same contract.

---

## Integration rule

**Future modules must consume `ProjectKnowledge`, not raw pipeline outputs.**

Do not import `RepositoryInfo`, `TechnologyProfile`, or `DocumentationPlan` in generators. Read the equivalent section from `ProjectKnowledge` instead:

- `knowledge.repository` — not `RepositoryInfo` (includes `repositoryTree` and `ignoredPaths`)
- `knowledge.technologies` — not `TechnologyProfile`
- `knowledge.documentation.plan` — not a standalone `DocumentationPlan`

Upstream producers (scanner, detectors, documentation planner) may still emit their own types. The knowledge builder maps them into the PKM at pipeline step **Build Project Knowledge**. The knowledge writer persists it at **Persist Project Knowledge**.

---

## What belongs here

- PKM type definitions and schema version constant.
- `buildProjectKnowledge()` and future pure enrichment functions.
- `persistProjectKnowledge()` and knowledge path resolution.
- Future: `loadProjectKnowledge()` for reading persisted snapshots.

## What does NOT belong here

- Repository scanning — `src/scanner/`
- Technology detection — `src/detectors/`
- Folder and architecture analysis — `src/analyzers/`
- Documentation planning — `src/docs/documentation-planner.ts`
- Markdown writing — `src/docs/documentation-writer.ts`
- AI analysis — `src/ai/`
