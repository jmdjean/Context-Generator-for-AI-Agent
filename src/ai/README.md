# src/ai

**Responsibility:** Optional AI analysis that enriches the Project Knowledge Model (PKM) through pluggable providers.

AI analysis is **opt-in** (`--ai` flag) and **non-authoritative**. Deterministic analyzers remain the source of truth. The AI layer receives a compact PKM summary only — no source code, no secrets, no direct filesystem access.

## Layout

| File | Role |
|---|---|
| `ai-analysis-service.ts` | Architecture-stage orchestration: build prompt → call provider → parse/validate JSON → write `stagedDocumentation.architecture` (+ legacy `aiInsights`) |
| `module-documentation-stage.ts` | Per-module AI fan-out: one sequential generation per `modulePlan` entry → `stagedDocumentation.moduleResults` |
| `staged-documentation.ts` | Helpers for upserting staged PKM execution/status without mutating unrelated sections |
| `prompt-builder.ts` | Owns every string sent to providers: system instructions and compact PKM / module prompts |
| `providers/` | Provider contract, registry, factory, and concrete provider implementations |
| `openrouter-client.ts` | Low-level OpenRouter HTTP client (retries, timeout, usage parsing) |
| `constants.ts` | Shared limits and response schema constants |

## Provider architecture

The analysis service depends on the `AIProvider` contract, never on a concrete backend:

```
runAiAnalysis(knowledge, { apiKey, model, providerId })
        │
        ├─ prompt-builder      → prompt string (compact PKM summary)
        ├─ provider-factory    → resolves AIProvider from the registry
        │                        (default: openrouter; unsupported id → clear error)
        ├─ provider.analyze(prompt, { apiKey, model })
        │                        OpenRouterProvider → OpenRouterClient → HTTPS
        └─ parse + validate JSON → knowledge.analysis.aiInsights
```

- **`providers/ai-provider.ts`** — `AIProvider` (`id`, `name`, `supports()`, `analyze()`), `AIProviderOptions` (`apiKey`, `model`, `temperature?`, `maxTokens?`), and `AIProviderResponse` (`content`, `model`, `provider`, `usage?`, `raw?`).
- **`providers/openrouter-provider.ts`** — wraps `OpenRouterClient`; default provider (`openrouter`).
- **`providers/openai-provider.ts`** — OpenAI Chat Completions transport via `fetch` (`openai`).
- **`providers/provider-registry.ts`** — holds registered providers; resolves ids case-insensitively.
- **`providers/provider-factory.ts`** — `createAiProvider(providerId)` with a user-facing error for unsupported ids; also exposes `DEFAULT_AI_PROVIDER_ID` and the supported-id helpers used by CLI config validation.

### Adding a future provider (Anthropic, Gemini, Azure OpenAI, Ollama, local models)

1. Create `providers/<name>-provider.ts` implementing `AIProvider`. The provider receives a fully assembled prompt string and returns raw model output — it must not build prompts, read PKM data, or touch the filesystem.
2. Register it in `createDefaultAiProviderRegistry()` (`providers/provider-registry.ts`).
3. Done — `ai-analysis-service.ts`, the prompt builder, CLI validation, and `--ai-provider <name>` pick it up automatically. Do not modify the analysis service for a new backend.

## Safety rules

- Providers never scan source files or repositories — they receive prompt strings only.
- `prompt-builder.ts` controls exactly what PKM summary is sent (with truncation metadata and confidence-based prioritization).
- Providers never mutate source code or the PKM; only the analysis service writes `analysis.aiInsights`.
- AI insights are enrichment; deterministic PKM sections remain authoritative.

## What does NOT belong here

- File I/O of any kind — network I/O only.
- Repository scanning or deterministic analysis — those live in `scanner/` and `analyzers/`.
- Writing Markdown or JSON to disk — generators and `knowledge-writer.ts` handle persistence.
- Reading `process.argv` or `process.env` — configuration flows through `RuntimeConfig`.

## Pipeline integration

Step **Generate Architecture Context** runs after deterministic analyzers (navigation map) and before the module-plan stage, only when:

1. `--ai` is provided, and
2. An API key is resolved for the selected provider (`--openrouter-key` / `OPENROUTER_API_KEY`, or the OpenAI equivalents).

If the key is missing, the step is skipped with a clear warning. Invalid AI responses, markdown-fenced JSON that fails validation, network errors, or an unavailable provider warn and continue — they never fail the pipeline. Failures still record `analysis.stagedDocumentation.architecture` with `status: failed` for observability.

`runArchitectureStage()` writes:

- `analysis.stagedDocumentation.architecture` (summary, content, document paths, status, provider/model)
- `analysis.stagedDocumentation.execution` entry for `architecture`
- legacy `analysis.aiInsights` so existing renderers keep working

**Generate Module Documentation Plan** is deterministic (no AI) and lives in `src/docs/documentation-planner.ts`.

**Generate Module Documentation** runs after the module plan when `--ai` and an API key are available. It calls `runModuleDocumentationStage()` which:

1. Reads `analysis.stagedDocumentation.modulePlan.entries` and architecture-stage context from PKM (never filesystem scraping).
2. Runs **one sequential** provider call per planned module.
3. Writes each result into `analysis.stagedDocumentation.moduleResults` with `completed` / `failed` status.
4. Mirrors per-entry status back onto `modulePlan.entries` and records a `module-documentation` execution row.

Failures are isolated: one invalid module response does not stop the remaining modules (overall status becomes `partial`). Empty module plans skip without calling the provider.

## PKM output

```typescript
analysis.stagedDocumentation?.architecture?: {
  status: 'completed' | 'failed' | …;
  summary?: string;
  content?: string;
  documentPaths: string[];
  generatedAt?: string;
  provider?: string;
  model?: string;
  warnings: string[];
  error?: string;
}

analysis.aiInsights?: {
  architectureSummary?: string;
  risks?: string[];
  recommendations?: string[];
  agentGuidance?: string[];
  generatedAt: string;
  model: string;
}

analysis.stagedDocumentation?.moduleResults?: {
  status: 'completed' | 'partial' | 'failed' | …;
  results: Array<{
    moduleId: string;
    moduleName: string;
    documentPath: string;
    status: StagedDocumentationStatus;
    summary?: string;
    content?: string;
    warnings: string[];
    error?: string;
  }>;
  warnings: string[];
}
```

## CLI surface

- `--ai` — enable AI analysis (off by default)
- `--ai-provider <name>` — select the provider (default: `openrouter`; unsupported names fail with the supported list)
- `--model <id>` — model id passed to the provider (default: `openai/gpt-4.1-mini`)
- `--openrouter-key <key>` / `OPENROUTER_API_KEY` — OpenRouter authentication

## Public API

```typescript
import { runArchitectureStage, runModuleDocumentationStage } from './ai';

const architecture = await runArchitectureStage(projectKnowledge, {
  apiKey: config.openRouterApiKey!,
  model: config.aiModel,
  providerId: config.aiProvider,
});

const modules = await runModuleDocumentationStage(architecture.knowledge, {
  apiKey: config.openRouterApiKey!,
  model: config.aiModel,
  providerId: config.aiProvider,
});
// modules.knowledge.analysis.stagedDocumentation.moduleResults when attempted
```

Tests inject a fake `provider` instead of stubbing HTTP.

## Downstream presentation

Markdown renderers in `src/docs/markdown-renderers/` consume staged PKM sections when writing documentation. Architecture/ai-context prefer `stagedDocumentation.architecture` (falling back to legacy `aiInsights`). Per-module cards under `code/components/` read `stagedDocumentation.moduleResults`. Renderers and exporters never call AI providers — they only read already-persisted PKM data. Deterministic analyzers remain authoritative; AI output is optional enrichment.
