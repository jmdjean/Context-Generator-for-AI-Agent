# src/core

**Responsibility:** Pipeline orchestration.

This module is the central coordinator. It receives a validated `RuntimeConfig` from the CLI layer and runs the pipeline stages in order. It contains no domain logic of its own — it only coordinates calls to other modules.

---

## Exports

### `run(config: RuntimeConfig): Promise<void>`

Executes the full pipeline for a given configuration. Currently:
1. Prints the resolved configuration summary.
2. Warns if no OpenRouter API key was provided.

Future stages (scanner → AI → docs) will be called from here as they are implemented.

---

## What belongs here

- The `run()` function that assembles and executes the pipeline.
- Logic that decides *which* stages to run and in *what order* (e.g. skip AI stage if no API key).
- Top-level error handling that catches stage failures and surfaces them to the CLI.

## What does NOT belong here

- Argument parsing — that is `src/config/`'s responsibility.
- File I/O — that belongs in `src/scanner/` or `src/docs/`.
- AI calls — that belongs in `src/ai/`.
- Utility functions — that belongs in `src/utils/`.

---

## Current pipeline (implemented)

```
run(config)
  └─ Print configuration summary
  └─ Warn if openRouterApiKey is missing
```

## Planned pipeline

```
run(config)
  ├─ scan(config.targetProjectPath)         → RepositorySnapshot
  ├─ generateDocumentation(snapshot, config) → DocumentationContent
  └─ writeDocumentation(config, content)
```

---

## Adding a new pipeline stage

1. Import the new stage's public function.
2. Call it in `run()` in the correct order, passing `config` and any upstream data.
3. Update this README to reflect the new pipeline.
4. Update `docs/architecture.md` to document the new stage.
