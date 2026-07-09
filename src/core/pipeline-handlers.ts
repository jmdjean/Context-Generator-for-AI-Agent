import { RuntimeConfig } from '../config';
import { AnalysisPipelineStep, RepositoryInfo, TechnologyProfile } from '../domain';
import { DocumentationPlan } from '../domain/documentation-plan';
import { loadRepositoryMetadata } from '../scanner/repository-loader';
import { RepositoryScanStats, scanRepository } from '../scanner/repository-scanner';
import { detectTechnologies } from '../detectors/technology-detector';
import { createDocumentationPlan } from '../docs/documentation-planner';
import { DocumentationWriteResult, writeDocumentation } from '../docs/documentation-writer';
import { DocumentationValidationResult, validateDocumentation } from '../docs/documentation-validator';
import { enrichProjectKnowledgeWithFolderAnalysis, enrichProjectKnowledgeWithModuleAnalysis, enrichProjectKnowledgeWithDependencyGraph, enrichProjectKnowledgeWithConventions, enrichProjectKnowledgeWithNavigationMap } from '../analyzers';
import { buildProjectKnowledge, persistProjectKnowledge, ProjectKnowledge } from '../knowledge';

export interface PipelineContext {
  config: RuntimeConfig;
  repositoryInfo?: RepositoryInfo;
  technologyProfile?: TechnologyProfile;
  documentationPlan?: DocumentationPlan;
  projectKnowledge?: ProjectKnowledge;
  scanStats?: RepositoryScanStats;
  documentationWriteResult?: DocumentationWriteResult;
  validationResult?: DocumentationValidationResult;
}

export type StepHandlerResult = {
  status: 'completed' | 'skipped';
  message: string;
};

export type StepHandler = (
  context: PipelineContext,
  step: AnalysisPipelineStep,
) => Promise<StepHandlerResult>;

function placeholderResult(step: AnalysisPipelineStep): StepHandlerResult {
  return {
    status: 'skipped',
    message: `skipped: ${step.name} is not implemented yet`,
  };
}

export async function handleResolveConfiguration(context: PipelineContext): Promise<StepHandlerResult> {
  return {
    status: 'completed',
    message: `target: ${context.config.targetProjectPath}`,
  };
}

export async function handleLoadRepositoryMetadata(context: PipelineContext): Promise<StepHandlerResult> {
  context.repositoryInfo = loadRepositoryMetadata(context.config);
  return {
    status: 'completed',
    message: `loaded metadata for "${context.repositoryInfo.name}"`,
  };
}

export async function handleScanRepositoryStructure(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.repositoryInfo) {
    return placeholderResult(step);
  }

  const scanResult = scanRepository(context.repositoryInfo, {
    outputDocsDir: context.config.docsDir,
  });

  context.repositoryInfo.repositoryTree = scanResult.tree;
  context.repositoryInfo.ignoredPaths = scanResult.ignoredPaths;
  context.scanStats = scanResult.stats;

  return {
    status: 'completed',
    message: `scanned ${scanResult.stats.filesScanned} file(s) across ${scanResult.stats.directoriesScanned} director(ies)`,
  };
}

export async function handleDetectTechnologies(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.repositoryInfo) {
    return placeholderResult(step);
  }

  context.technologyProfile = detectTechnologies(context.repositoryInfo);
  return {
    status: 'completed',
    message: `detected ${context.technologyProfile.languages.length} language(s)`,
  };
}

export async function handleGenerateDocumentationPlan(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.technologyProfile) {
    return placeholderResult(step);
  }

  context.documentationPlan = createDocumentationPlan(
    context.config.docsDir,
    context.technologyProfile,
  );

  return {
    status: 'completed',
    message: `planned ${context.documentationPlan.documents.length} documents (strategy: ${context.documentationPlan.strategy})`,
  };
}

export async function handleBuildProjectKnowledge(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.repositoryInfo || !context.technologyProfile || !context.documentationPlan) {
    return placeholderResult(step);
  }

  context.projectKnowledge = buildProjectKnowledge({
    repositoryInfo: context.repositoryInfo,
    technologyProfile: context.technologyProfile,
    documentationPlan: context.documentationPlan,
  });

  const { metadata } = context.projectKnowledge;
  return {
    status: 'completed',
    message: `assembled PKM for "${metadata.projectName}" (schema: ${metadata.schemaVersion})`,
  };
}

export async function handleAnalyzeFolderKnowledge(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, result } = enrichProjectKnowledgeWithFolderAnalysis(context.projectKnowledge);
  context.projectKnowledge = knowledge;

  return {
    status: 'completed',
    message: `analyzed ${result.totalFolders} folder(s), ${result.documentableFolders} documentable`,
  };
}

export async function handleAnalyzeModules(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, result } = enrichProjectKnowledgeWithModuleAnalysis(context.projectKnowledge);
  context.projectKnowledge = knowledge;

  return {
    status: 'completed',
    message: `discovered ${result.totalModules} module(s), ${result.highConfidenceModules} high confidence`,
  };
}

export async function handleAnalyzeDependencyGraph(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, result } = enrichProjectKnowledgeWithDependencyGraph(context.projectKnowledge);
  context.projectKnowledge = knowledge;

  return {
    status: 'completed',
    message: `built dependency graph with ${result.totalNodes} node(s) and ${result.totalEdges} edge(s)`,
  };
}

export async function handleAnalyzeConventions(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, result } = enrichProjectKnowledgeWithConventions(context.projectKnowledge);
  context.projectKnowledge = knowledge;

  return {
    status: 'completed',
    message: `detected ${result.totalConventions} convention(s), ${result.highConfidenceConventions} high confidence`,
  };
}

export async function handleBuildNavigationMap(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, result } = enrichProjectKnowledgeWithNavigationMap(context.projectKnowledge);
  context.projectKnowledge = knowledge;

  return {
    status: 'completed',
    message: `built navigation map with ${result.totalEntries} entr(ies), ${result.highConfidenceEntries} high confidence`,
  };
}

export async function handleWriteDocumentation(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const writeResult = writeDocumentation(context.projectKnowledge);
  context.documentationWriteResult = writeResult;

  return {
    status: 'completed',
    message: `written ${writeResult.writtenCount}, skipped ${writeResult.skippedCount}`,
  };
}

export async function handleValidateDocumentation(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge || !context.documentationWriteResult) {
    return placeholderResult(step);
  }

  const validationResult = validateDocumentation(context.projectKnowledge);
  context.validationResult = validationResult;

  return {
    status: 'completed',
    message: `${validationResult.status} with ${validationResult.errors.length} error(s), ${validationResult.warnings.length} warning(s)`,
  };
}

export async function handlePersistProjectKnowledge(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const persistenceResult = persistProjectKnowledge(context.projectKnowledge);

  return {
    status: 'completed',
    message: `persisted ${persistenceResult.persistedRelativePaths.length} knowledge files`,
  };
}

export const STEP_HANDLERS: Record<string, StepHandler> = {
  'Resolve Configuration': handleResolveConfiguration,
  'Load Repository Metadata': handleLoadRepositoryMetadata,
  'Scan Repository Structure': handleScanRepositoryStructure,
  'Detect Technologies': handleDetectTechnologies,
  'Generate Documentation Plan': handleGenerateDocumentationPlan,
  'Build Project Knowledge': handleBuildProjectKnowledge,
  'Analyze Folder Knowledge': handleAnalyzeFolderKnowledge,
  'Analyze Modules': handleAnalyzeModules,
  'Analyze Dependency Graph': handleAnalyzeDependencyGraph,
  'Analyze Conventions': handleAnalyzeConventions,
  'Build AI Navigation Map': handleBuildNavigationMap,
  'Write Documentation': handleWriteDocumentation,
  'Validate Documentation': handleValidateDocumentation,
  'Persist Project Knowledge': handlePersistProjectKnowledge,
};

export async function runStepHandler(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  const handler = STEP_HANDLERS[step.name];
  if (!handler) {
    return placeholderResult(step);
  }

  return handler(context, step);
}
