# src/core

**Responsibility:** Pipeline orchestration.

This module is the central coordinator. It calls `config/`, `scanner/`, `ai/`, and `docs/` in order and passes data between them. It contains no domain logic of its own.

## What belongs here

- The main `run()` function that executes the full pipeline.
- Any logic that decides *which* modules to call and in *what order*.
- Top-level error handling that surfaces failures to the CLI layer.

## What does NOT belong here

- File I/O — that belongs in `scanner/` or `docs/`.
- Configuration parsing — that belongs in `config/`.
- AI calls — that belongs in `ai/`.
- Utility functions — that belongs in `utils/`.

## Current status

Not yet implemented. Placeholder for the orchestration layer.

## Expected interface (planned)

```typescript
export async function run(config: Config): Promise<void>
```
