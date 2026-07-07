# src/scanner

**Responsibility:** Reading the target repository from disk.

This module reads the target directory and produces structured in-memory representations of what the repository contains. It does not interpret what it finds — interpretation belongs to `src/detectors/` and `src/ai/`.

---

## Files

| File | Role |
|---|---|
| `repository-loader.ts` | Loads top-level `RepositoryInfo` from a `RuntimeConfig` |
| `repository-boundary.ts` | Safe path resolution within the target repository root |
| `ignore-rules.ts` | Default ignored paths, `.gitignore` loading, and entry filtering |
| `scanner-options.ts` | `ScannerOptions` defaults and resolution |
| `repository-scanner.ts` | Recursive directory walk producing a `RepositoryNode` tree |

---

## Exports

### `loadRepositoryMetadata(config: RuntimeConfig): RepositoryInfo`

Reads the target directory and returns a `RepositoryInfo`:

- `name` — derived from the basename of `targetProjectPath`
- `rootPath` — the resolved absolute path from `RuntimeConfig`
- `detectedFiles` — all top-level entries (files and directories) returned by `fs.readdirSync`
- `ignoredPaths` — populated after the structure scan with effective ignore patterns

`detectedFiles` feeds `src/detectors/` so technology detection can run without additional I/O.

### `scanRepository(repositoryInfo: RepositoryInfo, options?: ScannerOptions): RepositoryScanResult`

Recursively walks the repository from the project root and returns:

- `tree` — a `RepositoryNode` directory tree with nested `children`
- `stats` — `filesScanned`, `directoriesScanned`, `maxDepthReached`, `limitReached`
- `ignoredPaths` — the effective ignore patterns used during the scan

Each file node includes `extension` and `sizeBytes` when available. Directory nodes include `children` when non-empty. Directories not fully expanded due to depth, file limits, or permission errors include `truncated: true`.

---

## Scanner options

| Option | Default | Behavior |
|---|---|---|
| `maxDepth` | `12` | Stop descending into subdirectories beyond this depth |
| `maxFiles` | `10000` | Stop adding file nodes after this count |
| `includeHidden` | `false` | Skip dotfiles and dot-directories unless `true` |
| `ignoredPaths` | built-in defaults | Additional path patterns to skip |
| `outputDocsDir` | — | Always ignores the configured docs output directory (e.g. `.ai-docs`) |

`.git` and `node_modules` are always ignored regardless of options. The configured docs output directory is always ignored so generated artifacts do not pollute the tree.

Default ignored paths include common build and cache directories (`dist`, `build`, `coverage`, `.next`, `.turbo`, etc.) plus patterns loaded from the target `.gitignore`. Root-anchored gitignore patterns such as `/dist` only match at the repository root; nested `.gitignore` files are loaded per directory during the walk.

---

## What the scanner does

- Recursively lists files and directories from the project root.
- Uses `RepositoryBoundary` and `resolvePathWithinRoot()` so resolved paths never escape the target root.
- Applies ignore rules to skip noise (build artifacts, dependencies, VCS metadata).
- Produces a typed `RepositoryNode` tree for the knowledge builder and future analyzers.
- Records scan statistics for pipeline console output.

## What the scanner intentionally does NOT do

- **Read file contents** — content sampling belongs in a future enrichment step.
- **Detect frameworks or languages** — that belongs in `src/detectors/`.
- **Call AI or OpenRouter** — that belongs in `src/ai/`.
- **Analyze architecture, modules, or dependencies** — future analyzers consume the tree from PKM.
- **Generate documentation** — generators read from `ProjectKnowledge` in `src/docs/` and `src/knowledge/`.
- **Write files** — persistence belongs in `src/knowledge/knowledge-writer.ts`.

---

## Ignore rules and performance

Ignore rules protect both **performance** and **quality**:

- Skipping `node_modules`, `dist`, and `.git` keeps scans fast on large projects.
- Ignoring generated artifacts prevents build output from polluting the repository tree.
- Loading `.gitignore` respects project-specific exclusions the team already defined.

Effective patterns are stored on `RepositoryInfo.ignoredPaths` and mapped into `knowledge.repository.ignoredPaths` in the PKM.

---

## PKM integration

After step 3 (Scan Repository Structure), the tree is attached to `RepositoryInfo.repositoryTree`. The knowledge builder maps it into `ProjectKnowledge.repository.repositoryTree` at step 8. The knowledge writer persists it in:

- `project-knowledge.json` (full snapshot)
- `repository.json` (repository section, includes tree)
- `repository-tree.json` (tree only, when present)

Future analyzers (folder analysis, module discovery, dependency graph, AI documentation) should **consume the repository tree from PKM** — either in-memory during a pipeline run or by loading `repository-tree.json` from disk. They must not re-scan the repository independently. One scan per pipeline run keeps outputs consistent and avoids redundant I/O.

---

## Current status

- `loadRepositoryMetadata` — ✅ reads top-level directory entries
- `scanRepository` — ✅ full recursive tree walk with ignore rules and safety limits
- Key file content sampling — planned
- `.ai-docs-ignore` support — planned
