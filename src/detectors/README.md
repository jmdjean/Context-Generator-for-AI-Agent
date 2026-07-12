# src/detectors

**Responsibility:** Technology detection — inferring the language stack, frameworks, tooling, and package manager from repository metadata and nested project manifests visible in the scanned tree.

This module reads allowlisted config and manifest files under the repository root (via paths from `RepositoryInfo` / the repository tree). It does not scrape arbitrary source files or call external services.

---

## Files

| File | Role |
|---|---|
| `technology-detector.ts` | Builds a `TechnologyProfile` from `RepositoryInfo` (aggregates nested manifests) |
| `package-manager-detector.ts` | Detects the package manager from lockfiles |
| `repository-paths.ts` | Helpers to list/find paths in the repository tree |

---

## What technology detection does

`detectTechnologies(repositoryInfo)` inspects searchable paths from `repositoryTree` when present (otherwise top-level `detectedFiles`). It reads **every** `package.json` in that set and aggregates dependency signals:

| Array | Detection source |
|---|---|
| `languages` | Config/manifest presence (`tsconfig.json` → TypeScript; nested `pom.xml` → Java; `*.csproj` → C#; `go.mod` → Go; `Cargo.toml` → Rust; `pyproject.toml`/`setup.cfg` → Python; Docker files → Docker) |
| `frameworks` | Package deps across **all** nested `package.json` files (`express` → Express, `react` → React, …) |
| `tooling` | Config + package deps (`tsconfig.json` → TypeScript; `jest`, `eslint`, …) |
| `packageManagers` | Lockfile presence (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`) |

Frameworks are never invented: only dependency names present in manifests are reported. Deep framework analysis stays in `src/plugins/technology/`.

The overall `confidence` field is `high` when languages are detected from an explicit config/manifest, `medium` when inferred only from `package.json`, and `low` when nothing is detected.

---

## Why detection uses the repository tree (not a full source scrape)

Detection consumes the scanned `repositoryTree` path list (or top-level `detectedFiles` when no tree exists) and reads only known manifest/config filenames. Nested `package.json` files and non-JS project manifests are included so multi-package repos are not reported as “frameworks: none”. Arbitrary source files are never parsed here.

Deeper framework-specific analysis belongs in `src/plugins/technology/`, not in this shallow aggregator.

---

## Why this helps AI agents choose the right documentation strategy

When an AI agent generates documentation for an Angular project, it should know to document NgModules, services, and dependency injection. For a Next.js project, it should document pages, API routes, and data fetching patterns. For an Express API, it should document routes and middleware.

Without technology detection, the AI stage would need to infer the stack from raw source files — wasting tokens and increasing the chance of hallucination. `TechnologyProfile` provides a pre-computed, high-confidence signal so the AI stage can focus on what matters.

---

## Currently detected

### Languages
- `TypeScript` — from `tsconfig.json` (root or nested)
- `JavaScript` — from `package.json` (only when no `tsconfig.json`)
- `Docker` — from `Dockerfile` or `docker-compose.yml`
- `Java` — from nested `pom.xml` / `build.gradle` / `build.gradle.kts`
- `C#` — from nested `*.csproj` / `*.fsproj`
- `Go` — from `go.mod`
- `Rust` — from `Cargo.toml`
- `Python` — from `pyproject.toml` / `setup.cfg`

### Frameworks (from package deps across all nested package.json files)
Angular, React, Vue, Svelte, Next.js, Nuxt, NestJS, Express

### Tooling (config files + package deps)
TypeScript, Docker, Vite, Jest, Vitest, Cypress, Playwright, ESLint, Prettier

### Package managers (from lockfiles)
pnpm, yarn, npm, bun

---

## Where future framework-specific analyzers should be added

Shallow package.json-based detection has limits. A project might use React without a detectable pattern, or it might declare a dependency that is unused. Framework-specific depth belongs in `src/plugins/technology/`:

- **Deeper config parsing** (e.g. reading `angular.json`) → technology plugin, not core aggregation.
- **Language version detection** (Node.js version from `.nvmrc` or `package.engines`) → add a `runtime-detector.ts`.
- **Monorepo detection** (Turborepo, Nx, Lerna config files) → add a `monorepo-detector.ts`.
- **Container / infra detection** (Kubernetes manifests, Terraform files) → add an `infra-detector.ts`.

Each new detector should accept `RepositoryInfo` (with `repositoryTree` when available) and return data that can be merged into `TechnologyProfile` or a new domain type.

---

## Exports

### `detectTechnologies(repositoryInfo: RepositoryInfo): TechnologyProfile`

Primary entry point. Calls `detectPackageManager` internally.

### `detectPackageManager(repositoryInfo: RepositoryInfo): string`

Returns the first matched package manager name, or `'unknown'` if no lockfile is present. Priority: pnpm → yarn → npm → bun.

---

## What belongs here

- Detection functions that read `RepositoryInfo.detectedFiles` or `RepositoryInfo.rootPath`.
- Safe reads of well-known top-level files (`package.json`, lock files, known config files).
- Mapping from dependency names or filenames to human-readable technology labels.

## What does NOT belong here

- Directory walking — that belongs in `src/scanner/`.
- AI calls — that belongs in `src/ai/`.
- Writing files — that belongs in `src/docs/`.
- Domain type definitions — those stay in `src/domain/`.
