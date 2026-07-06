# src/scanner

**Responsibility:** Reading the target repository from disk.

This module walks the target directory and produces a `RepositorySnapshot` — a structured, in-memory representation of what is in the repository. It does not interpret the contents; it only collects them.

## What belongs here

- Directory walking (depth-limited, respecting `.gitignore` patterns).
- Key file detection (`package.json`, `tsconfig.json`, `go.mod`, `Cargo.toml`, lock files, etc.).
- File content sampling (reading the first N lines of important files to avoid loading huge binaries).
- Building the `RepositorySnapshot` data structure.

## What does NOT belong here

- Analysis or interpretation of what was found — that is the AI's job.
- Writing files — that belongs in `docs/`.
- Making network requests.

## Current status

Not yet implemented. Placeholder for the scanner layer.

## Expected interface (planned)

```typescript
export interface RepositorySnapshot {
  rootPath: string;
  tree: DirectoryNode[];
  keyFiles: Record<string, string>;  // filename → sampled content
  detectedLanguages: string[];
}

export async function scan(targetPath: string): Promise<RepositorySnapshot>
```
