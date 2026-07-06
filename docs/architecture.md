# Architecture

## Overview

`ai-project-docs` is a CLI tool with a pipeline architecture. The user runs a single command; the tool reads a target repository, sends relevant context to an AI provider, and writes structured documentation into a `.ai-docs/` folder inside that repository.

Each stage of the pipeline is isolated in its own module. No module reaches into another module's internals.

---

## Pipeline

```
CLI input (process.argv)
   │
   ▼
Argument parsing + config resolution  (src/config/)
   │  Parses flags, reads env variables, validates inputs.
   │  Produces a RuntimeConfig object.
   │  Fails fast with a clear error if inputs are invalid.
   ▼
Orchestration  (src/core/)
   │  Receives RuntimeConfig.
   │  Calls scanner, AI, and docs modules in order.
   │  Surfaces errors from any stage to the CLI layer.
   ▼
Repository scanning  (src/scanner/)              [planned]
   │  Reads the target directory on disk.
   │  Produces a RepositorySnapshot.
   ▼
AI analysis  (src/ai/)                           [planned]
   │  Sends the snapshot to OpenRouter.
   │  Returns structured documentation content.
   ▼
Documentation writing  (src/docs/)               [planned]
   │  Writes .ai-docs/ files into the target repository.
   │  Manages incremental updates.
   ▼
CLI output
     Prints a summary of what was generated.
```

---

## CLI / Config flow (current)

This is the part of the pipeline that is fully implemented.

```
process.argv
   │
   ▼
cli.ts
   ├─ No args → print usage error, exit 1
   ├─ --help → printHelp(), exit 0
   └─ Otherwise → resolveConfig(argv)
         │
         ▼
      config/index.ts
         ├─ parseArgs()  — extracts flags and positional from argv
         ├─ resolveApiKey()  — flag value takes priority over OPENROUTER_API_KEY env var
         ├─ validate target path (required, must exist, must be directory)
         └─ validate docsDir (must not be empty)
         │
         ▼
      RuntimeConfig { targetProjectPath, docsDir, openRouterApiKey? }
         │
         ▼
      core/index.ts → run(config)
         └─ Prints summary; warns if API key is missing.
```

Key constraint: **`process.argv` and `process.env` are only read inside `src/config/`.** Every other module receives a `RuntimeConfig` and never touches raw environment state.

---

## Key design decisions

**Pipeline over monolith.** Each stage produces a plain data structure that the next stage consumes. This makes each stage independently testable and replaceable.

**Config is explicit.** There is no global configuration object. The validated `RuntimeConfig` is passed explicitly to every function that needs it.

**Config owns all environment reads.** `src/config/index.ts` is the single place that reads `process.argv` and `process.env`. This makes the configuration contract explicit and easy to test.

**Fail fast, fail clearly.** Configuration is validated before any I/O. If the target path does not exist or is not readable, the CLI exits immediately with a specific error message. Silent failures are not acceptable.

**Scanner produces a snapshot, not a stream.** For the repository sizes this tool targets, loading the full structure into memory before calling the AI is simpler and produces better prompts than streaming.

**`.ai-docs/` is owned by the tool.** The generated folder is not meant to be hand-edited. It is regenerated (or partially updated) on every run. Users who want to customize should use configuration options, not edit the output directly.

---

## Configuration sources and priority

| Priority | Source |
|---|---|
| 1 (highest) | CLI flag (`--openrouter-key`) |
| 2 | Environment variable (`OPENROUTER_API_KEY`) |
| 3 (lowest) | Project config file (`.ai-docs.json`) — planned |

---

## Error handling strategy

- Validate configuration before doing any I/O.
- Fail fast with a clear, specific error message when validation fails.
- Do not swallow errors silently. Surface them at the CLI layer.
- Network errors from the AI provider will be retried with exponential back-off (planned).

---

## Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict) | Type safety, wide ecosystem, first-class Node.js support |
| Runtime | Node.js ≥ 18 | LTS, built-in `fs/promises`, no extra build tooling |
| AI provider | OpenRouter (planned) | Single API surface for multiple models |
| CLI parsing | Manual (`process.argv`, no framework) | Simple surface; avoids a dependency |
| Filesystem utilities | Node.js `node:fs` (no framework) | No abstraction needed at this scale |
