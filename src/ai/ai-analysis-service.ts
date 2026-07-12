import {
  AiInsightsKnowledge,
  ArchitectureStageKnowledge,
  ProjectKnowledge,
} from '../knowledge';
import { sanitizeAiInsightMetadata, sanitizeAiInsightText } from '../utils/ai-text-sanitizer';
import { AI_INSIGHTS_LIMITS } from './constants';
import { AIProvider } from './providers/ai-provider';
import { createAiProvider, DEFAULT_AI_PROVIDER_ID } from './providers/provider-factory';
import { buildArchitectureStagePrompt, ARCHITECTURE_STAGE_SYSTEM_INSTRUCTION } from './prompt-builder';
import {
  ARCHITECTURE_STAGE_DOCUMENT_PATHS,
  buildFailedArchitectureStage,
  buildStageExecution,
  getOrCreateStagedDocumentation,
  upsertStageExecution,
  withStagedDocumentation,
} from './staged-documentation';

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

export interface ArchitectureStageServiceResult {
  knowledge: ProjectKnowledge;
  architectureGenerated: boolean;
  attempted: boolean;
  warnings: string[];
  message: string;
}

interface ParsedAiInsightsResponse {
  architectureSummary?: string;
  purpose?: string;
  layers?: string[];
  asciiDiagram?: string;
  keyConstraints?: string[];
  envVars?: string[];
  runCommands?: string[];
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

/** Preserve env keys / command strings / ASCII diagrams — markdown italic stripping would mangle `_API_`. */
function trimIdentifierToMaxLength(value: string, maxLength: number): string {
  const trimmed = sanitizeAiInsightMetadata(value);
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function trimAsciiDiagram(value: string, maxLength: number): string {
  const trimmed = value
    .replace(/\r\n/g, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
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

function normalizeIdentifierArray(values: string[]): string[] {
  return values
    .map((item) => trimIdentifierToMaxLength(item, AI_INSIGHTS_LIMITS.maxItemLength))
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

  if (record['purpose'] !== undefined) {
    if (!isNonEmptyString(record['purpose'])) {
      return undefined;
    }
    result.purpose = trimToMaxLength(record['purpose'], AI_INSIGHTS_LIMITS.maxPurposeLength);
  }

  if (record['asciiDiagram'] !== undefined) {
    if (!isNonEmptyString(record['asciiDiagram'])) {
      return undefined;
    }
    result.asciiDiagram = trimAsciiDiagram(
      record['asciiDiagram'],
      AI_INSIGHTS_LIMITS.maxAsciiDiagramLength,
    );
  }

  for (const field of [
    'layers',
    'keyConstraints',
    'risks',
    'recommendations',
    'agentGuidance',
  ] as const) {
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

  for (const field of ['envVars', 'runCommands'] as const) {
    if (record[field] === undefined) {
      continue;
    }
    if (!isStringArray(record[field])) {
      return undefined;
    }
    const normalized = normalizeIdentifierArray(record[field]);
    if (normalized.length > 0) {
      result[field] = normalized;
    }
  }

  const hasContent =
    result.architectureSummary !== undefined ||
    result.purpose !== undefined ||
    result.asciiDiagram !== undefined ||
    (result.layers?.length ?? 0) > 0 ||
    (result.keyConstraints?.length ?? 0) > 0 ||
    (result.envVars?.length ?? 0) > 0 ||
    (result.runCommands?.length ?? 0) > 0 ||
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

  const architectureSummary = parsed.architectureSummary ?? parsed.purpose;
  if (architectureSummary !== undefined) {
    insights.architectureSummary = architectureSummary;
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

function buildArchitectureContent(parsed: ParsedAiInsightsResponse): string {
  const sections: string[] = [];

  if (parsed.architectureSummary !== undefined) {
    sections.push(parsed.architectureSummary);
  } else if (parsed.purpose !== undefined) {
    sections.push(parsed.purpose);
  }

  if (parsed.purpose !== undefined && parsed.architectureSummary !== undefined) {
    sections.push(['Purpose:', parsed.purpose].join('\n'));
  }

  if (parsed.layers !== undefined && parsed.layers.length > 0) {
    sections.push(['Layers:', ...parsed.layers.map((item) => `- ${item}`)].join('\n'));
  }

  if (parsed.asciiDiagram !== undefined) {
    sections.push(['Diagram:', '```', parsed.asciiDiagram, '```'].join('\n'));
  }

  if (parsed.keyConstraints !== undefined && parsed.keyConstraints.length > 0) {
    sections.push(
      ['Key constraints:', ...parsed.keyConstraints.map((item) => `- ${item}`)].join('\n'),
    );
  }

  if (parsed.envVars !== undefined && parsed.envVars.length > 0) {
    sections.push(['Environment variables:', ...parsed.envVars.map((item) => `- ${item}`)].join('\n'));
  }

  if (parsed.runCommands !== undefined && parsed.runCommands.length > 0) {
    sections.push(['Run commands:', ...parsed.runCommands.map((item) => `- ${item}`)].join('\n'));
  }

  if (parsed.risks !== undefined && parsed.risks.length > 0) {
    sections.push(['Risks:', ...parsed.risks.map((item) => `- ${item}`)].join('\n'));
  }

  if (parsed.recommendations !== undefined && parsed.recommendations.length > 0) {
    sections.push(
      ['Recommendations:', ...parsed.recommendations.map((item) => `- ${item}`)].join('\n'),
    );
  }

  if (parsed.agentGuidance !== undefined && parsed.agentGuidance.length > 0) {
    sections.push(
      ['Agent guidance:', ...parsed.agentGuidance.map((item) => `- ${item}`)].join('\n'),
    );
  }

  return sections.join('\n\n');
}

function assignOptionalOrientationFields(
  architecture: ArchitectureStageKnowledge,
  parsed: ParsedAiInsightsResponse,
): void {
  if (parsed.purpose !== undefined) {
    architecture.purpose = parsed.purpose;
  }
  if (parsed.layers !== undefined) {
    architecture.layers = parsed.layers;
  }
  if (parsed.asciiDiagram !== undefined) {
    architecture.asciiDiagram = parsed.asciiDiagram;
  }
  if (parsed.keyConstraints !== undefined) {
    architecture.keyConstraints = parsed.keyConstraints;
  }
  if (parsed.envVars !== undefined) {
    architecture.envVars = parsed.envVars;
  }
  if (parsed.runCommands !== undefined) {
    architecture.runCommands = parsed.runCommands;
  }
  if (parsed.risks !== undefined) {
    architecture.risks = parsed.risks;
  }
  if (parsed.agentGuidance !== undefined) {
    architecture.agentGuidance = parsed.agentGuidance;
  }
}

function buildArchitectureStageKnowledge(params: {
  parsed: ParsedAiInsightsResponse;
  model: string;
  provider: string;
  generatedAt: string;
}): ArchitectureStageKnowledge {
  const architecture: ArchitectureStageKnowledge = {
    status: 'completed',
    content: buildArchitectureContent(params.parsed),
    documentPaths: [...ARCHITECTURE_STAGE_DOCUMENT_PATHS],
    generatedAt: params.generatedAt,
    provider: params.provider,
    model: params.model,
    warnings: [],
  };

  const summary =
    params.parsed.architectureSummary ?? params.parsed.purpose;
  if (summary !== undefined) {
    architecture.summary = summary;
  }

  assignOptionalOrientationFields(architecture, params.parsed);

  return architecture;
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

function applyArchitectureStageFailure(
  knowledge: ProjectKnowledge,
  params: {
    error: string;
    warnings: string[];
    startedAt: string;
    completedAt: string;
    provider?: string;
    model?: string;
  },
): ProjectKnowledge {
  const staged = getOrCreateStagedDocumentation(knowledge);
  staged.architecture = buildFailedArchitectureStage({
    error: params.error,
    warnings: params.warnings,
    provider: params.provider,
    model: params.model,
    generatedAt: params.completedAt,
  });
  staged.execution = upsertStageExecution(
    staged.execution,
    buildStageExecution({
      stageId: 'architecture',
      status: 'failed',
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      provider: params.provider,
      model: params.model,
      warnings: params.warnings,
      error: params.error,
    }),
  );
  staged.generatedAt = params.completedAt;
  return withStagedDocumentation(knowledge, staged);
}

export async function runArchitectureStage(
  knowledge: ProjectKnowledge,
  config: AiAnalysisServiceConfig,
): Promise<ArchitectureStageServiceResult> {
  const warnings: string[] = [];
  const startedAt = new Date().toISOString();
  let provider: AIProvider;

  try {
    provider = config.provider ?? createAiProvider(config.providerId ?? DEFAULT_AI_PROVIDER_ID);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Architecture stage failed: ${message}`);
    const completedAt = new Date().toISOString();
    return {
      knowledge: applyArchitectureStageFailure(knowledge, {
        error: message,
        warnings,
        startedAt,
        completedAt,
        model: config.model,
      }),
      architectureGenerated: false,
      attempted: true,
      warnings,
      message: 'skipped: AI provider unavailable',
    };
  }

  try {
    const prompt = buildArchitectureStagePrompt(knowledge);
    const response = await provider.analyze(prompt, {
      apiKey: config.apiKey,
      model: config.model,
      systemInstruction: ARCHITECTURE_STAGE_SYSTEM_INSTRUCTION,
    });

    const parsed = parseAiInsightsResponse(response.content);
    const completedAt = new Date().toISOString();
    const resolvedModel = response.model || config.model;

    if (parsed === undefined) {
      const error = 'AI response was not valid structured JSON';
      warnings.push(`${error}; continuing without architecture-stage output`);
      return {
        knowledge: applyArchitectureStageFailure(knowledge, {
          error,
          warnings,
          startedAt,
          completedAt,
          provider: provider.id,
          model: resolvedModel,
        }),
        architectureGenerated: false,
        attempted: true,
        warnings,
        message: 'skipped: invalid AI response',
      };
    }

    const insights = buildAiInsights(parsed, resolvedModel, completedAt);
    const architecture = buildArchitectureStageKnowledge({
      parsed,
      model: resolvedModel,
      provider: provider.id,
      generatedAt: completedAt,
    });

    const withInsights = enrichProjectKnowledgeWithAiInsights(knowledge, insights);
    const staged = getOrCreateStagedDocumentation(withInsights);
    staged.architecture = architecture;
    staged.execution = upsertStageExecution(
      staged.execution,
      buildStageExecution({
        stageId: 'architecture',
        status: 'completed',
        startedAt,
        completedAt,
        provider: provider.id,
        model: resolvedModel,
        warnings: [],
      }),
    );
    staged.generatedAt = completedAt;

    return {
      knowledge: withStagedDocumentation(withInsights, staged),
      architectureGenerated: true,
      attempted: true,
      warnings,
      message: `generated architecture context with model ${config.model} via ${provider.id}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Architecture stage failed: ${message}`);
    const completedAt = new Date().toISOString();
    return {
      knowledge: applyArchitectureStageFailure(knowledge, {
        error: message,
        warnings,
        startedAt,
        completedAt,
        provider: provider.id,
        model: config.model,
      }),
      architectureGenerated: false,
      attempted: true,
      warnings,
      message: 'skipped: architecture stage failed',
    };
  }
}

/**
 * Backward-compatible wrapper around {@link runArchitectureStage}.
 * Prefer `runArchitectureStage` for new call sites.
 */
export async function runAiAnalysis(
  knowledge: ProjectKnowledge,
  config: AiAnalysisServiceConfig,
): Promise<AiAnalysisServiceResult> {
  const result = await runArchitectureStage(knowledge, config);
  return {
    knowledge: result.knowledge,
    insightsGenerated: result.architectureGenerated,
    attempted: result.attempted,
    warnings: result.warnings,
    message: result.message,
  };
}
