import {
  ProjectKnowledge,
  RouterStageEntry,
  RouterStageKnowledge,
} from '../knowledge';
import { ROUTER_LIMITS } from './constants';
import { AIProvider } from './providers/ai-provider';
import { createAiProvider, DEFAULT_AI_PROVIDER_ID } from './providers/provider-factory';
import { buildRouterStagePrompt, ROUTER_SYSTEM_INSTRUCTION } from './prompt-builder';
import {
  buildStageExecution,
  getOrCreateStagedDocumentation,
  upsertStageExecution,
  withStagedDocumentation,
} from './staged-documentation';
import { extractJsonPayload } from './ai-analysis-service';
import type { AiAnalysisServiceConfig } from './ai-analysis-service';

export interface RouterStageServiceResult {
  knowledge: ProjectKnowledge;
  routerGenerated: boolean;
  attempted: boolean;
  warnings: string[];
  message: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseRouteEntry(raw: unknown): RouterStageEntry | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  if (!isNonEmptyString(record['taskType']) || !isNonEmptyString(record['summary'])) {
    return undefined;
  }
  const readingPath = isStringArray(record['readingPath'])
    ? record['readingPath'].slice(0, ROUTER_LIMITS.maxReadingPathItems)
    : [];
  return {
    taskType: record['taskType'].slice(0, ROUTER_LIMITS.maxTaskTypeLength),
    summary: record['summary'].slice(0, ROUTER_LIMITS.maxSummaryLength),
    readingPath,
  };
}

export function parseRouterResponse(raw: string): RouterStageEntry[] | undefined {
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
  if (!Array.isArray(record['routes'])) {
    return undefined;
  }

  const routes: RouterStageEntry[] = [];
  for (const item of record['routes'].slice(0, ROUTER_LIMITS.maxRoutes)) {
    const entry = parseRouteEntry(item);
    if (entry !== undefined) {
      routes.push(entry);
    }
  }

  return routes.length > 0 ? routes : undefined;
}

function buildFailedRouterStage(params: {
  error: string;
  warnings?: string[];
  provider?: string;
  model?: string;
  generatedAt?: string;
}): RouterStageKnowledge {
  return {
    status: 'failed',
    routes: [],
    warnings: params.warnings ?? [],
    error: params.error,
    ...(params.provider !== undefined ? { provider: params.provider } : {}),
    ...(params.model !== undefined ? { model: params.model } : {}),
    ...(params.generatedAt !== undefined ? { generatedAt: params.generatedAt } : {}),
  };
}

function applyRouterFailure(
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
  staged.router = buildFailedRouterStage({
    error: params.error,
    warnings: params.warnings,
    provider: params.provider,
    model: params.model,
    generatedAt: params.completedAt,
  });
  staged.execution = upsertStageExecution(
    staged.execution,
    buildStageExecution({
      stageId: 'router',
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

export async function runRouterStage(
  knowledge: ProjectKnowledge,
  config: AiAnalysisServiceConfig,
  plannedDocPaths: readonly string[],
): Promise<RouterStageServiceResult> {
  const warnings: string[] = [];
  const startedAt = new Date().toISOString();

  let provider: AIProvider;
  try {
    provider = config.provider ?? createAiProvider(config.providerId ?? DEFAULT_AI_PROVIDER_ID);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Router stage failed: ${message}`);
    const completedAt = new Date().toISOString();
    return {
      knowledge: applyRouterFailure(knowledge, {
        error: message,
        warnings,
        startedAt,
        completedAt,
        model: config.model,
      }),
      routerGenerated: false,
      attempted: true,
      warnings,
      message: 'skipped: AI provider unavailable',
    };
  }

  try {
    const prompt = buildRouterStagePrompt(knowledge, plannedDocPaths);
    const response = await provider.analyze(prompt, {
      apiKey: config.apiKey,
      model: config.model,
      systemInstruction: ROUTER_SYSTEM_INSTRUCTION,
    });

    const completedAt = new Date().toISOString();
    const resolvedModel = response.model || config.model;
    const routes = parseRouterResponse(response.content);

    if (routes === undefined) {
      const error = 'Router stage response was not valid structured JSON';
      warnings.push(`${error}; continuing without router output`);
      return {
        knowledge: applyRouterFailure(knowledge, {
          error,
          warnings,
          startedAt,
          completedAt,
          provider: provider.id,
          model: resolvedModel,
        }),
        routerGenerated: false,
        attempted: true,
        warnings,
        message: 'skipped: invalid AI response',
      };
    }

    const routerKnowledge: RouterStageKnowledge = {
      status: 'completed',
      routes,
      generatedAt: completedAt,
      provider: provider.id,
      model: resolvedModel,
      warnings: [],
    };

    const staged = getOrCreateStagedDocumentation(knowledge);
    staged.router = routerKnowledge;
    staged.execution = upsertStageExecution(
      staged.execution,
      buildStageExecution({
        stageId: 'router',
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
      routerGenerated: true,
      attempted: true,
      warnings,
      message: `generated router with model ${config.model} via ${provider.id}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Router stage failed: ${message}`);
    const completedAt = new Date().toISOString();
    return {
      knowledge: applyRouterFailure(knowledge, {
        error: message,
        warnings,
        startedAt,
        completedAt,
        provider: provider.id,
        model: config.model,
      }),
      routerGenerated: false,
      attempted: true,
      warnings,
      message: 'skipped: router stage failed',
    };
  }
}
