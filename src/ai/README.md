# src/ai

**Responsibility:** Optional OpenRouter AI analysis that enriches the Project Knowledge Model (PKM).

AI analysis is **opt-in** (`--ai` flag) and **non-authoritative**. Deterministic analyzers remain the source of truth. The AI layer receives a compact PKM summary only — no source code, no secrets, no direct filesystem access.

## What belongs here

- Building prompts from summarized `ProjectKnowledge` data (`prompt-builder.ts`).
- Shared limits and schema constants (`constants.ts`).
- Calling the OpenRouter chat completions API (`openrouter-client.ts`).
- Parsing, normalizing, and validating structured JSON responses (`ai-analysis-service.ts`).
- Mapping validated output into `knowledge.analysis.aiInsights`.

## What does NOT belong here

- File I/O of any kind — network I/O only.
- Repository scanning or deterministic analysis — those live in `scanner/` and `analyzers/`.
- Writing Markdown or JSON to disk — generators and `knowledge-writer.ts` handle persistence.
- Reading `process.argv` or `process.env` — configuration flows through `RuntimeConfig`.

## Pipeline integration

Step **Analyze AI Insights** runs after deterministic analyzers (navigation map) and before **Write Documentation**, only when:

1. `--ai` is provided, and
2. An OpenRouter API key is resolved (`--openrouter-key` or `OPENROUTER_API_KEY`).

If the key is missing, the step is skipped with a clear warning. Invalid AI responses, markdown-fenced JSON that fails validation, or network errors warn and continue — they never fail the pipeline.

The prompt includes truncation metadata and prioritizes high-confidence modules, folders, and conventions. Parsed insights are length-capped before being written to the PKM.

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

## API details

- Provider: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
- Authentication: `Authorization: Bearer <OPENROUTER_API_KEY>`
- Default model: `openai/gpt-4.1-mini` (override with `--model`)

## Public API

```typescript
import { runAiAnalysis } from './ai-analysis-service';

const result = await runAiAnalysis(projectKnowledge, {
  apiKey: config.openRouterApiKey!,
  model: config.aiModel,
});
// result.knowledge.analysis.aiInsights when successful
```

## Downstream presentation

Markdown renderers in `src/docs/markdown-renderers/` consume `analysis.aiInsights` when writing documentation. They append a labeled **AI Insights** section to `architecture.md`, `ai-context.md`, `implementation-guide.md`, and `agent-navigation.md` after deterministic PKM content. Renderers never call OpenRouter — they only read already-persisted PKM data. Deterministic analyzers remain authoritative; AI output is optional enrichment.
