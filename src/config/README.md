# src/config

**Responsibility:** Configuration loading and validation.

This module reads all user-provided configuration from every source (CLI flags, environment variables, config file) and produces a single, validated `Config` object. The rest of the application only ever sees `Config` — it never reads `process.env` or `process.argv` directly.

## What belongs here

- Type definition for `Config`.
- Functions to read and merge configuration sources.
- Validation logic (required fields, value constraints).
- Default values for optional settings.

## What does NOT belong here

- Business logic that acts on config values.
- File I/O beyond reading a config file.
- Anything that would prevent this module from being unit-tested in isolation.

## Current status

Not yet implemented. Placeholder for the configuration layer.

## Expected configuration sources (planned)

1. CLI flags (highest priority)
2. `.ai-docs.json` in the project root (mid priority)
3. Environment variables (lowest priority)

## Expected interface (planned)

```typescript
export interface Config {
  targetPath: string;
  apiKey: string;
  model?: string;
  outputDir?: string;
}

export function loadConfig(argv: string[]): Config
```
