# `src/plugins/` — Plugin system

**Responsibility:** Plugin contracts, registry, manager, and built-in/technology plugin implementations. The pipeline executes analyzer plugins through `PluginManager` instead of calling `src/analyzers/` directly.

---

## Module layout

```
src/plugins/
├── analyzer-plugin.ts          AnalyzerPlugin contract
├── technology-plugin.ts        TechnologyPlugin contract
├── documentation-plugin.ts     DocumentationPlugin contract (reserved)
├── exporter-plugin.ts          ExporterPlugin contract (reserved)
├── plugin-contract.ts          Shared Plugin metadata and kinds
├── plugin-context.ts           PluginContext (safe runtime surface)
├── plugin-result.ts            PluginResult and PluginContributions
├── plugin-logger.ts            PluginLogger interface
├── plugin-merger.ts            Merges contributions into PKM
├── plugin-registry.ts          Static plugin registration
├── plugin-manager.ts           Executes plugins and merges results
├── pipeline-integration.ts     Pipeline handler bridge
├── builtin/                    Built-in analyzer plugins
└── technology/                 Technology placeholder plugins
```

---

## Lifecycle (v1)

Plugins are **stateless**. There are no `initialize()` or `dispose()` hooks.

1. `supports(knowledge)` — skip when false
2. `analyze(context)` / `contribute(context)` / `export(context)` — return `PluginResult`
3. `PluginManager` merges `contributions` when status is `completed`

Failures and thrown exceptions leave the PKM unchanged. Warnings are surfaced through `PluginLogger` and `PluginResult.warnings`.

---

## Public API

Import plugin contracts and runtime from `src/plugins/index.ts`.

Pipeline handlers import the bridge from `src/plugins/pipeline-integration.ts` only:

| Export | Audience | Purpose |
|---|---|---|
| `AnalyzerPlugin`, `TechnologyPlugin` | External plugin authors | Plugin contracts |
| `PluginManager`, `PluginRegistry` | External plugin authors | Registration and execution |
| `PluginContext`, `PluginResult`, `PluginContributions` | External plugin authors | Runtime surface |
| `mergePluginContributions` | External plugin authors | Test helpers / custom merge |
| `createCompletedPluginResult`, `createFailedPluginResult`, `createSkippedPluginResult` | External plugin authors | Result builders |
| `executeAnalyzerPluginStep()` | Internal (pipeline only) | Bridge for `pipeline-handlers.ts` |
| `BUILTIN_ANALYZER_PLUGINS`, `TECHNOLOGY_PLUGINS` | Internal | Static registration lists |

---

## Creating an analyzer plugin

1. Implement `AnalyzerPlugin` in a new file under `src/plugins/` or a future plugin package.
2. Implement `supports(knowledge)` — return `true` only when the plugin can contribute meaningfully.
3. Implement `analyze(context)` — read from `context.knowledge`; use `context.boundary` for safe file reads.
4. Return `PluginResult` with `contributions` (preferred). Avoid returning pre-merged `knowledge` unless migrating legacy code.
5. Register the plugin in `PluginRegistry` (static import in v1).
6. Wire a pipeline step or call `PluginManager.executeAnalyzerPlugin()` from an existing handler.

Do not import `PipelineContext` or access pipeline internals from a plugin.

---

## Execution flow

```
pipeline-handlers.ts (steps 9–13)
  → pipeline-integration.ts
    → PluginManager.executeAnalyzerPlugin()
      → builtin plugin.analyze(context)
        → src/analyzers/enrichProjectKnowledgeWith*()
      → mergePluginContributions()
```

Markdown generation (`src/docs/`) and agent export (`src/exporters/`) are **not** plugin-wired yet. Their contracts (`DocumentationPlugin`, `ExporterPlugin`) are reserved.

---

## Constraints

- Plugins must not modify source files or write generated output.
- Plugins must not re-scan the repository — consume PKM sections.
- Built-in plugins delegate to `src/analyzers/` and return contributions.
- Dynamic plugin loading is not implemented yet; registration is static.

See [`docs/plugins.md`](../../docs/plugins.md) for the full architecture guide.
