import { RuntimeConfig } from '../config';
import { ProjectKnowledge } from '../knowledge';
import { RepositoryBoundary } from '../scanner/repository-boundary';
import { PluginLogger } from './plugin-logger';

export interface PluginContext {
  readonly knowledge: ProjectKnowledge;
  readonly config: RuntimeConfig;
  readonly boundary: RepositoryBoundary;
  readonly logger: PluginLogger;
}

export function createPluginContext(input: {
  knowledge: ProjectKnowledge;
  config: RuntimeConfig;
  boundary: RepositoryBoundary;
  logger: PluginLogger;
}): PluginContext {
  return {
    knowledge: {
      ...input.knowledge,
      analysis: { ...input.knowledge.analysis },
    },
    config: input.config,
    boundary: input.boundary,
    logger: input.logger,
  };
}
