import { RuntimeConfig } from '../config';
import { AnalysisPipelineStep, RepositoryInfo, TechnologyProfile } from '../domain';
import { DocumentationPlan } from '../domain/documentation-plan';
import { loadRepositoryMetadata } from '../scanner/repository-loader';
import { scanRepository } from '../scanner/repository-scanner';
import { detectTechnologies } from '../detectors/technology-detector';
import { createDocumentationPlan } from '../docs/documentation-planner';
import { writeDocumentation } from '../docs/documentation-writer';
import { enrichProjectKnowledgeWithFolderAnalysis, enrichProjectKnowledgeWithModuleAnalysis, enrichProjectKnowledgeWithDependencyGraph, enrichProjectKnowledgeWithConventions, enrichProjectKnowledgeWithNavigationMap } from '../analyzers';
import { buildProjectKnowledge, persistProjectKnowledge, ProjectKnowledge } from '../knowledge';

export interface PipelineContext {
  config: RuntimeConfig;
  repositoryInfo?: RepositoryInfo;
  technologyProfile?: TechnologyProfile;
  documentationPlan?: DocumentationPlan;
  projectKnowledge?: ProjectKnowledge;
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

  console.log('');
  console.log('Repository scanner:');
  console.log(`Files scanned: ${scanResult.stats.filesScanned}`);
  console.log(`Directories scanned: ${scanResult.stats.directoriesScanned}`);
  console.log(`Max depth reached: ${scanResult.stats.maxDepthReached}`);
  console.log(`Limit reached: ${scanResult.stats.limitReached}`);
  if (scanResult.stats.permissionDenied) {
    console.log('Permission denied: true');
  }
  if (scanResult.stats.symlinksSkipped > 0) {
    console.log(`Symlinks skipped: ${scanResult.stats.symlinksSkipped}`);
  }

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

  console.log('');
  console.log('Folder analyzer:');
  console.log(`Folders analyzed: ${result.totalFolders}`);
  console.log(`Documentable folders: ${result.documentableFolders}`);
  console.log(`Ignored folders: ${result.ignoredFolders}`);

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

  console.log('');
  console.log('Module analyzer:');
  console.log(`Modules discovered: ${result.totalModules}`);
  console.log(`High confidence: ${result.highConfidenceModules}`);
  console.log(`Medium confidence: ${result.mediumConfidenceModules}`);

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

  console.log('');
  console.log('Dependency graph:');
  console.log(`Nodes: ${result.totalNodes}`);
  console.log(`Edges: ${result.totalEdges}`);
  console.log(`Imports analyzed: ${result.importsAnalyzed}`);
  if (result.filesSkipped > 0) {
    console.log(`Files skipped: ${result.filesSkipped}`);
  }

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

  console.log('');
  console.log('Convention analyzer:');
  console.log(`Conventions detected: ${result.totalConventions}`);
  console.log(`High confidence: ${result.highConfidenceConventions}`);
  console.log(`Medium confidence: ${result.mediumConfidenceConventions}`);
  console.log(`Low confidence: ${result.lowConfidenceConventions}`);

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

  console.log('');
  console.log('AI navigation map:');
  console.log(`Entries: ${result.totalEntries}`);
  console.log(`High confidence: ${result.highConfidenceEntries}`);
  console.log(`Medium confidence: ${result.mediumConfidenceEntries}`);
  console.log(`Low confidence: ${result.lowConfidenceEntries}`);

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
  console.log('');
  console.log('Documentation writer:');
  console.log(`Written: ${writeResult.writtenCount}`);
  console.log(`Skipped: ${writeResult.skippedCount}`);
  console.log(`PKM-powered documents: ${writeResult.pkmPoweredCount}`);
  console.log(`Generic documents: ${writeResult.genericCount}`);
  console.log(`Docs directory: ${writeResult.docsDirectoryPath}`);

  return {
    status: 'completed',
    message: `written ${writeResult.writtenCount}, skipped ${writeResult.skippedCount}`,
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
  console.log('');
  console.log('Project Knowledge:');
  console.log(`Schema version: ${persistenceResult.schemaVersionLabel}`);
  console.log('Persisted:');
  for (const relativePath of persistenceResult.persistedRelativePaths) {
    console.log(`* ${relativePath}`);
  }

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
