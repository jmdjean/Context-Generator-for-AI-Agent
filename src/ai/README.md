# src/ai

**Responsibility:** AI provider integration (OpenRouter).

This module takes a `RepositorySnapshot` and returns structured documentation content by calling an AI model through the OpenRouter API. It owns prompt construction, API communication, response parsing, and retry logic.

## What belongs here

- Building prompts from `RepositorySnapshot` data.
- Calling the OpenRouter API.
- Parsing and validating the model's response into a structured format.
- Retry logic for transient network or rate-limit errors (exponential back-off).

## What does NOT belong here

- File I/O of any kind — this module is purely network I/O.
- Business decisions about what documentation sections to generate — those come from config.
- Writing results to disk — that belongs in `docs/`.

## Current status

Not yet implemented. Placeholder for the AI integration layer.

## Expected interface (planned)

```typescript
export interface AiClient {
  generateDocumentation(
    snapshot: RepositorySnapshot,
    config: Config
  ): Promise<DocumentationContent>;
}

export function createAiClient(apiKey: string, model: string): AiClient
```

## API details (planned)

- Provider: OpenRouter (`https://openrouter.ai/api/v1`)
- Authentication: `Authorization: Bearer <OPENROUTER_API_KEY>`
- Default model: configurable, no hardcoded default in source
