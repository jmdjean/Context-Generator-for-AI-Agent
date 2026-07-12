import { RuntimeConfig } from '../config';
import { ProjectKnowledge } from '../knowledge';
import { createRepositoryBoundary } from '../scanner/repository-boundary';
import {
  CONVENTION_ANALYZER_PLUGIN_ID,
  DEPENDENCY_ANALYZER_PLUGIN_ID,
  FOLDER_ANALYZER_PLUGIN_ID,
  MODULE_ANALYZER_PLUGIN_ID,
  NAVIGATION_ANALYZER_PLUGIN_ID,
  OPERATIONAL_CONTEXT_ANALYZER_PLUGIN_ID,
} from './builtin';
import { createPluginContext } from './plugin-context';
import { createConsolePluginLogger } from './plugin-logger';
import { createPluginManager, PluginExecutionOutcome, PluginManager } from './plugin-manager';
import { PluginExecutionStatus } from './plugin-result';

let pluginManager: PluginManager = createPluginManager();
const pluginLogger = createConsolePluginLogger();

export type AnalyzerStepStatus = 'completed' | 'skipped' | 'failed';

export interface AnalyzerStepOutcome {
  knowledge: ProjectKnowledge;
  stepStatus: AnalyzerStepStatus;
  message: string;
  metrics: Record<string, number>;
}

/** Test hook: replace the pipeline-scoped PluginManager instance. */
export function setPipelinePluginManager(manager: PluginManager): void {
  pluginManager = manager;
}

export function resetPipelinePluginManager(): void {
  pluginManager = createPluginManager();
}

export function resolveAnalyzerStepStatus(status: PluginExecutionStatus | string): AnalyzerStepStatus {
  if (status === 'failed' || status === 'skipped' || status === 'completed') {
    return status;
  }

  return 'failed';
}

function buildPluginContext(
  knowledge: ProjectKnowledge,
  config: RuntimeConfig,
): ReturnType<typeof createPluginContext> {
  return createPluginContext({
    knowledge,
    config,
    boundary: createRepositoryBoundary(knowledge.repository.rootPath),
    logger: pluginLogger,
  });
}

export function mapPluginOutcomeToAnalyzerStep(outcome: PluginExecutionOutcome): AnalyzerStepOutcome {
  for (const warning of outcome.result.warnings ?? []) {
    console.warn(`Warning: ${warning}`);
  }

  const stepStatus = resolveAnalyzerStepStatus(outcome.result.status);
  const message =
    stepStatus === 'failed' && outcome.result.status !== 'failed'
      ? `${outcome.result.message} (invalid plugin status: ${String(outcome.result.status)})`
      : outcome.result.message;

  return {
    knowledge: outcome.knowledge,
    stepStatus,
    message,
    metrics: outcome.result.metrics ?? {},
  };
}

export function executeAnalyzerPluginStep(
  pluginId: string,
  knowledge: ProjectKnowledge,
  config: RuntimeConfig,
): AnalyzerStepOutcome {
  const context = buildPluginContext(knowledge, config);
  const outcome = pluginManager.executeAnalyzerPlugin(pluginId, context);
  return mapPluginOutcomeToAnalyzerStep(outcome);
}

export const ANALYZER_PLUGIN_IDS = {
  folder: FOLDER_ANALYZER_PLUGIN_ID,
  module: MODULE_ANALYZER_PLUGIN_ID,
  operationalContext: OPERATIONAL_CONTEXT_ANALYZER_PLUGIN_ID,
  dependency: DEPENDENCY_ANALYZER_PLUGIN_ID,
  convention: CONVENTION_ANALYZER_PLUGIN_ID,
  navigation: NAVIGATION_ANALYZER_PLUGIN_ID,
} as const;
