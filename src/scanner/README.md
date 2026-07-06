# src/scanner

**Responsibility:** Reading the target repository from disk.

This module reads the target directory and produces structured in-memory representations of what the repository contains. It does not interpret what it finds — interpretation belongs to `src/ai/` and `src/detectors/`.

---

## Files

| File | Role |
|---|---|
| `repository-loader.ts` | Loads top-level `RepositoryInfo` from a `RuntimeConfig` |

---

## Exports

### `loadRepositoryMetadata(config: RuntimeConfig): RepositoryInfo`

Reads the target directory and returns a `RepositoryInfo`:

- `name` — derived from the basename of `targetProjectPath`
- `rootPath` — the resolved absolute path from `RuntimeConfig`
- `detectedFiles` — all top-level entries (files and directories) returned by `fs.readdirSync`
- `ignoredPaths` — empty in this step; ignore-rule support is planned

`detectedFiles` feeds `src/detectors/` so technology detection can run without additional I/O.

---

## What belongs here

- Reading directory entries (`readdirSync`, depth-limited walks when implemented).
- Building `RepositoryInfo` and `RepositoryNode` as defined in `src/domain/`.
- Key file detection (`package.json`, `tsconfig.json`, lock files, etc.).
- File content sampling for important files (planned).
- Respecting `.gitignore` patterns (planned).

## What does NOT belong here

- Interpreting what was found — that belongs in `src/detectors/` and `src/ai/`.
- Technology detection logic — that belongs in `src/detectors/`.
- Writing files — that belongs in `src/docs/`.
- Making network requests.

---

## Current status

Minimal implementation: `loadRepositoryMetadata` reads top-level directory entries and returns a `RepositoryInfo`. This is enough to support the technology detection step.

Planned additions:

- Full directory tree walk (depth-limited, respecting `.gitignore`) → `RepositoryNode` tree for the Scan Repository Structure step (step 3).
- Key file content sampling → reads first N lines of `package.json`, `tsconfig.json`, etc.
- Ignore-rule loading from `.gitignore` and `.ai-docs-ignore`.
