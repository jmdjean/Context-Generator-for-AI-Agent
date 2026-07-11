import {
  ArchitectureStageKnowledge,
  ProjectKnowledge,
  StagedDocumentationKnowledge,
  StagedDocumentationStageExecution,
  StagedDocumentationStageId,
  StagedDocumentationStatus,
} from '../knowledge';

export const ARCHITECTURE_STAGE_DOCUMENT_PATHS = ['architecture.md', 'ai-context.md'] as const;

export function getOrCreateStagedDocumentation(
  knowledge: ProjectKnowledge,
): StagedDocumentationKnowledge {
  const existing = knowledge.analysis.stagedDocumentation;
  if (existing !== undefined) {
    return {
      ...existing,
      execution: [...existing.execution],
    };
  }

  return {
    execution: [],
  };
}

export function upsertStageExecution(
  execution: readonly StagedDocumentationStageExecution[],
  update: StagedDocumentationStageExecution,
): StagedDocumentationStageExecution[] {
  const next = execution.filter((entry) => entry.stageId !== update.stageId);
  next.push(update);
  return next.sort((left, right) => left.stageId.localeCompare(right.stageId));
}

export function buildStageExecution(params: {
  stageId: StagedDocumentationStageId;
  status: StagedDocumentationStatus;
  startedAt?: string;
  completedAt?: string;
  provider?: string;
  model?: string;
  warnings?: string[];
  error?: string;
}): StagedDocumentationStageExecution {
  const execution: StagedDocumentationStageExecution = {
    stageId: params.stageId,
    status: params.status,
    warnings: params.warnings ?? [],
  };

  if (params.startedAt !== undefined) {
    execution.startedAt = params.startedAt;
  }
  if (params.completedAt !== undefined) {
    execution.completedAt = params.completedAt;
  }
  if (params.provider !== undefined) {
    execution.provider = params.provider;
  }
  if (params.model !== undefined) {
    execution.model = params.model;
  }
  if (params.error !== undefined) {
    execution.error = params.error;
  }

  return execution;
}

export function withStagedDocumentation(
  knowledge: ProjectKnowledge,
  stagedDocumentation: StagedDocumentationKnowledge,
): ProjectKnowledge {
  return {
    ...knowledge,
    analysis: {
      ...knowledge.analysis,
      status: knowledge.analysis.status === 'pending' ? 'partial' : knowledge.analysis.status,
      stagedDocumentation,
    },
  };
}

export function buildFailedArchitectureStage(params: {
  error: string;
  warnings?: string[];
  provider?: string;
  model?: string;
  generatedAt?: string;
}): ArchitectureStageKnowledge {
  const architecture: ArchitectureStageKnowledge = {
    status: 'failed',
    documentPaths: [...ARCHITECTURE_STAGE_DOCUMENT_PATHS],
    warnings: params.warnings ?? [],
    error: params.error,
  };

  if (params.provider !== undefined) {
    architecture.provider = params.provider;
  }
  if (params.model !== undefined) {
    architecture.model = params.model;
  }
  if (params.generatedAt !== undefined) {
    architecture.generatedAt = params.generatedAt;
  }

  return architecture;
}
