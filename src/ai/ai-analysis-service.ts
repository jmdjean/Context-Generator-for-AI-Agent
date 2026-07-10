import { AiInsightsKnowledge, ProjectKnowledge } from '../knowledge';
import { sanitizeAiInsightText } from '../utils/ai-text-sanitizer';
import { AI_INSIGHTS_LIMITS } from './constants';
import { AIProvider } from './providers/ai-provider';
import { createAiProvider, DEFAULT_AI_PROVIDER_ID } from './providers/provider-factory';
import { buildAiAnalysisPrompt } from './prompt-builder';

export interface AiAnalysisServiceConfig {
  apiKey: string;
  model: string;
  /** Provider id resolved through the registry. Defaults to openrouter. */
  providerId?: string;
  /** Injected provider instance (tests, embedders). Takes precedence over providerId. */
  provider?: AIProvider;
}

export interface AiAnalysisServiceResult {
  knowledge: ProjectKnowledge;
  insightsGenerated: boolean;
  attempted: boolean;
  warnings: string[];
  message: string;
}

interface ParsedAiInsightsResponse {
  architectureSummary?: string;
  risks?: string[];
  recommendations?: string[];
  agentGuidance?: string[];
}

const JSON_FENCE_BLOCK_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function trimToMaxLength(value: string, maxLength: number): string {
  const trimmed = sanitizeAiInsightText(value);
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function normalizeStringArray(values: string[]): string[] {
  return values
    .map((item) => trimToMaxLength(item, AI_INSIGHTS_LIMITS.maxItemLength))
    .filter((item) => item.length > 0)
    .slice(0, AI_INSIGHTS_LIMITS.maxArrayItems);
}

export function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fenced = JSON_FENCE_BLOCK_PATTERN.exec(trimmed);
  if (fenced) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parseAiInsightsResponse(raw: string): ParsedAiInsightsResponse | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonPayload(raw));
  } catch {
    return undefined;
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  const result: ParsedAiInsightsResponse = {};

  if (record['architectureSummary'] !== undefined) {
    if (!isNonEmptyString(record['architectureSummary'])) {
      return undefined;
    }
    result.architectureSummary = trimToMaxLength(
      record['architectureSummary'],
      AI_INSIGHTS_LIMITS.maxArchitectureSummaryLength,
    );
  }

  for (const field of ['risks', 'recommendations', 'agentGuidance'] as const) {
    if (record[field] === undefined) {
      continue;
    }
    if (!isStringArray(record[field])) {
      return undefined;
    }
    const normalized = normalizeStringArray(record[field]);
    if (normalized.length > 0) {
      result[field] = normalized;
    }
  }

  const hasContent =
    result.architectureSummary !== undefined ||
    (result.risks?.length ?? 0) > 0 ||
    (result.recommendations?.length ?? 0) > 0 ||
    (result.agentGuidance?.length ?? 0) > 0;

  if (!hasContent) {
    return undefined;
  }

  return result;
}

function buildAiInsights(
  parsed: ParsedAiInsightsResponse,
  model: string,
  generatedAt: string,
): AiInsightsKnowledge {
  const insights: AiInsightsKnowledge = {
    generatedAt,
    model,
  };

  if (parsed.architectureSummary !== undefined) {
    insights.architectureSummary = parsed.architectureSummary;
  }
  if (parsed.risks !== undefined) {
    insights.risks = parsed.risks;
  }
  if (parsed.recommendations !== undefined) {
    insights.recommendations = parsed.recommendations;
  }
  if (parsed.agentGuidance !== undefined) {
    insights.agentGuidance = parsed.agentGuidance;
  }

  return insights;
}

export function enrichProjectKnowledgeWithAiInsights(
  knowledge: ProjectKnowledge,
  insights: AiInsightsKnowledge,
): ProjectKnowledge {
  return {
    ...knowledge,
    analysis: {
      ...knowledge.analysis,
      status: knowledge.analysis.status === 'pending' ? 'partial' : knowledge.analysis.status,
      aiInsights: insights,
    },
  };
}

export async function runAiAnalysis(
  knowledge: ProjectKnowledge,
  config: AiAnalysisServiceConfig,
): Promise<AiAnalysisServiceResult> {
  const warnings: string[] = [];
  let provider: AIProvider;
  try {
    provider = config.provider ?? createAiProvider(config.providerId ?? DEFAULT_AI_PROVIDER_ID);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`AI analysis failed: ${message}`);
    return {
      knowledge,
      insightsGenerated: false,
      attempted: true,
      warnings,
      message: 'skipped: AI provider unavailable',
    };
  }

  try {
    const prompt = buildAiAnalysisPrompt(knowledge);
    const response = await provider.analyze(prompt, {
      apiKey: config.apiKey,
      model: config.model,
    });

    const parsed = parseAiInsightsResponse(response.content);
    if (parsed === undefined) {
      warnings.push('AI response was not valid structured JSON; continuing without AI insights');
      return {
        knowledge,
        insightsGenerated: false,
        attempted: true,
        warnings,
        message: 'skipped: invalid AI response',
      };
    }

    const insights = buildAiInsights(parsed, response.model || config.model, new Date().toISOString());
    const enriched = enrichProjectKnowledgeWithAiInsights(knowledge, insights);

    return {
      knowledge: enriched,
      insightsGenerated: true,
      attempted: true,
      warnings,
      message: `generated AI insights with model ${config.model} via ${provider.id}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`AI analysis failed: ${message}`);
    return {
      knowledge,
      insightsGenerated: false,
      attempted: true,
      warnings,
      message: 'skipped: AI analysis failed',
    };
  }
}
