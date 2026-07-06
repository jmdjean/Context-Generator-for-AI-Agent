# src/utils

**Responsibility:** Pure, shared utility functions.

This module contains functions that are used by two or more other modules and that carry no domain knowledge. Every function here must be pure or clearly documented if it cannot be.

---

## Current files

### `fs.ts`

Thin wrappers over `node:fs` and `node:path` used by both `src/config/` (validation) and future modules (scanner, docs).

| Function | Description |
|---|---|
| `resolveAbsolutePath(inputPath)` | Returns the absolute, normalized form of any path string. |
| `pathExists(targetPath)` | Returns `true` if the path is accessible on disk. |
| `isDirectory(targetPath)` | Returns `true` if the path exists and is a directory. |

---

## What belongs here

- Path manipulation helpers.
- String formatting utilities shared across modules.
- Generic retry logic (independent of any domain concern).
- Any thin wrapper around a Node.js built-in that is used in two or more modules.

## What does NOT belong here

- Functions used in only one module — keep them there.
- Domain logic (anything that knows about `RuntimeConfig`, `RepositorySnapshot`, etc.).
- Functions with side effects that belong in a specific domain module (e.g. writing files belongs in `src/docs/`).

---

## Guidelines

Before adding a function here, ask: "Would a completely different project with different business logic find this useful?" If yes, it belongs here. If no, it belongs in the calling module.
