# Plugin Architecture

`ai-project-docs` is a **plugin-driven Context Engineering platform**. The core application does not embed framework-specific analysis logic. Instead, it loads a repository, assembles the Project Knowledge Model (PKM), executes registered plugins, merges their contributions, and runs generators.

Technology-specific behavior — Angular modules, React component trees, NestJS providers, Java packages, .NET solutions — belongs in **plugins**, not in the core pipeline.

---

## Why plugins

Before v1.0, deterministic analyzers lived directly in `src/analyzers/` and were invoked from pipeline handlers. That worked for MVP, but it tightly coupled the core to a fixed set of analysis stages.

Plugins decouple three concerns:

| Concern | Owner |
|---|---|
| Repository loading and PKM assembly | Core (`src/scanner/`, `src/knowledge/`) |
| Technology-specific and structural analysis | Plugins (`src/plugins/`) |
| Presentation (Markdown, agent exports) | Generators (`src/docs/`, `src/exporters/`) |

The core never needs to know how to analyze Angular, React, NestJS, or future stacks. It only needs to know how to run plugins and merge `PluginResult` contributions into the PKM.

---

## Plugin kinds

| Kind | Contract | Purpose |
|---|---|---|
| **Analyzer** | `AnalyzerPlugin` | Enrich PKM analysis sections (folders, modules, dependencies, conventions, navigation) |
| **Technology** | `TechnologyPlugin` | Framework-specific detection and analysis (Angular, React, NestJS, Node.js, …) |
| **Documentation** | `DocumentationPlugin` | Contribute documentation sections derived from PKM (future) |
| **Exporter** | `ExporterPlugin` | Agent-specific export formats (future; exporters today live in `src/exporters/`) |

All plugins share metadata: `id`, `name`, `description`, `version`.

---

## Lifecycle

v1 uses a **minimal lifecycle** — no `initialize()` or `dispose()` hooks. Plugins are stateless; the pipeline creates a fresh `PluginContext` per step.

```
supports(knowledge)
        │
       no ──► skipped PluginResult (PKM unchanged)
        │
       yes
        │
        ▼
analyze(context) | contribute(context) | export(context)
        │
        ▼
PluginResult (status + contributions)
        │
        ▼
PluginManager merges contributions (completed only)
        │
        ▼
Updated ProjectKnowledge
```

| Status | PKM merge | Pipeline step |
|---|---|---|
| `completed` | Contributions merged (or pre-merged `knowledge` accepted for backward compatibility) | `completed` |
| `skipped` | Unchanged | `skipped` |
| `failed` | Unchanged — failures never corrupt PKM | `failed` |

Thrown exceptions are caught by `PluginManager`, logged via `PluginLogger`, and converted to `failed` results with structured warnings. One failing plugin does not stop unrelated plugins.

### Pipeline bridge

```
Pipeline step handler (src/core/pipeline-handlers.ts)
        │
        ▼
executeAnalyzerPluginStep() (src/plugins/pipeline-integration.ts)
        │
        ▼
PluginManager.executeAnalyzerPlugin(id, context)
        │
        ├─► PluginRegistry.getById(id)
        │
        ├─► plugin.supports(knowledge) ──no──► skipped PluginResult
        │         │
        │        yes
        │         ▼
        ├─► plugin.analyze(context) ──► PluginResult
        │
        ├─► merge contributions when status is completed
        │
        └─► return updated ProjectKnowledge + metrics
```

Built-in analyzer plugins wrap the existing deterministic analyzers in `src/analyzers/`. Their observable output is unchanged — plugins are an execution layer, not a rewrite of analysis logic.

Technology plugins are registered statically but are **not yet executed** during the default pipeline. They exist as placeholders with `supports()` detection so future framework analysis can be added without changing the core.

Documentation and exporter plugin contracts are **reserved for future use**. Markdown generation runs through `src/docs/`; agent export runs through `src/exporters/` (`AgentExporter` contract). Both consume `ProjectKnowledge` only.

---

## Contracts

### AnalyzerPlugin

```typescript
interface AnalyzerPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  kind: 'analyzer';
  supports(knowledge: ProjectKnowledge): boolean;
  analyze(context: PluginContext): PluginResult;
}
```

### PluginContext

Plugins receive only safe, bounded information:

| Field | Purpose |
|---|---|
| `knowledge` | Current `ProjectKnowledge` snapshot |
| `config` | `RuntimeConfig` (paths, flags — no raw `process.argv`) |
| `boundary` | `RepositoryBoundary` for safe relative file reads |
| `logger` | Structured logging (`info`, `warn`, `error`) |

Plugins must **never** access internal pipeline state, `PipelineContext`, or arbitrary filesystem paths outside `RepositoryBoundary`.

### PluginResult

Plugins return contributions instead of mutating the PKM directly:

| Contribution | PKM path |
|---|---|
| Folder knowledge | `analysis.folderContexts` |
| Module knowledge | `analysis.modules` |
| Conventions | `analysis.conventions` |
| Dependency graph | `analysis.dependencyGraph` |
| Navigation map | `analysis.navigationMap` |
| AI insights | `analysis.aiInsights` |
| Documentation sections | Reserved — not merged in v1 |

`PluginManager` merges contributions through `mergePluginContributions()` in `plugin-merger.ts`. Merge rules mirror the existing `enrichProjectKnowledgeWith*` functions: empty convention lists are not persisted, modules may become `[]` when structural analysis exists, and status is promoted to `partial` when appropriate.

Built-in plugins return `contributions` (the preferred path). The optional `result.knowledge` field remains for backward compatibility when both are present, `knowledge` wins with a warning.

---

## Built-in plugins

These wrap existing analyzers and map to pipeline steps 9–13:

| Plugin ID | Pipeline step | Source analyzer |
|---|---|---|
| `builtin.folder-analyzer` | Analyze Folder Knowledge | `folder-analyzer.ts` |
| `builtin.module-analyzer` | Analyze Modules | `module-analyzer.ts` |
| `builtin.dependency-analyzer` | Analyze Dependency Graph | `dependency-graph-analyzer.ts` |
| `builtin.convention-analyzer` | Analyze Conventions | `convention-analyzer.ts` |
| `builtin.navigation-analyzer` | Build AI Navigation Map | `navigation-map-analyzer.ts` |

---

## Technology plugins (placeholders)

| Plugin ID | Framework | Status |
|---|---|---|
| `technology.angular` | Angular | `supports()` with framework + `angular.json` detection |
| `technology.react` | React | `supports()` only |
| `technology.nest` | NestJS | `supports()` only |
| `technology.node` | Node.js | `supports()` only |

No technology plugin performs analysis yet. They return `skipped` when invoked.

---

## Plugin discovery

v1 uses **static registration** in `PluginRegistry`. All built-in and technology plugins are imported at compile time.

The registry API (`register()`, `getById()`, `listAnalyzerPlugins()`) is designed so future discovery modes can be added without changing the core:

- **npm plugins** — load packages that export a `Plugin` or `AnalyzerPlugin`
- **local plugins** — load from a configured directory in the target repository
- **enterprise plugins** — private registry packages with signed manifests

Dynamic loading is intentionally **not implemented** in v1. The architecture supports it; the runtime does not load external modules yet.

---

## Responsibilities

### Core must

- Load the repository within `RepositoryBoundary`
- Build and persist the PKM
- Execute plugins through `PluginManager`
- Merge `PluginResult` contributions
- Run generators and exporters from the merged PKM

### Core must not

- Contain framework-specific analysis logic
- Let plugins bypass `RepositoryBoundary`
- Let plugins read raw `process.argv` or pipeline internals
- Re-scan the repository inside plugins (consume PKM instead)
- Call analyzer enrich functions directly from pipeline handlers (use `PluginManager`)

### Plugins must

- Consume `ProjectKnowledge` through `PluginContext`
- Return `PluginResult` with `contributions` (preferred) or pre-merged `knowledge` (legacy)
- Use `context.boundary` for any permitted file reads
- Declare `supports()` accurately so irrelevant plugins are skipped

### Plugins must not

- Modify project source files
- Write to disk (generators and exporters own output)
- Call OpenRouter or external AI services (optional AI enrichment is a core pipeline step)

---

## Best practices

1. **Consume PKM, never rescan.** The repository tree is scanned once. Plugins read `knowledge.repository.repositoryTree` and prior `analysis.*` sections.
2. **Keep plugins small.** One plugin, one responsibility. Framework-specific module discovery belongs in a technology plugin, not in the folder analyzer.
3. **Return evidence and confidence.** Contributions should include the same structured evidence the built-in analyzers provide.
4. **Prefer contributions over direct mutation.** Return `PluginContributions` so `PluginManager` owns merge semantics.
5. **Use `context.boundary`.** Do not create a new `RepositoryBoundary` inside analyzer logic when the plugin already receives one.
6. **Version your plugin.** Use semver in `version`. Breaking PKM contribution shapes require a major bump.
7. **Test with fixtures.** Plugin tests should use minimal `ProjectKnowledge` fixtures, not full repository scans.

---

## Versioning

| Layer | Version field | Meaning |
|---|---|---|
| PKM | `metadata.schemaVersion` | Shape of `ProjectKnowledge` |
| Plugin | `version` | Plugin API and contribution contract |
| Generator | `metadata.generatorVersion` | Tool release that produced the PKM |

When a plugin changes its contribution shape, bump the plugin `version` and document the migration in `docs/change-log.md` (human) or plugin release notes (future marketplace).

---

## Future marketplace support

The static registry is the v1 bootstrap. A future marketplace would:

1. Publish plugins as npm packages with a `ai-project-docs-plugin` keyword
2. Declare compatibility via `engines.ai-project-docs` in `package.json`
3. Export a default plugin or plugin array from the package entry point
4. Be loaded by a `PluginLoader` that validates signatures, semver, and sandbox boundaries

`PluginRegistry.register()` and `PluginManager` are the extension points. The core merge and pipeline execution paths do not need to change when dynamic loading arrives.

---

## Related documentation

- [`docs/architecture.md`](architecture.md) — system layers and pipeline diagram
- [`docs/context-engineering.md`](context-engineering.md) — why plugins consume PKM
- [`src/plugins/README.md`](../src/plugins/README.md) — module-level API reference
- [`AGENTS.md`](../AGENTS.md) — contributor guide for creating plugins
