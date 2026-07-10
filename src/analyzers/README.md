# src/analyzers

**Responsibility:** Deterministic repository analyzers that enrich the Project Knowledge Model (PKM) without re-scanning the filesystem or calling external AI services.

---

## Why this module exists

AI agents need folder-level context before they read source code: what each directory is for, which config files matter, and how the tree is organized. They also need module-level context: which folders represent applications, libraries, features, or platform core units. They need dependency context: which modules import one another, so they can assess impact before changing code. They need convention context: which patterns the project already follows, so they extend those patterns instead of breaking them. Finally, they need navigation context: which of all this knowledge to actually load for the task at hand.

The scanner produces a raw `RepositoryNode` tree; analyzers translate that tree and selective file reads into structured knowledge agents can trust.

Pipeline steps 9–13 execute these analyzers through built-in plugins in `src/plugins/builtin/`. The analysis logic remains here; plugins are the execution and extension layer.

Analyzers consume `ProjectKnowledge` — especially `knowledge.repository.repositoryTree` and prior analysis sections — and write results back into PKM sections (`knowledge.analysis.folderContexts`, `knowledge.analysis.modules`, `knowledge.analysis.dependencyGraph`, `knowledge.analysis.conventions`, `knowledge.analysis.navigationMap`).

---

## Files

| File | Role |
|---|---|
| `folder-constants.ts` | Shared classification names, ignore rules, important files, path helpers |
| `folder-classifier.ts` | Deterministic folder classification from names, paths, and file signals |
| `folder-analyzer.ts` | Walks the PKM repository tree and produces `FolderKnowledge[]` |
| `module-constants.ts` | Module path patterns, responsibilities, and structural helpers |
| `module-classifier.ts` | Maps structural paths to `ModuleType` using deterministic heuristics |
| `module-analyzer.ts` | Discovers `ModuleKnowledge[]` from folder knowledge |
| `import-parser.ts` | Lightweight regex-based TypeScript/JavaScript import extraction |
| `dependency-graph-analyzer.ts` | Builds `DependencyGraphKnowledge` from module imports |
| `convention-classifier.ts` | Deterministic convention detection rules — pure, no I/O |
| `convention-analyzer.ts` | Builds `ConventionKnowledge[]` from the PKM plus safe config reads |
| `navigation-map-builder.ts` | Per-task-type navigation rules and related module/folder resolution — pure, no I/O |
| `navigation-map-analyzer.ts` | Builds `NavigationMapKnowledge` from the PKM |
| `index.ts` | Public exports |

---

## Folder knowledge vs module knowledge vs dependency graph

| Concern | Folder knowledge | Module knowledge | Dependency graph |
|---|---|---|---|
| Scope | Every documentable directory | Meaningful architectural units only | Import relationships between modules |
| Question answered | "What is this folder?" | "What module does this represent?" | "What depends on what?" |
| PKM field | `analysis.folderContexts` | `analysis.modules` | `analysis.dependencyGraph` |
| Example | `src/utils` → `source`, tooling | `src/knowledge` → `core`, PKM responsibility | `src/core` → `src/knowledge` (`imports`) |

Folder knowledge is exhaustive; module knowledge is selective; the dependency graph connects modules with evidence-backed edges. Agents use modules to choose an entry point, folder knowledge to navigate locally, and the dependency graph to understand impact before edits.

---

## `DependencyGraphKnowledge`

Each dependency graph snapshot is described by:

| Field | Purpose |
|---|---|
| `nodes` | Graph nodes — one per discovered module (`id`, `name`, `type`, `relativePath`) |
| `edges` | Relationships between modules (`from`, `to`, `type`, `evidence`, `confidence`) |
| `generatedAt` | ISO timestamp when the graph was built |

Edge types: `imports`, `contains`, `references`, `configures`, `unknown`. The MVP analyzer creates `imports` edges only.

Each edge includes evidence with `sourceFile` and `importPath`, plus confidence:

| Confidence | When assigned |
|---|---|
| `high` | Import path resolves to a known module or to a file inside that module |
| `medium` | Reserved for future partial-resolution heuristics |
| `low` | Reserved for future weak-inference heuristics |

---

## Import parser

`import-parser.ts` extracts import specifiers from TypeScript and JavaScript source files using regex — no AST dependency.

Supported patterns:

- `import … from "…"`
- `import "…"` (side-effect imports)
- `export … from "…"`
- `require("…")`
- `import("…")` (dynamic imports)

The parser:

- Reads only `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` files
- Skips test files (`*.test.*`, `*.spec.*`) and files under test folders (`test`, `tests`, `__tests__`, `spec`)
- Strips comments and string literals before regex scanning to reduce false positives
- Ignores files in ignored folders (`node_modules`, `dist`, `build`, `coverage`, …)
- Ignores generated docs and `.ai-docs/knowledge`
- Reads only files under discovered module paths from `knowledge.analysis.modules`
- Uses `RepositoryBoundary` for safe file reads
- Returns every relative import specifier with source file path (duplicates preserved for accurate counts)
- Reports `filesRead` and `filesSkipped` when source files cannot be parsed

**Limitations:** path aliases (`@/…`), template literals, and non-JS/TS imports are not detected. Future AST-based parsers can replace or augment this module.

---

## Dependency graph analyzer

`analyzeDependencyGraph(knowledge)`:

1. Reads `knowledge.analysis.modules` as graph nodes.
2. Parses imports from production source files under module paths via `import-parser.ts`.
3. Resolves relative import paths to target modules.
4. Creates `imports` edges with evidence and confidence.
5. Returns `DependencyGraphKnowledge`.

`enrichProjectKnowledgeWithDependencyGraph()` merges results into `knowledge.analysis.dependencyGraph`.

Examples:

- `src/core` imports `../knowledge` → edge from `src/core` to `src/knowledge` (`high` confidence)
- `src/analyzers` imports `../knowledge/project-knowledge` → edge to `src/knowledge` (`high` confidence)

---

## `ConventionKnowledge`

Conventions describe the patterns a project already follows. Each detected convention is structured data, not a plain string:

| Field | Purpose |
|---|---|
| `category` | `language`, `tooling`, `documentation`, `architecture`, `testing`, `package-management`, `generated-context`, `repository-structure`, or `unknown` |
| `name` | Short, stable convention name (e.g. "TypeScript strict mode") |
| `description` | One-sentence statement of the pattern to follow |
| `evidence` | `ConventionEvidence[]` — why the analyzer believes the convention holds |
| `confidence` | `high`, `medium`, or `low` |

Each `ConventionEvidence` entry records `type` (`file`, `folder`, `config`, `module`, `technology`, `knowledge`), `source` (the path or PKM field the signal came from), and `detail` (a human-readable explanation). Examples:

```json
{ "type": "file", "source": "README.md", "detail": "Repository contains a root README.md" }
{ "type": "config", "source": "tsconfig.json", "detail": "compilerOptions.strict is enabled" }
{ "type": "module", "source": "src/knowledge", "detail": "Module classified as core: Represents and persists the Project Knowledge Model used as the source of truth." }
```

**Why structured instead of `string[]`:** an agent can filter conventions by category before a task (only `testing` conventions before writing tests), weigh them by confidence, and verify them from evidence. A flat string list supports none of that — it can only be pasted into a prompt wholesale.

### Convention classifier and analyzer

`convention-classifier.ts` holds the pure detection rules — one function per category, each mapping a narrow `ConventionDetectionInput` to `ConventionKnowledge[]`. It also parses tsconfig/package.json text (tolerating comments and trailing commas) without touching the filesystem.

`analyzeConventions(knowledge)` in `convention-analyzer.ts`:

1. Indexes the PKM repository tree into file and folder path sets (no re-scan).
2. Safely reads **only** `tsconfig.json` and `package.json` at the repository root via `RepositoryBoundary`, and only when the tree or repository metadata says they exist.
3. Runs every rule group: documentation, repository structure, TypeScript, package manager, testing, generated context, and architecture (from `analysis.modules`).
4. Returns a `ConventionAnalysisResult` with the sorted conventions and per-confidence counts.

`enrichProjectKnowledgeWithConventions()` returns a new `ProjectKnowledge` with `analysis.conventions` populated — it does not mutate the input.

Detection is deterministic: same PKM in, same conventions out. No OpenRouter calls, no Markdown generation, no arbitrary source file reads.

---

## `NavigationMapKnowledge` — the AI Navigation Map

The navigation map is the bridge between raw PKM data and practical agent usage. Folder, module, dependency, and convention knowledge describe *what the project is*; the navigation map tells an agent *what to read before a specific kind of task*.

Each `NavigationEntry` describes one task type:

| Field | Purpose |
|---|---|
| `taskType` | `architecture-change`, `new-feature`, `bug-fix`, `test-change`, `documentation-change`, `config-change`, `dependency-change`, `ai-agent-integration` |
| `description` | What kind of work the entry covers |
| `recommendedKnowledge` | PKM sections to load (`modules`, `folderContexts`, `dependencyGraph`, `conventions`, `documentation`, `technologies`, `navigationMap`) |
| `recommendedDocuments` | Markdown context files to read (from the documentation plan) |
| `relatedModules` | Module paths from `analysis.modules` relevant to the task — never invented |
| `relatedFolders` | Folder paths from `analysis.folderContexts` relevant to the task — never invented |
| `warnings` | Guardrails the agent must respect for this task type |
| `confidence` | `high`, `medium`, or `low` |

**Why it exists:** without a navigation map, every agent decides ad hoc which context to load — reading too much (wasted tokens) or too little (broken conventions). The map encodes the answer once, per task type, from data the pipeline has already verified.

### Builder and analyzer

`navigation-map-builder.ts` defines one `NavigationRule` per task type — recommended knowledge sections, documents, warnings, and candidate module paths/types and folder paths/classifications. Resolution helpers intersect those candidates with actual PKM data: `relatedModules` and `relatedFolders` contain only paths that exist in `analysis.modules` / `analysis.folderContexts`. If nothing matches, the arrays are empty — paths are never invented.

`buildNavigationMap(knowledge)` in `navigation-map-analyzer.ts` builds every entry and computes confidence: `high` when all recommended knowledge sections are populated and all recommended documents are in the documentation plan, degrading to `medium`/`low` as recommendations become unverifiable. `enrichProjectKnowledgeWithNavigationMap()` returns a new `ProjectKnowledge` with `analysis.navigationMap` set — no mutation.

The MVP map is fully deterministic: no OpenRouter, no filesystem access at all. Deterministic rules make the map reproducible, free, and auditable; a future AI stage can add project-specific task types or refine recommendations on top of this baseline. Future agent-specific exporters (Cursor rules, skills, agent packs) must consume `analysis.navigationMap` from the PKM instead of hardcoding their own reading lists.

---

## Pipeline integration

| Step | Handler | PKM output |
|---|---|---|
| **Analyze Folder Knowledge** | `enrichProjectKnowledgeWithFolderAnalysis()` | `analysis.folderContexts` |
| **Analyze Modules** | `enrichProjectKnowledgeWithModuleAnalysis()` | `analysis.modules` |
| **Analyze Dependency Graph** | `enrichProjectKnowledgeWithDependencyGraph()` | `analysis.dependencyGraph` |
| **Analyze Conventions** | `enrichProjectKnowledgeWithConventions()` | `analysis.conventions` |
| **Build AI Navigation Map** | `enrichProjectKnowledgeWithNavigationMap()` | `analysis.navigationMap` |

Results are persisted to `analysis.json`, `folders.json`, `modules.json`, `dependencies.json`, `conventions.json`, and `navigation-map.json`.

---

## Architecture rules

| Do | Do not |
|---|---|
| Consume `ProjectKnowledge` | Re-scan the repository |
| Use folder/module knowledge and repository tree from PKM | Call OpenRouter |
| Use `RepositoryBoundary` for selective file reads | Write Markdown |
| Write structured knowledge into PKM | Invent parallel data structures |

---

## Future work

- AST-based import parser (TypeScript compiler API or `@babel/parser`) replacing or augmenting regex parsing
- Framework-specific module analyzers (Angular NgModules, NestJS modules, Nx projects)
- Framework-specific convention rules (Angular naming, NestJS module layout) extending the classifier
- Additional edge types (`configures`, `references`) from config file analysis
- AI architecture analysis (OpenRouter) enriching `knowledge.analysis.architecture` and adding lower-confidence conventions on top of the deterministic baseline
- Project-specific navigation entries (AI-suggested task types) extending the deterministic navigation map
- Markdown `conventions.md`, `dependency-map.md`, and `agent-navigation.md` rendered from PKM conventions, dependency graph, and navigation map
- Agent-specific exporters (Cursor rules, skills, agent packs) consuming `analysis.navigationMap`

---

## Why deterministic heuristics come first

Structural folder names, import statements, and well-known config files are reliable signals that do not require AI. Deterministic analyzers produce a reproducible baseline on every pipeline run. AI and AST-based analyzers can enrich the same PKM fields later without replacing the structural map.

For conventions specifically, running deterministic detection before AI analysis matters twice over: the baseline is free and reproducible, and it anchors future AI output — an AI stage can confirm, refine, or extend evidence-backed conventions instead of hallucinating patterns from scratch. Future Markdown generators (`conventions.md`) must render from `knowledge.analysis.conventions`, not re-derive conventions themselves.
