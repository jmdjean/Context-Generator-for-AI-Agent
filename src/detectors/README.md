# src/detectors

**Responsibility:** Technology detection — inferring the language stack, frameworks, tooling, and package manager from top-level repository metadata.

This module reads only what `RepositoryInfo` already knows (top-level filenames and `package.json` content). It does not walk directories, parse source files, or call external services.

---

## Files

| File | Role |
|---|---|
| `technology-detector.ts` | Builds a `TechnologyProfile` from `RepositoryInfo` |
| `package-manager-detector.ts` | Detects the package manager from top-level lockfiles |

---

## What technology detection does

`detectTechnologies(repositoryInfo)` inspects the top-level filenames in `RepositoryInfo.detectedFiles` and, when `package.json` is present, reads its `dependencies` and `devDependencies`. From these two sources it populates all four arrays of `TechnologyProfile`:

| Array | Detection source |
|---|---|
| `languages` | Config file presence (`tsconfig.json` → TypeScript; no tsconfig + `package.json` → JavaScript; `Dockerfile` / `docker-compose.yml` → Docker) |
| `frameworks` | Package deps (`@angular/core` → Angular, `react` → React, `vue` → Vue, …) |
| `tooling` | Config file presence + package deps (`tsconfig.json` → TypeScript; `jest`, `eslint`, `prettier`, …) |
| `packageManagers` | Lockfile presence (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`) |

The overall `confidence` field is `high` when languages are detected from an explicit config file, `medium` when inferred only from `package.json`, and `low` when nothing is detected.

---

## Why detection uses only safe top-level metadata

Walking the full repository tree is expensive and risky for large repositories. Top-level config files (`tsconfig.json`, `package.json`, lockfiles, `Dockerfile`) reliably identify the primary technology stack of any project. This targeted approach:

- Keeps detection fast and predictable regardless of project size.
- Avoids reading files outside the root that could be large binaries or auto-generated.
- Provides enough signal for the AI stage to choose the right documentation strategy.

Deeper analysis (framework-specific conventions, module boundaries, dependency graphs) belongs in the Analyze Architecture step (step 6), not here.

---

## Why this helps AI agents choose the right documentation strategy

When an AI agent generates documentation for an Angular project, it should know to document NgModules, services, and dependency injection. For a Next.js project, it should document pages, API routes, and data fetching patterns. For an Express API, it should document routes and middleware.

Without technology detection, the AI stage would need to infer the stack from raw source files — wasting tokens and increasing the chance of hallucination. `TechnologyProfile` provides a pre-computed, high-confidence signal so the AI stage can focus on what matters.

---

## Currently detected

### Languages
- `TypeScript` — from `tsconfig.json`
- `JavaScript` — from `package.json` (only when no `tsconfig.json`)
- `Docker` — from `Dockerfile` or `docker-compose.yml`

### Frameworks (from package deps)
Angular, React, Vue, Svelte, Next.js, Nuxt, NestJS, Express

### Tooling (config files + package deps)
TypeScript, Docker, Vite, Jest, Vitest, Cypress, Playwright, ESLint, Prettier

### Package managers (from lockfiles)
pnpm, yarn, npm, bun

---

## Where future framework-specific analyzers should be added

Shallow package.json-based detection has limits. A project might use React without a detectable pattern, or it might declare a dependency that is unused. Future improvements belong here in `src/detectors/`, not in the pipeline orchestrator or CLI:

- **Deeper config parsing** (e.g. reading `angular.json` to confirm Angular architecture version) → add a new `angular-detector.ts` and call it from `technology-detector.ts`.
- **Language version detection** (Node.js version from `.nvmrc` or `package.engines`) → add a `runtime-detector.ts`.
- **Monorepo detection** (Turborepo, Nx, Lerna config files) → add a `monorepo-detector.ts`.
- **Container / infra detection** (Kubernetes manifests, Terraform files) → add an `infra-detector.ts`.

Each new detector should accept `RepositoryInfo` (or a future `RepositoryNode` tree for deeper analysis) and return data that can be merged into `TechnologyProfile` or a new domain type.

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
