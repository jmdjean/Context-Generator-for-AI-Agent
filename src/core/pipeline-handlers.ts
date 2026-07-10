import { RuntimeConfig } from '../config';
import { AnalysisPipelineStep, RepositoryInfo, TechnologyProfile } from '../domain';
import { DocumentationPlan } from '../domain/documentation-plan';
import { loadRepositoryMetadata } from '../scanner/repository-loader';
import { scanRepository } from '../scanner/repository-scanner';
import { detectTechnologies } from '../detectors/technology-detector';
import { createDocumentationPlan } from '../docs/documentation-planner';
import { writeDocumentation } from '../docs/documentation-writer';
import { validateDocumentation } from '../docs/documentation-validator';
import { runAiAnalysis } from '../ai';
import { buildProjectKnowledge, persistProjectKnowledge, ProjectKnowledge } from '../knowledge';
import { enrichProjectKnowledgeWithIncrementalAnalysis, describeIncrementalAnalysis } from '../incremental';
import { runAgentExports, summarizeAgentExportResults } from '../exporters';
import { ANALYZER_PLUGIN_IDS, executeAnalyzerPluginStep } from '../plugins/pipeline-integration';
import { createEmptyPipelineMetrics, PipelineRunMetrics } from './pipeline-metrics';

export interface PipelineContext {
  config: RuntimeConfig;
  metrics: PipelineRunMetrics;
  repositoryInfo?: RepositoryInfo;
  technologyProfile?: TechnologyProfile;
  documentationPlan?: DocumentationPlan;
  projectKnowledge?: ProjectKnowledge;
}

export type StepHandlerResult = {
  status: 'completed' | 'skipped' | 'failed';
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
  context.metrics.filesScanned = scanResult.stats.filesScanned;
  context.metrics.repositoryTreeGenerated = true;

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

  const { knowledge, stepStatus, message, metrics } = executeAnalyzerPluginStep(
    ANALYZER_PLUGIN_IDS.folder,
    context.projectKnowledge,
    context.config,
  );
  context.projectKnowledge = knowledge;
  context.metrics.foldersAnalyzed = metrics.foldersAnalyzed ?? 0;

  return {
    status: stepStatus,
    message,
  };
}

export async function handleAnalyzeModules(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, stepStatus, message, metrics } = executeAnalyzerPluginStep(
    ANALYZER_PLUGIN_IDS.module,
    context.projectKnowledge,
    context.config,
  );
  context.projectKnowledge = knowledge;
  context.metrics.modulesDiscovered = metrics.modulesDiscovered ?? 0;

  return {
    status: stepStatus,
    message,
  };
}

export async function handleAnalyzeDependencyGraph(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, stepStatus, message, metrics } = executeAnalyzerPluginStep(
    ANALYZER_PLUGIN_IDS.dependency,
    context.projectKnowledge,
    context.config,
  );
  context.projectKnowledge = knowledge;
  context.metrics.dependencyEdges = metrics.dependencyEdges ?? 0;

  return {
    status: stepStatus,
    message,
  };
}

export async function handleAnalyzeConventions(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, stepStatus, message, metrics } = executeAnalyzerPluginStep(
    ANALYZER_PLUGIN_IDS.convention,
    context.projectKnowledge,
    context.config,
  );
  context.projectKnowledge = knowledge;
  context.metrics.conventionsDetected = metrics.conventionsDetected ?? 0;

  return {
    status: stepStatus,
    message,
  };
}

export async function handleBuildNavigationMap(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, stepStatus, message, metrics } = executeAnalyzerPluginStep(
    ANALYZER_PLUGIN_IDS.navigation,
    context.projectKnowledge,
    context.config,
  );
  context.projectKnowledge = knowledge;
  context.metrics.navigationEntries = metrics.navigationEntries ?? 0;

  return {
    status: stepStatus,
    message,
  };
}

export async function handleAnalyzeAiInsights(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  if (!context.config.enableAiAnalysis) {
    return {
      status: 'skipped',
      message: 'skipped: --ai not provided',
    };
  }

  if (!context.config.openRouterApiKey) {
    console.warn(
      'Warning: --ai was provided but no OpenRouter API key was found. Set OPENROUTER_API_KEY or pass --openrouter-key. Skipping AI analysis.',
    );
    context.metrics.aiInsightsAttempted = true;
    return {
      status: 'skipped',
      message: 'skipped: OpenRouter API key missing',
    };
  }

  const analysisResult = await runAiAnalysis(context.projectKnowledge, {
    apiKey: context.config.openRouterApiKey,
    model: context.config.aiModel,
  });

  context.projectKnowledge = analysisResult.knowledge;
  context.metrics.aiInsightsGenerated = analysisResult.insightsGenerated;
  context.metrics.aiInsightsAttempted = analysisResult.attempted;

  for (const warning of analysisResult.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  return {
    status: analysisResult.insightsGenerated ? 'completed' : 'skipped',
    message: analysisResult.message,
  };
}

export async function handleWriteDocumentation(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const impactSummary = context.projectKnowledge.analysis.documentImpact;
  const writeResult = writeDocumentation(context.projectKnowledge, impactSummary);
  context.metrics.documentationWrite = writeResult;

  const messageParts = [`written ${writeResult.writtenCount}`];
  if (impactSummary !== undefined) {
    messageParts.push(`skipped unchanged ${writeResult.skippedUnchangedCount}`);
  } else {
    messageParts.push(`skipped ${writeResult.skippedCount}`);
  }
  if (writeResult.skippedProtectedCount > 0) {
    messageParts.push(`skipped protected ${writeResult.skippedProtectedCount}`);
  }

  return {
    status: 'completed',
    message: messageParts.join(', '),
  };
}

export async function handleValidateDocumentation(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge || !context.metrics.documentationWrite) {
    return placeholderResult(step);
  }

  const validationResult = validateDocumentation(
    context.projectKnowledge,
    context.metrics.documentationWrite,
  );
  context.metrics.validation = validationResult;

  const message = `${validationResult.status} (${validationResult.errorCount} error(s), ${validationResult.warningCount} warning(s))`;

  return {
    status: validationResult.status === 'failed' ? 'failed' : 'completed',
    message,
  };
}

export async function handleDetectChanges(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  const { knowledge, changeSummary, impactSummary } =
    enrichProjectKnowledgeWithIncrementalAnalysis(context.projectKnowledge);
  context.projectKnowledge = knowledge;

  for (const warning of changeSummary.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  return {
    status: 'completed',
    message: describeIncrementalAnalysis(changeSummary, impactSummary),
  };
}

export async function handleExportAgentContext(
  context: PipelineContext,
  step: AnalysisPipelineStep,
): Promise<StepHandlerResult> {
  if (!context.projectKnowledge) {
    return placeholderResult(step);
  }

  if (!context.config.enableAgentExports) {
    return {
      status: 'skipped',
      message: 'skipped: --export-agents not provided',
    };
  }

  const { knowledge, summary } = runAgentExports({
    knowledge: context.projectKnowledge,
    targetProjectPath: context.config.targetProjectPath,
    docsDir: context.config.docsDir,
    enabledTargets: context.config.exportTargets,
  });

  context.projectKnowledge = knowledge;
  const totals = summarizeAgentExportResults(summary);
  context.metrics.agentExports = {
    enabled: true,
    enabledTargets: summary.enabledTargets,
    filesWritten: totals.filesWritten,
    filesSkipped: totals.filesSkipped,
    warnings: totals.warnings,
  };

  return {
    status: 'completed',
    message: `exported ${totals.filesWritten} file(s), skipped ${totals.filesSkipped}`,
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
  context.metrics.knowledgeFilesPersisted = persistenceResult.persistedRelativePaths.length;

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
  'Analyze AI Insights': handleAnalyzeAiInsights,
  'Detect Changes': handleDetectChanges,
  'Write Documentation': handleWriteDocumentation,
  'Validate Documentation': handleValidateDocumentation,
  'Export Agent Context': handleExportAgentContext,
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
