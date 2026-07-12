import * as path from 'node:path';
import { RuntimeConfig } from '../config';
import { formatRunSummaryChangeDetectionLines, formatRunSummaryDocumentImpactLines } from '../incremental';
import {
  ChangeSummaryKnowledge,
  DocumentImpactSummaryKnowledge,
  ProjectKnowledge,
  TechnologyKnowledge,
} from '../knowledge';
import { PipelineRunMetrics } from './pipeline-metrics';
import { PipelineExecutionResult } from './pipeline-orchestrator';

export interface RunSummaryInput {
  config: RuntimeConfig;
  result: PipelineExecutionResult;
}

/** JSON-serializable run summary for CLI formatting and (later) Web UI responses. Never includes secrets. */
export interface RunSummaryData {
  headline: string;
  success: boolean;
  projectName: string;
  targetProjectPath: string;
  docsDir: string;
  durationLabel: string;
  pipeline: {
    completed: number;
    skipped: number;
    failed: number;
  };
  /** Present when project knowledge was produced; omitted from CLI when null. */
  technologies: string[] | null;
  knowledge: {
    repositoryTreeGenerated: boolean;
    filesScanned: number;
    foldersAnalyzed: number;
    modulesDiscovered: number;
    dependencyEdges: number;
    conventionsDetected: number;
    navigationEntries: number;
    knowledgeFilesPersisted: number;
  };
  aiAnalysis: {
    provider: string;
    model: string;
    insightsGenerated: string;
    architectureGenerated: string;
    moduleDocumentation: string | null;
  } | null;
  agentExports: {
    status: 'not_run' | 'completed';
    targets?: string[];
    filesWritten?: number;
    filesSkipped?: number;
    warnings: string[];
  } | null;
  changeDetection: ChangeSummaryKnowledge | null;
  documentImpact: DocumentImpactSummaryKnowledge | null;
  documentation: {
    planned: number;
    written: number;
    skipped?: number;
    skippedUnchanged?: number;
    skippedProtected?: number;
    selective: boolean;
  };
  aiReadiness: {
    overallScore: number;
    level: string;
    criticalGaps: number;
    recommendations: number;
  } | null;
  validation: {
    status: string;
    errorCount?: number;
    warningCount?: number;
    details: Array<{
      severity: string;
      message: string;
      relativePath?: string;
    }>;
    remainingCount: number;
  };
  errors: Array<{
    stepName: string;
    message: string;
  }>;
  nextSteps: string[] | null;
}

const MAX_VALIDATION_DETAILS = 3;

function collectTechnologies(technologies: TechnologyKnowledge): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const item of [
    ...technologies.languages,
    ...technologies.frameworks,
    ...technologies.packageManagers,
    ...technologies.tooling,
  ]) {
    if (!seen.has(item)) {
      seen.add(item);
      ordered.push(item);
    }
  }

  return ordered;
}

function stepCompleted(result: PipelineExecutionResult, stepName: string): boolean {
  return result.steps.some((step) => step.name === stepName && step.status === 'completed');
}

function resolveMetricValue(
  result: PipelineExecutionResult,
  stepName: string,
  metricValue: number,
  knowledgeValue: number | undefined,
): number {
  if (stepCompleted(result, stepName)) {
    return metricValue;
  }

  return knowledgeValue ?? 0;
}

function resolveMetrics(
  metrics: PipelineRunMetrics,
  result: PipelineExecutionResult,
): PipelineRunMetrics {
  const knowledge = result.projectKnowledge;
  if (!knowledge) {
    return metrics;
  }

  return {
    filesScanned: stepCompleted(result, 'Scan Repository Structure')
      ? metrics.filesScanned
      : 0,
    repositoryTreeGenerated:
      stepCompleted(result, 'Scan Repository Structure') && metrics.repositoryTreeGenerated,
    foldersAnalyzed: resolveMetricValue(
      result,
      'Analyze Folder Knowledge',
      metrics.foldersAnalyzed,
      knowledge.analysis.folderContexts?.length,
    ),
    modulesDiscovered: resolveMetricValue(
      result,
      'Analyze Modules',
      metrics.modulesDiscovered,
      knowledge.analysis.modules?.length,
    ),
    dependencyEdges: resolveMetricValue(
      result,
      'Analyze Dependency Graph',
      metrics.dependencyEdges,
      knowledge.analysis.dependencyGraph?.edges.length,
    ),
    conventionsDetected: resolveMetricValue(
      result,
      'Analyze Conventions',
      metrics.conventionsDetected,
      knowledge.analysis.conventions?.length,
    ),
    navigationEntries: resolveMetricValue(
      result,
      'Build AI Navigation Map',
      metrics.navigationEntries,
      knowledge.analysis.navigationMap?.entries.length,
    ),
    runCommandsDetected: resolveMetricValue(
      result,
      'Analyze Operational Context',
      metrics.runCommandsDetected,
      knowledge.analysis.operationalContext?.runCommands?.length,
    ),
    envVarsDetected: resolveMetricValue(
      result,
      'Analyze Operational Context',
      metrics.envVarsDetected,
      knowledge.analysis.operationalContext?.envVars?.length,
    ),
    aiInsightsGenerated:
      stepCompleted(result, 'Generate Architecture Context') && metrics.aiInsightsGenerated,
    aiInsightsAttempted: metrics.aiInsightsAttempted,
    moduleDocumentationGenerated:
      stepCompleted(result, 'Generate Module Documentation') && metrics.moduleDocumentationGenerated,
    moduleDocumentationAttempted: metrics.moduleDocumentationAttempted,
    moduleDocumentationCompleted: stepCompleted(result, 'Generate Module Documentation')
      ? metrics.moduleDocumentationCompleted
      : 0,
    moduleDocumentationFailed: stepCompleted(result, 'Generate Module Documentation')
      ? metrics.moduleDocumentationFailed
      : 0,
    moduleDocumentationSkipped: stepCompleted(result, 'Generate Module Documentation')
      ? metrics.moduleDocumentationSkipped
      : 0,
    knowledgeFilesPersisted: stepCompleted(result, 'Persist Project Knowledge')
      ? metrics.knowledgeFilesPersisted
      : 0,
    documentationWrite: metrics.documentationWrite,
    validation: metrics.validation,
    agentExports: metrics.agentExports,
  };
}

function formatDuration(startedAt: string, finishedAt: string): string {
  const durationMs = Date.parse(finishedAt) - Date.parse(startedAt);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 'unknown';
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatPipelineSummary(stepCounts: {
  completed: number;
  skipped: number;
  failed: number;
}): string {
  const parts = [
    `${stepCounts.completed} completed`,
    `${stepCounts.skipped} skipped`,
  ];

  if (stepCounts.failed > 0) {
    parts.push(`${stepCounts.failed} failed`);
  }

  return `Pipeline: ${parts.join(', ')}`;
}

function countStepsByStatus(result: PipelineExecutionResult): {
  completed: number;
  skipped: number;
  failed: number;
} {
  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (const step of result.steps) {
    if (step.status === 'completed') {
      completed += 1;
    } else if (step.status === 'skipped') {
      skipped += 1;
    } else if (step.status === 'failed') {
      failed += 1;
    }
  }

  return { completed, skipped, failed };
}

function buildHeadline(result: PipelineExecutionResult): string {
  if (result.metrics.validation?.status === 'failed') {
    return 'AI Project Docs completed with validation errors';
  }

  if (result.errors.length > 0) {
    return 'AI Project Docs completed with errors';
  }

  return 'AI Project Docs completed';
}

function formatInsightsGenerated(metrics: PipelineRunMetrics): string {
  if (metrics.aiInsightsGenerated) {
    return 'yes';
  }
  if (metrics.aiInsightsAttempted) {
    return 'no (see warnings)';
  }
  return 'no';
}

function formatModuleDocumentationSummary(
  config: RuntimeConfig,
  metrics: PipelineRunMetrics,
): string | null {
  if (!config.enableModuleDocumentation) {
    return 'skipped (--skip-module-docs)';
  }

  if (!metrics.moduleDocumentationAttempted && !metrics.moduleDocumentationGenerated) {
    return 'not run';
  }

  if (metrics.moduleDocumentationGenerated) {
    const parts = [
      `${metrics.moduleDocumentationCompleted} completed`,
      `${metrics.moduleDocumentationFailed} failed`,
    ];
    if (metrics.moduleDocumentationSkipped > 0) {
      parts.push(`${metrics.moduleDocumentationSkipped} skipped`);
    }
    return parts.join(', ');
  }

  if (metrics.moduleDocumentationAttempted) {
    return 'no (see warnings)';
  }

  return 'not run';
}

function resolveAiAnalysisModel(
  config: RuntimeConfig,
  knowledge: ProjectKnowledge | undefined,
  insightsGenerated: boolean,
): string {
  if (insightsGenerated) {
    return (
      knowledge?.analysis.stagedDocumentation?.architecture?.model ??
      knowledge?.analysis.aiInsights?.model ??
      config.aiModel
    );
  }

  return config.aiModel;
}

function buildAiAnalysisData(
  config: RuntimeConfig,
  metrics: PipelineRunMetrics,
  knowledge: ProjectKnowledge | undefined,
): RunSummaryData['aiAnalysis'] {
  if (!config.enableAiAnalysis) {
    return null;
  }

  return {
    provider: config.aiProvider,
    model: resolveAiAnalysisModel(config, knowledge, metrics.aiInsightsGenerated),
    insightsGenerated: formatInsightsGenerated(metrics),
    architectureGenerated: formatInsightsGenerated(metrics),
    moduleDocumentation: formatModuleDocumentationSummary(config, metrics),
  };
}

function buildAgentExportsData(
  config: RuntimeConfig,
  metrics: PipelineRunMetrics,
): RunSummaryData['agentExports'] {
  if (!config.enableAgentExports) {
    return null;
  }

  if (!metrics.agentExports) {
    return {
      status: 'not_run',
      warnings: [],
    };
  }

  return {
    status: 'completed',
    targets: [...metrics.agentExports.enabledTargets],
    filesWritten: metrics.agentExports.filesWritten,
    filesSkipped: metrics.agentExports.filesSkipped,
    warnings: [...metrics.agentExports.warnings],
  };
}

function buildDocumentImpactData(
  knowledge: ProjectKnowledge | undefined,
): DocumentImpactSummaryKnowledge | null {
  const impactSummary = knowledge?.analysis.documentImpact;

  // On an initial run every planned document is impacted by definition,
  // so the section adds no information.
  if (!impactSummary || knowledge?.analysis.changeSummary?.isInitialRun) {
    return null;
  }

  return impactSummary;
}

function buildDocumentationData(
  metrics: PipelineRunMetrics,
  knowledge: ProjectKnowledge | undefined,
): RunSummaryData['documentation'] {
  const writeResult = metrics.documentationWrite;
  const selective = knowledge?.analysis.documentImpact !== undefined;

  if (!writeResult) {
    return {
      planned: 0,
      written: 0,
      skipped: 0,
      selective: false,
    };
  }

  const plannedDocuments = writeResult.writtenCount + writeResult.skippedCount;

  if (selective) {
    return {
      planned: plannedDocuments,
      written: writeResult.writtenCount,
      skippedUnchanged: writeResult.skippedUnchangedCount,
      skippedProtected: writeResult.skippedProtectedCount,
      selective: true,
    };
  }

  return {
    planned: plannedDocuments,
    written: writeResult.writtenCount,
    skipped: writeResult.skippedCount,
    selective: false,
  };
}

function buildAiReadinessData(
  knowledge: ProjectKnowledge | undefined,
): RunSummaryData['aiReadiness'] {
  const readiness = knowledge?.analysis.aiReadiness;

  if (!readiness) {
    return null;
  }

  return {
    overallScore: readiness.overallScore,
    level: readiness.level,
    criticalGaps: readiness.gaps.filter((gap) => gap.severity === 'critical').length,
    recommendations: readiness.recommendations.length,
  };
}

function buildValidationData(metrics: PipelineRunMetrics): RunSummaryData['validation'] {
  if (!metrics.validation) {
    return {
      status: 'not run',
      details: [],
      remainingCount: 0,
    };
  }

  const issues = metrics.validation.issues;
  const details = issues.slice(0, MAX_VALIDATION_DETAILS).map((issue) => ({
    severity: issue.severity,
    message: issue.message,
    ...(issue.relativePath !== undefined ? { relativePath: issue.relativePath } : {}),
  }));

  return {
    status: metrics.validation.status,
    errorCount: metrics.validation.errorCount,
    warningCount: metrics.validation.warningCount,
    details,
    remainingCount: Math.max(0, issues.length - details.length),
  };
}

function buildNextSteps(
  config: RuntimeConfig,
  knowledge: ProjectKnowledge | undefined,
  success: boolean,
): string[] | null {
  if (!success) {
    return null;
  }

  const steps = [
    `Review ${config.docsDir}/README.md`,
    `Share ${config.docsDir}/agent-navigation.md with your AI coding agent`,
    `Load ${config.docsDir}/knowledge/project-knowledge.json for machine-readable context`,
  ];

  if (knowledge?.analysis.aiReadiness) {
    steps.push(
      `Review ${config.docsDir}/ai-readiness.md for the Context Engineering readiness assessment`,
    );
  }

  const changeSummary = knowledge?.analysis.changeSummary;
  if (changeSummary && !changeSummary.isInitialRun) {
    steps.push(
      `Inspect ${config.docsDir}/knowledge/change-summary.json for PKM diffs since the last run`,
    );
    steps.push(
      `Inspect ${config.docsDir}/knowledge/document-impact.json for selective regeneration decisions`,
    );
  }

  return steps;
}

/**
 * Builds a JSON-serializable summary from pipeline results.
 * Does not include API keys or other secrets from {@link RuntimeConfig}.
 */
export function buildRunSummaryData(input: RunSummaryInput): RunSummaryData {
  const { config, result } = input;
  const metrics = resolveMetrics(result.metrics, result);
  const knowledge = result.projectKnowledge;
  const projectName =
    knowledge?.metadata.projectName ?? path.basename(config.targetProjectPath);
  const stepCounts = countStepsByStatus(result);
  const success = isPipelineSuccessful(result);

  return {
    headline: buildHeadline(result),
    success,
    projectName,
    targetProjectPath: config.targetProjectPath,
    docsDir: config.docsDir,
    durationLabel: formatDuration(result.startedAt, result.finishedAt),
    pipeline: stepCounts,
    technologies: knowledge ? collectTechnologies(knowledge.technologies) : null,
    knowledge: {
      repositoryTreeGenerated: metrics.repositoryTreeGenerated,
      filesScanned: metrics.filesScanned,
      foldersAnalyzed: metrics.foldersAnalyzed,
      modulesDiscovered: metrics.modulesDiscovered,
      dependencyEdges: metrics.dependencyEdges,
      conventionsDetected: metrics.conventionsDetected,
      navigationEntries: metrics.navigationEntries,
      knowledgeFilesPersisted: metrics.knowledgeFilesPersisted,
    },
    aiAnalysis: buildAiAnalysisData(config, metrics, knowledge),
    agentExports: buildAgentExportsData(config, metrics),
    changeDetection: knowledge?.analysis.changeSummary ?? null,
    documentImpact: buildDocumentImpactData(knowledge),
    documentation: buildDocumentationData(metrics, knowledge),
    aiReadiness: buildAiReadinessData(knowledge),
    validation: buildValidationData(metrics),
    errors: result.errors.map((error) => ({
      stepName: error.stepName,
      message: error.message,
    })),
    nextSteps: buildNextSteps(config, knowledge, success),
  };
}

function formatAiAnalysisSection(data: NonNullable<RunSummaryData['aiAnalysis']>): string[] {
  const lines = [
    '',
    'AI Analysis:',
    `- Provider: ${data.provider}`,
    `- Model: ${data.model}`,
    `- Architecture context: ${data.architectureGenerated}`,
    `- Insights generated: ${data.insightsGenerated}`,
  ];

  if (data.moduleDocumentation !== null) {
    lines.push(`- Module documentation: ${data.moduleDocumentation}`);
  }

  return lines;
}

function formatAgentExportsSection(data: NonNullable<RunSummaryData['agentExports']>): string[] {
  const lines = ['', 'Agent exporters:'];

  if (data.status === 'not_run') {
    lines.push('- Status: not run');
    return lines;
  }

  lines.push(
    `- Targets: ${(data.targets ?? []).join(', ')}`,
    `- Files written: ${data.filesWritten ?? 0}`,
    `- Files skipped: ${data.filesSkipped ?? 0}`,
  );

  for (const warning of data.warnings.slice(0, 3)) {
    lines.push(`- Warning: ${warning}`);
  }

  const remainingWarnings = data.warnings.length - 3;
  if (remainingWarnings > 0) {
    lines.push(`- ...and ${remainingWarnings} more export warning(s)`);
  }

  return lines;
}

function formatDocumentationSection(data: RunSummaryData['documentation']): string[] {
  if (data.selective) {
    return [
      '',
      'Documentation:',
      `- Planned: ${data.planned}`,
      `- Written: ${data.written}`,
      `- Skipped unchanged: ${data.skippedUnchanged ?? 0}`,
      `- Skipped protected: ${data.skippedProtected ?? 0}`,
    ];
  }

  return [
    '',
    'Documentation:',
    `- Planned: ${data.planned}`,
    `- Written: ${data.written}`,
    `- Skipped: ${data.skipped ?? 0}`,
  ];
}

function formatAiReadinessSection(data: NonNullable<RunSummaryData['aiReadiness']>): string[] {
  return [
    '',
    'AI Readiness:',
    `- Score: ${data.overallScore}/100`,
    `- Level: ${data.level}`,
    `- Critical gaps: ${data.criticalGaps}`,
    `- Recommendations: ${data.recommendations}`,
  ];
}

function formatValidationSection(data: RunSummaryData['validation']): string[] {
  const lines = ['', 'Validation:'];

  if (data.status === 'not run') {
    lines.push('- Status: not run');
    return lines;
  }

  lines.push(
    `- Errors: ${data.errorCount ?? 0}`,
    `- Warnings: ${data.warningCount ?? 0}`,
    `- Status: ${data.status}`,
  );

  for (const issue of data.details) {
    const location = issue.relativePath ? ` (${issue.relativePath})` : '';
    lines.push(`  - ${issue.severity}: ${issue.message}${location}`);
  }

  if (data.remainingCount > 0) {
    lines.push(`  - ...and ${data.remainingCount} more`);
  }

  return lines;
}

function formatRunSummaryFromData(data: RunSummaryData): string[] {
  const lines: string[] = [
    '',
    data.headline,
    '',
    `Project: ${data.projectName}`,
    `Target: ${data.targetProjectPath}`,
    `Docs: ${data.docsDir}`,
    `Duration: ${data.durationLabel}`,
    formatPipelineSummary(data.pipeline),
  ];

  if (data.technologies !== null) {
    lines.push(
      `Technologies: ${data.technologies.length > 0 ? data.technologies.join(', ') : 'none detected'}`,
    );
  }

  lines.push(
    '',
    'Knowledge:',
    `- Repository tree: ${data.knowledge.repositoryTreeGenerated ? 'generated' : 'not generated'}`,
    `- Files scanned: ${data.knowledge.filesScanned}`,
    `- Folders analyzed: ${data.knowledge.foldersAnalyzed}`,
    `- Modules discovered: ${data.knowledge.modulesDiscovered}`,
    `- Dependency edges: ${data.knowledge.dependencyEdges}`,
    `- Conventions detected: ${data.knowledge.conventionsDetected}`,
    `- Navigation entries: ${data.knowledge.navigationEntries}`,
    `- Knowledge files persisted: ${data.knowledge.knowledgeFilesPersisted}`,
  );

  if (data.aiAnalysis) {
    lines.push(...formatAiAnalysisSection(data.aiAnalysis));
  }

  if (data.agentExports) {
    lines.push(...formatAgentExportsSection(data.agentExports));
  }

  if (data.changeDetection) {
    lines.push(...formatRunSummaryChangeDetectionLines(data.changeDetection));
  }

  if (data.documentImpact) {
    lines.push(...formatRunSummaryDocumentImpactLines(data.documentImpact));
  }

  lines.push(...formatDocumentationSection(data.documentation));

  if (data.aiReadiness) {
    lines.push(...formatAiReadinessSection(data.aiReadiness));
  }

  lines.push(...formatValidationSection(data.validation));

  if (data.errors.length > 0) {
    lines.push('', 'Errors:');
    for (const error of data.errors) {
      lines.push(`- ${error.stepName}: ${error.message}`);
    }
  }

  if (data.nextSteps) {
    lines.push('', 'Next steps:');
    for (const step of data.nextSteps) {
      lines.push(`- ${step}`);
    }
  }

  lines.push('');
  return lines;
}

export function formatRunSummary(input: RunSummaryInput): string[] {
  return formatRunSummaryFromData(buildRunSummaryData(input));
}

export function printRunSummary(input: RunSummaryInput): void {
  for (const line of formatRunSummary(input)) {
    console.log(line);
  }
}

export function isPipelineSuccessful(result: PipelineExecutionResult): boolean {
  return result.success;
}
