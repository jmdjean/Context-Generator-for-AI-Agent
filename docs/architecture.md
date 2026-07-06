# Architecture

## Overview

`ai-project-docs` is a CLI tool with a pipeline architecture. The user runs a single command; the tool reads a target repository, sends relevant context to an AI provider, and writes structured documentation into a `.ai-docs/` folder inside that repository.

Each stage of the pipeline is isolated in its own module. No module reaches into another module's internals.

---

## Pipeline (planned)

```
CLI input
   │
   ▼
Config loading (src/config/)
   │  Reads flags, environment variables, and any config file.
   │  Produces a validated Config object.
   ▼
Repository scanning (src/scanner/)
   │  Reads the target directory on disk.
   │  Produces a RepositorySnapshot: folder tree, key files, dependency manifest.
   ▼
AI analysis (src/ai/)
   │  Sends the snapshot to OpenRouter.
   │  Returns structured documentation content per section.
   ▼
Documentation writing (src/docs/)
   │  Writes .ai-docs/ files into the target repository.
   │  Manages incremental updates (only rewrite changed sections).
   ▼
CLI output
     Prints a summary of what was generated.
```

Orchestration lives in `src/core/`. The CLI (`src/cli.ts`) is a thin wrapper that parses arguments and delegates to `core/`.

---

## Current state (foundation phase)

Only the CLI entry point is implemented. Config, scanner, AI, and docs modules are scaffolded with placeholder `README.md` files but contain no logic yet.

The pipeline above describes the **target architecture**, not the current state.

---

## Key design decisions

**Pipeline over monolith.** Each stage produces a plain data structure that the next stage consumes. This makes each stage independently testable and replaceable.

**Config is explicit.** There is no global configuration object. The validated `Config` is passed explicitly to every function that needs it.

**Scanner produces a snapshot, not a stream.** For the repository sizes this tool targets, loading the full structure into memory before calling the AI is simpler and produces better prompts than streaming.

**`.ai-docs/` is owned by the tool.** The generated folder is not meant to be hand-edited. It is regenerated (or partially updated) on every run. Users who want to customize should use configuration options, not edit the output directly.

---

## Error handling strategy

- Validate configuration before doing any I/O.
- Fail fast with a clear error message if the target path does not exist or is not readable.
- Do not swallow errors silently. Surface them at the CLI layer with actionable messages.
- Network errors from the AI provider are retried with exponential back-off (planned).

---

## Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict) | Type safety, wide ecosystem, first-class Node.js support |
| Runtime | Node.js ≥ 18 | LTS, built-in `fs/promises`, no extra build tooling |
| AI provider | OpenRouter (planned) | Single API surface for multiple models |
| CLI parsing | `process.argv` (no framework) | Avoids a dependency for a simple argument surface |
