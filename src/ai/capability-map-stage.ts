import {
  CapabilityMapItem,
  CapabilityMapStageKnowledge,
  ProjectKnowledge,
} from '../knowledge';
import { CAPABILITY_MAP_LIMITS } from './constants';
import { AIProvider } from './providers/ai-provider';
import { createAiProvider, DEFAULT_AI_PROVIDER_ID } from './providers/provider-factory';
import { buildCapabilityMapStagePrompt, CAPABILITY_MAP_SYSTEM_INSTRUCTION } from './prompt-builder';
import {
  buildStageExecution,
  getOrCreateStagedDocumentation,
  upsertStageExecution,
  withStagedDocumentation,
} from './staged-documentation';
import { extractJsonPayload } from './ai-analysis-service';
import type { AiAnalysisServiceConfig } from './ai-analysis-service';

export interface CapabilityMapStageServiceResult {
  knowledge: ProjectKnowledge;
  capabilityMapGenerated: boolean;
  attempted: boolean;
  warnings: string[];
  message: string;
}

interface RawCapabilityItem {
  name?: unknown;
  summary?: unknown;
  entryPaths?: unknown;
  relatedModules?: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseCapabilityItem(raw: unknown, limits: typeof CAPABILITY_MAP_LIMITS): CapabilityMapItem | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as RawCapabilityItem;
  if (!isNonEmptyString(record.name) || !isNonEmptyString(record.summary)) {
    return undefined;
  }
  const entryPaths = isStringArray(record.entryPaths)
    ? record.entryPaths.slice(0, limits.maxEntryPaths)
    : [];
  const relatedModules = isStringArray(record.relatedModules)
    ? record.relatedModules.slice(0, limits.maxRelatedModules)
    : [];
  return {
    name: record.name.slice(0, limits.maxNameLength),
    summary: record.summary.slice(0, limits.maxSummaryLength),
    entryPaths,
    relatedModules,
  };
}

function parseCapabilityItemArray(
  value: unknown,
  limits: typeof CAPABILITY_MAP_LIMITS,
  maxItems: number,
): CapabilityMapItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: CapabilityMapItem[] = [];
  for (const item of value.slice(0, maxItems)) {
    const parsed = parseCapabilityItem(item, limits);
    if (parsed !== undefined) {
      result.push(parsed);
    }
  }
  return result;
}

export function parseCapabilityMapResponse(
  raw: string,
): Partial<Pick<CapabilityMapStageKnowledge, 'features' | 'domains' | 'integrations'>> | undefined {
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
  const limits = CAPABILITY_MAP_LIMITS;
  const maxItems = limits.maxFeatures;

  const features = parseCapabilityItemArray(record['features'], limits, maxItems);
  const domains = parseCapabilityItemArray(record['domains'], limits, maxItems);
  const integrations = parseCapabilityItemArray(record['integrations'], limits, maxItems);

  if (features.length === 0 && domains.length === 0 && integrations.length === 0) {
    return undefined;
  }

  return { features, domains, integrations };
}

function buildFailedCapabilityMapStage(params: {
  error: string;
  warnings?: string[];
  provider?: string;
  model?: string;
  generatedAt?: string;
}): CapabilityMapStageKnowledge {
  return {
    status: 'failed',
    features: [],
    domains: [],
    integrations: [],
    warnings: params.warnings ?? [],
    error: params.error,
    ...(params.provider !== undefined ? { provider: params.provider } : {}),
    ...(params.model !== undefined ? { model: params.model } : {}),
    ...(params.generatedAt !== undefined ? { generatedAt: params.generatedAt } : {}),
  };
}

function applyCapabilityMapFailure(
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
  staged.capabilityMap = buildFailedCapabilityMapStage({
    error: params.error,
    warnings: params.warnings,
    provider: params.provider,
    model: params.model,
    generatedAt: params.completedAt,
  });
  staged.execution = upsertStageExecution(
    staged.execution,
    buildStageExecution({
      stageId: 'capability-map',
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

export async function runCapabilityMapStage(
  knowledge: ProjectKnowledge,
  config: AiAnalysisServiceConfig,
): Promise<CapabilityMapStageServiceResult> {
  const warnings: string[] = [];
  const startedAt = new Date().toISOString();

  const productModules = (knowledge.analysis.modules ?? []).filter(
    (module) => module.type !== 'documentation',
  );
  if (productModules.length === 0) {
    const completedAt = new Date().toISOString();
    const staged = getOrCreateStagedDocumentation(knowledge);
    staged.capabilityMap = {
      status: 'skipped',
      features: [],
      domains: [],
      integrations: [],
      generatedAt: completedAt,
      warnings: ['No product modules discovered; capability map skipped'],
    };
    staged.execution = upsertStageExecution(
      staged.execution,
      buildStageExecution({
        stageId: 'capability-map',
        status: 'skipped',
        startedAt,
        completedAt,
        warnings: staged.capabilityMap.warnings,
      }),
    );
    staged.generatedAt = completedAt;
    return {
      knowledge: withStagedDocumentation(knowledge, staged),
      capabilityMapGenerated: false,
      attempted: false,
      warnings: staged.capabilityMap.warnings,
      message: 'skipped: no product modules',
    };
  }

  let provider: AIProvider;
  try {
    provider = config.provider ?? createAiProvider(config.providerId ?? DEFAULT_AI_PROVIDER_ID);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Capability map stage failed: ${message}`);
    const completedAt = new Date().toISOString();
    return {
      knowledge: applyCapabilityMapFailure(knowledge, {
        error: message,
        warnings,
        startedAt,
        completedAt,
        model: config.model,
      }),
      capabilityMapGenerated: false,
      attempted: true,
      warnings,
      message: 'skipped: AI provider unavailable',
    };
  }

  try {
    const prompt = buildCapabilityMapStagePrompt(knowledge);
    const response = await provider.analyze(prompt, {
      apiKey: config.apiKey,
      model: config.model,
      systemInstruction: CAPABILITY_MAP_SYSTEM_INSTRUCTION,
    });

    const completedAt = new Date().toISOString();
    const resolvedModel = response.model || config.model;
    const parsed = parseCapabilityMapResponse(response.content);

    if (parsed === undefined) {
      const error = 'Capability map response was not valid structured JSON';
      warnings.push(`${error}; continuing without capability-map output`);
      return {
        knowledge: applyCapabilityMapFailure(knowledge, {
          error,
          warnings,
          startedAt,
          completedAt,
          provider: provider.id,
          model: resolvedModel,
        }),
        capabilityMapGenerated: false,
        attempted: true,
        warnings,
        message: 'skipped: invalid AI response',
      };
    }

    const capabilityMap: CapabilityMapStageKnowledge = {
      status: 'completed',
      features: parsed.features ?? [],
      domains: parsed.domains ?? [],
      integrations: parsed.integrations ?? [],
      generatedAt: completedAt,
      provider: provider.id,
      model: resolvedModel,
      warnings: [],
    };

    const staged = getOrCreateStagedDocumentation(knowledge);
    staged.capabilityMap = capabilityMap;
    staged.execution = upsertStageExecution(
      staged.execution,
      buildStageExecution({
        stageId: 'capability-map',
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
      knowledge: withStagedDocumentation(knowledge, staged),
      capabilityMapGenerated: true,
      attempted: true,
      warnings,
      message: `generated capability map with model ${config.model} via ${provider.id}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Capability map stage failed: ${message}`);
    const completedAt = new Date().toISOString();
    return {
      knowledge: applyCapabilityMapFailure(knowledge, {
        error: message,
        warnings,
        startedAt,
        completedAt,
        provider: provider.id,
        model: config.model,
      }),
      capabilityMapGenerated: false,
      attempted: true,
      warnings,
      message: 'skipped: capability map stage failed',
    };
  }
}
