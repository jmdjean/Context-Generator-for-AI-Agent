import {
  AiInsightsKnowledge,
  ConventionKnowledge,
  DependencyGraphKnowledge,
  FolderKnowledge,
  ModuleKnowledge,
  NavigationMapKnowledge,
  ProjectKnowledge,
} from '../knowledge';

export type PluginExecutionStatus = 'completed' | 'skipped' | 'failed';

export interface DocumentationSectionContribution {
  documentPath: string;
  sectionId: string;
  content: string;
}

/** Partial PKM sections returned by plugins. Merged by `mergePluginContributions`. */
export interface PluginContributions {
  folderContexts?: FolderKnowledge[];
  modules?: ModuleKnowledge[];
  conventions?: ConventionKnowledge[];
  dependencyGraph?: DependencyGraphKnowledge;
  navigationMap?: NavigationMapKnowledge;
  aiInsights?: AiInsightsKnowledge;
  /** Reserved for future `DocumentationPlugin` output. Not merged in v1. */
  documentationSections?: DocumentationSectionContribution[];
}

export interface PluginResult {
  status: PluginExecutionStatus;
  message: string;
  warnings?: string[];
  metrics?: Record<string, number>;
  contributions?: PluginContributions;
  /** @deprecated Prefer `contributions`. Removed when external plugin loading lands. */
  knowledge?: ProjectKnowledge;
}

export function createSkippedPluginResult(message: string): PluginResult {
  return {
    status: 'skipped',
    message,
  };
}

export function createFailedPluginResult(
  message: string,
  options?: {
    warnings?: string[];
    metrics?: Record<string, number>;
  },
): PluginResult {
  return {
    status: 'failed',
    message,
    warnings: options?.warnings,
    metrics: options?.metrics,
  };
}

export function createCompletedPluginResult(
  message: string,
  options?: {
    warnings?: string[];
    metrics?: Record<string, number>;
    contributions?: PluginContributions;
    knowledge?: ProjectKnowledge;
  },
): PluginResult {
  return {
    status: 'completed',
    message,
    warnings: options?.warnings,
    metrics: options?.metrics,
    contributions: options?.contributions,
    knowledge: options?.knowledge,
  };
}
