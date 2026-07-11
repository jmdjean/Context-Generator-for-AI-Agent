# src/ai/providers

**Responsibility:** Pluggable AI backend providers behind a single transport contract.

The analysis service (`src/ai/ai-analysis-service.ts`) depends only on the `AIProvider` interface. Concrete backends live here and are resolved by id through the registry/factory. Built-in providers today: **OpenRouter** (default) and **OpenAI**.

| File | Role |
|---|---|
| `ai-provider.ts` | `AIProvider` contract, `AIProviderOptions`, `AIProviderResponse`, id normalization |
| `openrouter-provider.ts` | Default provider; wraps `../openrouter-client.ts` |
| `openai-provider.ts` | OpenAI Chat Completions transport via `fetch` |
| `provider-registry.ts` | Registration and case-insensitive resolution of providers |
| `provider-factory.ts` | `createAiProvider()`, `DEFAULT_AI_PROVIDER_ID`, supported-id helpers for CLI validation |

## Provider rules

- A provider is a **transport**: it receives a fully assembled prompt string and returns the model's raw output plus metadata (`model`, `provider`, `usage?`, `raw?`).
- Providers never build prompts, read the PKM, scan repositories, touch the filesystem, or mutate anything. Prompt content is owned by `../prompt-builder.ts`; response interpretation by `../ai-analysis-service.ts`.
- `supports(providerId)` must match the provider's own id case-insensitively (use `normalizeAiProviderId`).
- Errors should throw — the analysis service catches them, warns, and continues without insights.

## Adding a provider

1. Implement `AIProvider` in `<name>-provider.ts` (accept injected client/fetch dependencies for tests).
2. Register it in `createDefaultAiProviderRegistry()`.
3. Nothing else changes: the analysis service, CLI `--ai-provider` validation, and help text pick it up from the registry.

Planned future providers: Anthropic, Google Gemini, Azure OpenAI, Ollama, local models.
