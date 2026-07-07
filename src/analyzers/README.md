# src/analyzers

**Responsibility:** Deterministic repository analyzers that enrich the Project Knowledge Model (PKM) without re-scanning the filesystem or calling external AI services.

---

## Why this module exists

AI agents need folder-level context before they read source code: what each directory is for, which config files matter, and how the tree is organized. They also need module-level context: which folders represent applications, libraries, features, or platform core units. They need dependency context: which modules import one another, so they can assess impact before changing code. And they need convention context: which patterns the project already follows, so they extend those patterns instead of breaking them.

The scanner produces a raw `RepositoryNode` tree; analyzers translate that tree and selective file reads into structured knowledge agents can trust.

Analyzers consume `ProjectKnowledge` — especially `knowledge.repository.repositoryTree` and prior analysis sections — and write results back into PKM sections (`knowledge.analysis.folderContexts`, `knowledge.analysis.modules`, `knowledge.analysis.dependencyGraph`, `knowledge.analysis.conventions`).

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

## Pipeline integration

| Step | Handler | PKM output |
|---|---|---|
| **Analyze Folder Knowledge** | `enrichProjectKnowledgeWithFolderAnalysis()` | `analysis.folderContexts` |
| **Analyze Modules** | `enrichProjectKnowledgeWithModuleAnalysis()` | `analysis.modules` |
| **Analyze Dependency Graph** | `enrichProjectKnowledgeWithDependencyGraph()` | `analysis.dependencyGraph` |
| **Analyze Conventions** | `enrichProjectKnowledgeWithConventions()` | `analysis.conventions` |

Results are persisted to `analysis.json`, `folders.json`, `modules.json`, `dependencies.json`, and `conventions.json`.

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
- Markdown `conventions.md` and `dependency-map.md` rendered from PKM conventions and dependency graph

---

## Why deterministic heuristics come first

Structural folder names, import statements, and well-known config files are reliable signals that do not require AI. Deterministic analyzers produce a reproducible baseline on every pipeline run. AI and AST-based analyzers can enrich the same PKM fields later without replacing the structural map.

For conventions specifically, running deterministic detection before AI analysis matters twice over: the baseline is free and reproducible, and it anchors future AI output — an AI stage can confirm, refine, or extend evidence-backed conventions instead of hallucinating patterns from scratch. Future Markdown generators (`conventions.md`) must render from `knowledge.analysis.conventions`, not re-derive conventions themselves.
