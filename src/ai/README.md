# src/ai

**Responsibility:** Optional AI analysis that enriches the Project Knowledge Model (PKM) through pluggable providers.

AI analysis is **opt-in** (`--ai` flag) and **non-authoritative**. Deterministic analyzers remain the source of truth. The AI layer receives a compact PKM summary only — no source code, no secrets, no direct filesystem access.

## Layout

| File | Role |
|---|---|
| `ai-analysis-service.ts` | Provider-agnostic orchestration: build prompt → call provider → parse/validate JSON → write `analysis.aiInsights` |
| `prompt-builder.ts` | Owns every string sent to providers: the system instruction and the compact PKM summary prompt |
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
- **`providers/openrouter-provider.ts`** — wraps `OpenRouterClient`; the only built-in provider today and the default.
- **`providers/provider-registry.ts`** — holds registered providers; resolves ids case-insensitively.
- **`providers/provider-factory.ts`** — `createAiProvider(providerId)` with a user-facing error for unsupported ids; also exposes `DEFAULT_AI_PROVIDER_ID` and the supported-id helpers used by CLI config validation.

### Adding a future provider (OpenAI, Anthropic, Gemini, Azure OpenAI, Ollama, local models)

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

Step **Analyze AI Insights** runs after deterministic analyzers (navigation map) and before **Write Documentation**, only when:

1. `--ai` is provided, and
2. An API key is resolved (`--openrouter-key` or `OPENROUTER_API_KEY`).

If the key is missing, the step is skipped with a clear warning. Invalid AI responses, markdown-fenced JSON that fails validation, network errors, or an unavailable provider warn and continue — they never fail the pipeline.

## PKM output

```typescript
analysis.aiInsights?: {
  architectureSummary?: string;
  risks?: string[];
  recommendations?: string[];
  agentGuidance?: string[];
  generatedAt: string;
  model: string;
}
```

## CLI surface

- `--ai` — enable AI analysis (off by default)
- `--ai-provider <name>` — select the provider (default: `openrouter`; unsupported names fail with the supported list)
- `--model <id>` — model id passed to the provider (default: `openai/gpt-4.1-mini`)
- `--openrouter-key <key>` / `OPENROUTER_API_KEY` — OpenRouter authentication

## Public API

```typescript
import { runAiAnalysis } from './ai-analysis-service';

const result = await runAiAnalysis(projectKnowledge, {
  apiKey: config.openRouterApiKey!,
  model: config.aiModel,
  providerId: config.aiProvider, // optional, defaults to 'openrouter'
});
// result.knowledge.analysis.aiInsights when successful
```

Tests inject a fake `provider` instead of stubbing HTTP.

## Downstream presentation

Markdown renderers in `src/docs/markdown-renderers/` consume `analysis.aiInsights` when writing documentation. They append a labeled **AI Insights** section to `architecture.md`, `ai-context.md`, `implementation-guide.md`, and `agent-navigation.md` after deterministic PKM content. Renderers and exporters never call AI providers — they only read already-persisted PKM data. Deterministic analyzers remain authoritative; AI output is optional enrichment.
