# src/analyzers

**Responsibility:** Deterministic repository analyzers that enrich the Project Knowledge Model (PKM) without re-scanning the filesystem or calling external AI services.

---

## Why this module exists

AI agents need folder-level context before they read source code: what each directory is for, which config files matter, and how the tree is organized. They also need module-level context: which folders represent applications, libraries, features, or platform core units. They need dependency context: which modules import one another, so they can assess impact before changing code.

The scanner produces a raw `RepositoryNode` tree; analyzers translate that tree and selective file reads into structured knowledge agents can trust.

Analyzers consume `ProjectKnowledge` — especially `knowledge.repository.repositoryTree` and prior analysis sections — and write results back into PKM sections (`knowledge.analysis.folderContexts`, `knowledge.analysis.modules`, `knowledge.analysis.dependencyGraph`).

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

## Pipeline integration

| Step | Handler | PKM output |
|---|---|---|
| **Analyze Folder Knowledge** | `enrichProjectKnowledgeWithFolderAnalysis()` | `analysis.folderContexts` |
| **Analyze Modules** | `enrichProjectKnowledgeWithModuleAnalysis()` | `analysis.modules` |
| **Analyze Dependency Graph** | `enrichProjectKnowledgeWithDependencyGraph()` | `analysis.dependencyGraph` |

Results are persisted to `analysis.json`, `folders.json`, `modules.json`, and `dependencies.json`.

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
- Additional edge types (`configures`, `references`) from config file analysis
- AI architecture analysis (OpenRouter) enriching `knowledge.analysis.architecture`
- Markdown `dependency-map.md` generated from PKM dependency graph

---

## Why deterministic heuristics come first

Structural folder names and import statements are reliable signals that do not require AI. Deterministic analyzers produce a reproducible baseline on every pipeline run. AI and AST-based analyzers can enrich the same PKM fields later without replacing the structural map.
