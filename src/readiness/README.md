# src/readiness

Deterministic **AI Readiness Score** — a lightweight Context Engineering quality assessment that measures how prepared a repository is for safe and effective work by AI coding agents.

## What the score measures

Six weighted categories, each scored 0–100 from deterministic findings:

| Category | Weight | Evaluates |
|---|---|---|
| Repository Structure | 20% | Repository tree, source folder identification, ignored/generated folder exclusion, inferred folder responsibilities, module discovery |
| Architecture Knowledge | 20% | Modules, module responsibilities, dependency graph, evidence-backed edges, detected architecture boundaries |
| Documentation Coverage | 20% | Documentation plan, presence of the required context documents (`architecture.md`, `folder-structure.md`, `dependency-map.md`, `conventions.md`, `agent-navigation.md`, `ai-context.md`, `implementation-guide.md`), validation status |
| Agent Navigation | 15% | Navigation map presence, common task coverage, recommended documents, warnings, references grounded in the PKM |
| Project Conventions | 15% | Structured conventions, evidence, testing conventions, package manager convention, TypeScript strict mode, generated-context rules |
| Context Maintainability | 10% | PKM persistence, schema version, validation, incremental change detection, selective regeneration, protection markers |

The overall score is the weighted average of category scores (weights total 100%), clamped and rounded into 0–100, then mapped to a level: `critical` (0–29), `low` (30–49), `moderate` (50–69), `good` (70–84), `excellent` (85–100).

## What it does not guarantee

The score assesses the **generated context**, not the code. It does not guarantee implementation quality, correctness, security, or test coverage, and it does not replace human review. A low score is an assessment result, never a runtime failure: the CLI still exits `0`.

## Why scoring is deterministic

The calculator consumes only the final current-run PKM and the documentation validation result. It never rescans the repository, never calls an AI provider, never mutates source code, and never writes Markdown itself. `calculatedAt` is anchored to the PKM snapshot timestamp, so **identical PKM input produces byte-identical output** — a hard requirement for comparing scores between runs. Optional AI insights (`--ai`) are deliberately excluded: non-deterministic input would make scores unreproducible and turn the assessment into an opinion.

Scoring rules are versioned (`AI_READINESS_SCORING_VERSION`, persisted as `scoringVersion`). Any change to a rule, weight, or threshold requires a version bump.

## How findings are scored

Each finding earns points against its `maxPoints`: `passed` = full, `partial` = half, `failed` = zero. `not-applicable` findings are excluded from the category denominator so tiny or empty repositories are not unfairly penalized (for example, no penalty for missing modules or dependency edges when the repository has almost no source files, and no penalty on the initial run for missing incremental state). Checks use repository size and available PKM signals rather than raw array lengths.

Strengths, gaps, and recommendations are all derived from findings: strengths are the highest-impact passed findings, gaps the highest-impact failed/partial findings (`failed` = critical severity), and every recommendation is tied to a specific partial or failed finding — generic advice unsupported by findings is never emitted.

## Files

| File | Responsibility |
|---|---|
| `ai-readiness-model.ts` | Pure types (`AIReadinessKnowledge`, categories, findings, gaps, recommendations), level boundaries, clamp/round helpers. No imports from the PKM — this is the leaf `src/knowledge` references. |
| `ai-readiness-rules.ts` | Versioned deterministic scoring rules: repository signals, category definitions, weights, finding builders, and grounded recommendation actions. |
| `ai-readiness-calculator.ts` | Pure calculation: builds findings via the rules, scores categories, computes the weighted overall score, and derives strengths/gaps/recommendations. Enriches `analysis.aiReadiness`. |
| `ai-readiness-renderer.ts` | Presentation only: renders `ai-readiness.md` through the template registry and formats the pipeline console report. |

## Pipeline and persistence

The `Calculate AI Readiness` step runs after `Validate Documentation` and before final persistence. It enriches `analysis.aiReadiness` (the PKM remains the source of truth), refreshes `ai-readiness.md` through the registered template (protection markers respected), persists `.ai-docs/knowledge/ai-readiness.json`, and extends validation with structural checks (score range, weight total, grounded recommendations, persisted files). The result is also embedded in `.ai-docs/knowledge/analysis.json` and the full PKM snapshot.

## Plugins and future findings

Plugins may contribute findings in the future, but they must not set the final score directly — the calculator alone owns category scoring and the weighted aggregate, keeping the score comparable across repositories and rule versions. History tracking, badges, and dashboards are intentionally out of scope for now.
