# Task 01 - Multi-manifest module discovery

## Objective

Discover application/library modules from multi-ecosystem project manifests (not only `apps/`/`packages/` path heuristics), and exclude the configured `docsDir` from product-oriented AI module fan-out.

## Why This Task Exists

Without correct modules, later AI stages document `docs/` and the output folder instead of real packages. This unblocks the entire plan.

## Scope

- Extend module classification to treat folders that own known manifests as modules:
  - JS/TS: `package.json` (+ workspace members when present)
  - .NET: `*.csproj` / `*.fsproj` (and children of solution layouts when detectable from the tree)
  - Java/Kotlin: `pom.xml`, `build.gradle`, `build.gradle.kts`
  - Go: `go.mod`
  - Rust: `Cargo.toml`
  - Python: `pyproject.toml` / `setup.cfg` when they clearly scope a package
- Keep existing `apps/*`, `packages/*`, `libs/*`, `src/*` heuristics
- Provide a clear rule so `docsDir` remains a documentation module in PKM but is skipped for product AI fan-out (shared helper or module flag)
- Fixtures + unit tests for root-level JS packages and at least one non-JS manifest signal

## Out Of Scope

- Operational context / env / scripts extraction (Task 02)
- Technology framework aggregation (Task 03)
- AI prompts or Markdown renderer changes
- Reading arbitrary source files beyond safe manifest/config names via `RepositoryBoundary`

## Likely Files Or Areas

- `src/analyzers/module-classifier.ts`
- `src/analyzers/module-constants.ts`
- `src/analyzers/module-analyzer.ts`
- `src/analyzers/folder-constants.ts` (safe file name allowlists if needed)
- `src/plugins/builtin/module-analyzer-plugin.ts`
- `src/analyzers/module-classifier.test.ts`, `src/analyzers/module-analyzer.test.ts`
- `test/fixtures/` (new root-package and non-JS-manifest fixtures)

## Dependencies

- None

## Implementation Notes

- Stack-agnostic: no Angular/Electron assumptions
- Safe reads only through `PluginContext.boundary`
- Do not invent modules without a path or manifest signal
- Preserve documentation modules (`docs`, docsDir) in `analysis.modules` if useful for maps, but mark or filter them out of AI product fan-out

## Deliverables

- Manifest-aware module discovery working for root packages and non-JS signals
- Helper or convention to skip documentation-only modules in AI fan-out consumers
- Passing unit tests + fixtures

## Validation

- `npm run build`
- `npm test` (at least module-classifier / module-analyzer tests)
- Fixture asserting root `bridge-server`-style + nested `pom.xml` or `*.csproj` modules are discovered

## Suggested Agent Brief

Implement Task 01 from `ai-tasks/01-multi-manifest-module-discovery.md`. Read `AGENTS.md`, `src/analyzers/README.md`, and the module classifier before coding. Extend discovery for multi-ecosystem manifests via boundary-safe reads, keep path heuristics, exclude docsDir from product AI fan-out, add fixtures/tests. Do not touch AI prompts or renderers.
