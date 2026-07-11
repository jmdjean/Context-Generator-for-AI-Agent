import {
  ModuleDocumentationPlanEntry,
  ModuleDocumentationResultKnowledge,
  ModuleDocumentationResultsKnowledge,
  ModuleKnowledge,
  ProjectKnowledge,
  StagedDocumentationStatus,
} from '../knowledge';
import { sanitizeAiInsightText } from '../utils/ai-text-sanitizer';
import { MODULE_DOCUMENTATION_LIMITS } from './constants';
import { AIProvider } from './providers/ai-provider';
import { createAiProvider, DEFAULT_AI_PROVIDER_ID } from './providers/provider-factory';
import {
  buildModuleDocumentationPrompt,
  MODULE_DOCUMENTATION_SYSTEM_INSTRUCTION,
} from './prompt-builder';
import {
  buildStageExecution,
  getOrCreateStagedDocumentation,
  upsertStageExecution,
  withStagedDocumentation,
} from './staged-documentation';
import { extractJsonPayload } from './ai-analysis-service';
import type { AiAnalysisServiceConfig } from './ai-analysis-service';

export interface ModuleDocumentationStageServiceResult {
  knowledge: ProjectKnowledge;
  /** True when at least one module result completed successfully. */
  modulesGenerated: boolean;
  attempted: boolean;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  warnings: string[];
  message: string;
}

export interface ParsedModuleDocumentationResponse {
  summary?: string;
  purpose?: string;
  entryPoints?: string[];
  keyBehaviors?: string[];
  dependencies?: string[];
  outOfScope?: string[];
  agentGuidance?: string[];
}

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
    .map((item) => trimToMaxLength(item, MODULE_DOCUMENTATION_LIMITS.maxItemLength))
    .filter((item) => item.length > 0)
    .slice(0, MODULE_DOCUMENTATION_LIMITS.maxArrayItems);
}

export function parseModuleDocumentationResponse(
  raw: string,
): ParsedModuleDocumentationResponse | undefined {
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
  const result: ParsedModuleDocumentationResponse = {};

  for (const field of ['summary', 'purpose'] as const) {
    if (record[field] === undefined) {
      continue;
    }
    if (!isNonEmptyString(record[field])) {
      return undefined;
    }
    result[field] = trimToMaxLength(
      record[field],
      field === 'summary'
        ? MODULE_DOCUMENTATION_LIMITS.maxSummaryLength
        : MODULE_DOCUMENTATION_LIMITS.maxItemLength,
    );
  }

  for (const field of [
    'entryPoints',
    'keyBehaviors',
    'dependencies',
    'outOfScope',
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

  const hasContent =
    result.summary !== undefined ||
    result.purpose !== undefined ||
    (result.entryPoints?.length ?? 0) > 0 ||
    (result.keyBehaviors?.length ?? 0) > 0 ||
    (result.dependencies?.length ?? 0) > 0 ||
    (result.outOfScope?.length ?? 0) > 0 ||
    (result.agentGuidance?.length ?? 0) > 0;

  if (!hasContent) {
    return undefined;
  }

  return result;
}

function renderBulletSection(title: string, items: string[] | undefined): string | undefined {
  if (!items || items.length === 0) {
    return undefined;
  }
  return [`### ${title}`, ...items.map((item) => `- ${item}`)].join('\n');
}

export function buildModuleDocumentationContent(
  parsed: ParsedModuleDocumentationResponse,
): string {
  const sections: string[] = [];

  if (parsed.purpose) {
    sections.push(['### Purpose', parsed.purpose].join('\n'));
  }
  const entryPoints = renderBulletSection('Entry points', parsed.entryPoints);
  if (entryPoints) {
    sections.push(entryPoints);
  }
  const keyBehaviors = renderBulletSection('Key behaviors', parsed.keyBehaviors);
  if (keyBehaviors) {
    sections.push(keyBehaviors);
  }
  const dependencies = renderBulletSection('Dependencies', parsed.dependencies);
  if (dependencies) {
    sections.push(dependencies);
  }
  const outOfScope = renderBulletSection('Out of scope', parsed.outOfScope);
  if (outOfScope) {
    sections.push(outOfScope);
  }
  const agentGuidance = renderBulletSection('Agent guidance', parsed.agentGuidance);
  if (agentGuidance) {
    sections.push(agentGuidance);
  }

  const content = sections.join('\n\n');
  return trimToMaxLength(content, MODULE_DOCUMENTATION_LIMITS.maxContentLength);
}

function findModuleKnowledge(
  knowledge: ProjectKnowledge,
  entry: ModuleDocumentationPlanEntry,
): ModuleKnowledge | undefined {
  const modules = knowledge.analysis.modules ?? [];
  return (
    modules.find((module) => module.relativePath === entry.moduleId) ??
    modules.find((module) => module.relativePath === entry.moduleRelativePath) ??
    modules.find((module) => module.name === entry.moduleName)
  );
}

function buildFailedModuleResult(
  entry: ModuleDocumentationPlanEntry,
  params: {
    error: string;
    warnings?: string[];
    provider?: string;
    model?: string;
    generatedAt?: string;
  },
): ModuleDocumentationResultKnowledge {
  const result: ModuleDocumentationResultKnowledge = {
    moduleId: entry.moduleId,
    moduleName: entry.moduleName,
    moduleRelativePath: entry.moduleRelativePath,
    documentPath: entry.documentPath,
    status: 'failed',
    warnings: params.warnings ?? [],
    error: params.error,
  };

  if (params.provider !== undefined) {
    result.provider = params.provider;
  }
  if (params.model !== undefined) {
    result.model = params.model;
  }
  if (params.generatedAt !== undefined) {
    result.generatedAt = params.generatedAt;
  }

  return result;
}

function buildCompletedModuleResult(
  entry: ModuleDocumentationPlanEntry,
  parsed: ParsedModuleDocumentationResponse,
  params: {
    provider: string;
    model: string;
    generatedAt: string;
  },
): ModuleDocumentationResultKnowledge {
  const result: ModuleDocumentationResultKnowledge = {
    moduleId: entry.moduleId,
    moduleName: entry.moduleName,
    moduleRelativePath: entry.moduleRelativePath,
    documentPath: entry.documentPath,
    status: 'completed',
    content: buildModuleDocumentationContent(parsed),
    generatedAt: params.generatedAt,
    provider: params.provider,
    model: params.model,
    warnings: [],
  };

  if (parsed.summary) {
    result.summary = parsed.summary;
  }

  return result;
}

function resolveOverallStatus(
  results: readonly ModuleDocumentationResultKnowledge[],
): StagedDocumentationStatus {
  if (results.length === 0) {
    return 'partial';
  }

  const completed = results.filter((result) => result.status === 'completed').length;
  const failed = results.filter((result) => result.status === 'failed').length;

  if (completed === results.length) {
    return 'completed';
  }
  if (failed === results.length) {
    return 'failed';
  }
  return 'partial';
}

function updateModulePlanEntryStatuses(
  knowledge: ProjectKnowledge,
  results: readonly ModuleDocumentationResultKnowledge[],
): void {
  const staged = knowledge.analysis.stagedDocumentation;
  if (!staged?.modulePlan) {
    return;
  }

  const statusByModuleId = new Map(
    results.map((result) => [result.moduleId, result.status] as const),
  );

  staged.modulePlan = {
    ...staged.modulePlan,
    entries: staged.modulePlan.entries.map((entry) => {
      const status = statusByModuleId.get(entry.moduleId);
      if (status === undefined) {
        return entry;
      }
      return { ...entry, status };
    }),
  };
}

async function documentSingleModule(
  knowledge: ProjectKnowledge,
  entry: ModuleDocumentationPlanEntry,
  provider: AIProvider,
  config: AiAnalysisServiceConfig,
): Promise<{
  result: ModuleDocumentationResultKnowledge;
  warning?: string;
}> {
  try {
    const module = findModuleKnowledge(knowledge, entry);
    const prompt = buildModuleDocumentationPrompt(knowledge, { entry, module });
    const response = await provider.analyze(prompt, {
      apiKey: config.apiKey,
      model: config.model,
      systemInstruction: MODULE_DOCUMENTATION_SYSTEM_INSTRUCTION,
    });

    const completedAt = new Date().toISOString();
    const resolvedModel = response.model || config.model;
    const parsed = parseModuleDocumentationResponse(response.content);

    if (parsed === undefined) {
      const error = `Invalid module documentation JSON for ${entry.moduleRelativePath}`;
      return {
        result: buildFailedModuleResult(entry, {
          error,
          warnings: [error],
          provider: provider.id,
          model: resolvedModel,
          generatedAt: completedAt,
        }),
        warning: error,
      };
    }

    return {
      result: buildCompletedModuleResult(entry, parsed, {
        provider: provider.id,
        model: resolvedModel,
        generatedAt: completedAt,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error = `Module documentation failed for ${entry.moduleRelativePath}: ${message}`;
    return {
      result: buildFailedModuleResult(entry, {
        error,
        warnings: [error],
        provider: provider.id,
        model: config.model,
        generatedAt: new Date().toISOString(),
      }),
      warning: error,
    };
  }
}

/**
 * Runs one AI documentation flow per module-plan entry (sequential).
 * Consumes PKM-backed architecture context and module knowledge; persists
 * per-module results with isolated failure status for partial success/retries.
 */
export async function runModuleDocumentationStage(
  knowledge: ProjectKnowledge,
  config: AiAnalysisServiceConfig,
): Promise<ModuleDocumentationStageServiceResult> {
  const warnings: string[] = [];
  const startedAt = new Date().toISOString();
  const entries = knowledge.analysis.stagedDocumentation?.modulePlan?.entries ?? [];

  if (entries.length === 0) {
    const completedAt = new Date().toISOString();
    const staged = getOrCreateStagedDocumentation(knowledge);
    const moduleResults: ModuleDocumentationResultsKnowledge = {
      status: 'partial',
      results: [],
      generatedAt: completedAt,
      warnings: ['No module-plan entries available; module documentation stage had nothing to generate'],
    };
    staged.moduleResults = moduleResults;
    staged.execution = upsertStageExecution(
      staged.execution,
      buildStageExecution({
        stageId: 'module-documentation',
        status: 'partial',
        startedAt,
        completedAt,
        warnings: moduleResults.warnings,
      }),
    );
    staged.generatedAt = completedAt;

    return {
      knowledge: withStagedDocumentation(knowledge, staged),
      modulesGenerated: false,
      attempted: false,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      warnings: [...moduleResults.warnings],
      message: 'skipped: no module-plan entries',
    };
  }

  let provider: AIProvider;
  try {
    provider = config.provider ?? createAiProvider(config.providerId ?? DEFAULT_AI_PROVIDER_ID);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Module documentation stage failed: ${message}`);
    const completedAt = new Date().toISOString();
    const failedResults = entries.map((entry) =>
      buildFailedModuleResult(entry, {
        error: message,
        warnings,
        model: config.model,
        generatedAt: completedAt,
      }),
    );
    const staged = getOrCreateStagedDocumentation(knowledge);
    staged.moduleResults = {
      status: 'failed',
      results: failedResults,
      generatedAt: completedAt,
      warnings: [...warnings],
    };
    updateModulePlanEntryStatuses(
      { ...knowledge, analysis: { ...knowledge.analysis, stagedDocumentation: staged } },
      failedResults,
    );
    staged.execution = upsertStageExecution(
      staged.execution,
      buildStageExecution({
        stageId: 'module-documentation',
        status: 'failed',
        startedAt,
        completedAt,
        model: config.model,
        warnings,
        error: message,
      }),
    );
    staged.generatedAt = completedAt;

    return {
      knowledge: withStagedDocumentation(knowledge, staged),
      modulesGenerated: false,
      attempted: true,
      completedCount: 0,
      failedCount: failedResults.length,
      skippedCount: 0,
      warnings,
      message: 'skipped: AI provider unavailable',
    };
  }

  const results: ModuleDocumentationResultKnowledge[] = [];

  // Sequential fan-out: correct and observable before any concurrency.
  for (const entry of entries) {
    const { result, warning } = await documentSingleModule(knowledge, entry, provider, config);
    results.push(result);
    if (warning) {
      warnings.push(warning);
    }
  }

  const completedAt = new Date().toISOString();
  const overallStatus = resolveOverallStatus(results);
  const completedCount = results.filter((result) => result.status === 'completed').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;

  const moduleResults: ModuleDocumentationResultsKnowledge = {
    status: overallStatus,
    results,
    generatedAt: completedAt,
    warnings: [...warnings],
  };

  const staged = getOrCreateStagedDocumentation(knowledge);
  staged.moduleResults = moduleResults;
  updateModulePlanEntryStatuses(
    { ...knowledge, analysis: { ...knowledge.analysis, stagedDocumentation: staged } },
    results,
  );
  staged.execution = upsertStageExecution(
    staged.execution,
    buildStageExecution({
      stageId: 'module-documentation',
      status: overallStatus,
      startedAt,
      completedAt,
      provider: provider.id,
      model: config.model,
      warnings,
      error: overallStatus === 'failed' ? 'All module documentation generations failed' : undefined,
    }),
  );
  staged.generatedAt = completedAt;

  const modulesGenerated = completedCount > 0;
  let message: string;
  if (overallStatus === 'completed') {
    message = `generated module documentation for ${completedCount} module(s) via ${provider.id}`;
  } else if (overallStatus === 'partial') {
    message = `generated module documentation for ${completedCount}/${results.length} module(s) (${failedCount} failed) via ${provider.id}`;
  } else {
    message = `module documentation failed for all ${failedCount} module(s)`;
  }

  return {
    knowledge: withStagedDocumentation(knowledge, staged),
    modulesGenerated,
    attempted: true,
    completedCount,
    failedCount,
    skippedCount: 0,
    warnings,
    message,
  };
}
