import * as path from 'node:path';
import { RuntimeConfig } from '../config';
import { formatRunSummaryChangeDetectionLines, formatRunSummaryDocumentImpactLines } from '../incremental';
import { ProjectKnowledge, TechnologyKnowledge } from '../knowledge';
import { PipelineRunMetrics } from './pipeline-metrics';
import { PipelineExecutionResult } from './pipeline-orchestrator';

export interface RunSummaryInput {
  config: RuntimeConfig;
  result: PipelineExecutionResult;
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
    aiInsightsGenerated:
      stepCompleted(result, 'Analyze AI Insights') && metrics.aiInsightsGenerated,
    aiInsightsAttempted: metrics.aiInsightsAttempted,
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

function appendValidationDetails(lines: string[], metrics: PipelineRunMetrics): void {
  const validation = metrics.validation;
  if (!validation || validation.warningCount + validation.errorCount === 0) {
    return;
  }

  const details = validation.issues.slice(0, MAX_VALIDATION_DETAILS);
  for (const issue of details) {
    const location = issue.relativePath ? ` (${issue.relativePath})` : '';
    lines.push(`  - ${issue.severity}: ${issue.message}${location}`);
  }

  const remaining = validation.issues.length - details.length;
  if (remaining > 0) {
    lines.push(`  - ...and ${remaining} more`);
  }
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

function resolveAiAnalysisModel(
  config: RuntimeConfig,
  knowledge: ProjectKnowledge | undefined,
  insightsGenerated: boolean,
): string {
  if (insightsGenerated) {
    return knowledge?.analysis.aiInsights?.model ?? config.aiModel;
  }

  return config.aiModel;
}

function formatAiAnalysisSection(
  config: RuntimeConfig,
  metrics: PipelineRunMetrics,
  knowledge: ProjectKnowledge | undefined,
): string[] {
  if (!config.enableAiAnalysis) {
    return [];
  }

  return [
    '',
    'AI Analysis:',
    `- Provider: ${config.aiProvider}`,
    `- Model: ${resolveAiAnalysisModel(config, knowledge, metrics.aiInsightsGenerated)}`,
    `- Insights generated: ${formatInsightsGenerated(metrics)}`,
  ];
}

function formatAgentExportsSection(
  config: RuntimeConfig,
  metrics: PipelineRunMetrics,
): string[] {
  if (!config.enableAgentExports) {
    return [];
  }

  const lines = ['', 'Agent exporters:'];

  if (!metrics.agentExports) {
    lines.push('- Status: not run');
    return lines;
  }

  lines.push(
    `- Targets: ${metrics.agentExports.enabledTargets.join(', ')}`,
    `- Files written: ${metrics.agentExports.filesWritten}`,
    `- Files skipped: ${metrics.agentExports.filesSkipped}`,
  );

  for (const warning of metrics.agentExports.warnings.slice(0, 3)) {
    lines.push(`- Warning: ${warning}`);
  }

  const remainingWarnings = metrics.agentExports.warnings.length - 3;
  if (remainingWarnings > 0) {
    lines.push(`- ...and ${remainingWarnings} more export warning(s)`);
  }

  return lines;
}

function formatDocumentImpactSection(knowledge: ProjectKnowledge | undefined): string[] {
  const impactSummary = knowledge?.analysis.documentImpact;

  // On an initial run every planned document is impacted by definition,
  // so the section adds no information.
  if (!impactSummary || knowledge?.analysis.changeSummary?.isInitialRun) {
    return [];
  }

  return formatRunSummaryDocumentImpactLines(impactSummary);
}

function formatDocumentationSection(
  metrics: PipelineRunMetrics,
  knowledge: ProjectKnowledge | undefined,
): string[] {
  const writeResult = metrics.documentationWrite;
  const selectiveRegeneration = knowledge?.analysis.documentImpact !== undefined;

  if (!writeResult) {
    return [
      '',
      'Documentation:',
      '- Planned: 0',
      '- Written: 0',
      '- Skipped: 0',
    ];
  }

  const plannedDocuments =
    writeResult.writtenCount + writeResult.skippedCount;

  if (selectiveRegeneration) {
    return [
      '',
      'Documentation:',
      `- Planned: ${plannedDocuments}`,
      `- Written: ${writeResult.writtenCount}`,
      `- Skipped unchanged: ${writeResult.skippedUnchangedCount}`,
      `- Skipped protected: ${writeResult.skippedProtectedCount}`,
    ];
  }

  return [
    '',
    'Documentation:',
    `- Planned: ${plannedDocuments}`,
    `- Written: ${writeResult.writtenCount}`,
    `- Skipped: ${writeResult.skippedCount}`,
  ];
}

function formatAiReadinessSection(knowledge: ProjectKnowledge | undefined): string[] {
  const readiness = knowledge?.analysis.aiReadiness;

  if (!readiness) {
    return [];
  }

  const criticalGaps = readiness.gaps.filter((gap) => gap.severity === 'critical').length;

  return [
    '',
    'AI Readiness:',
    `- Score: ${readiness.overallScore}/100`,
    `- Level: ${readiness.level}`,
    `- Critical gaps: ${criticalGaps}`,
    `- Recommendations: ${readiness.recommendations.length}`,
  ];
}

function formatChangeDetectionSection(knowledge: ProjectKnowledge | undefined): string[] {
  const summary = knowledge?.analysis.changeSummary;

  if (!summary) {
    return [];
  }

  return formatRunSummaryChangeDetectionLines(summary);
}

export function formatRunSummary(input: RunSummaryInput): string[] {
  const { config, result } = input;
  const metrics = resolveMetrics(result.metrics, result);
  const knowledge = result.projectKnowledge;
  const projectName =
    knowledge?.metadata.projectName ?? path.basename(config.targetProjectPath);
  const stepCounts = countStepsByStatus(result);

  const lines: string[] = [
    '',
    buildHeadline(result),
    '',
    `Project: ${projectName}`,
    `Target: ${config.targetProjectPath}`,
    `Docs: ${config.docsDir}`,
    `Duration: ${formatDuration(result.startedAt, result.finishedAt)}`,
    formatPipelineSummary(stepCounts),
  ];

  if (knowledge) {
    const technologies = collectTechnologies(knowledge.technologies);
    lines.push(`Technologies: ${technologies.length > 0 ? technologies.join(', ') : 'none detected'}`);
  }

  lines.push(
    '',
    'Knowledge:',
    `- Repository tree: ${metrics.repositoryTreeGenerated ? 'generated' : 'not generated'}`,
    `- Files scanned: ${metrics.filesScanned}`,
    `- Folders analyzed: ${metrics.foldersAnalyzed}`,
    `- Modules discovered: ${metrics.modulesDiscovered}`,
    `- Dependency edges: ${metrics.dependencyEdges}`,
    `- Conventions detected: ${metrics.conventionsDetected}`,
    `- Navigation entries: ${metrics.navigationEntries}`,
    `- Knowledge files persisted: ${metrics.knowledgeFilesPersisted}`,
  );

  lines.push(...formatAiAnalysisSection(config, metrics, knowledge));
  lines.push(...formatAgentExportsSection(config, metrics));
  lines.push(...formatChangeDetectionSection(knowledge));
  lines.push(...formatDocumentImpactSection(knowledge));
  lines.push(...formatDocumentationSection(metrics, knowledge));
  lines.push(...formatAiReadinessSection(knowledge));

  lines.push(
    '',
    'Validation:',
  );

  if (metrics.validation) {
    lines.push(
      `- Errors: ${metrics.validation.errorCount}`,
      `- Warnings: ${metrics.validation.warningCount}`,
      `- Status: ${metrics.validation.status}`,
    );
    appendValidationDetails(lines, metrics);
  } else {
    lines.push('- Status: not run');
  }

  if (result.errors.length > 0) {
    lines.push('', 'Errors:');
    for (const error of result.errors) {
      lines.push(`- ${error.stepName}: ${error.message}`);
    }
  }

  if (isPipelineSuccessful(result)) {
    const changeSummary = knowledge?.analysis.changeSummary;
    lines.push(
      '',
      'Next steps:',
      `- Review ${config.docsDir}/README.md`,
      `- Share ${config.docsDir}/agent-navigation.md with your AI coding agent`,
      `- Load ${config.docsDir}/knowledge/project-knowledge.json for machine-readable context`,
    );

    if (knowledge?.analysis.aiReadiness) {
      lines.push(`- Review ${config.docsDir}/ai-readiness.md for the Context Engineering readiness assessment`);
    }

    if (changeSummary && !changeSummary.isInitialRun) {
      lines.push(`- Inspect ${config.docsDir}/knowledge/change-summary.json for PKM diffs since the last run`);
      lines.push(`- Inspect ${config.docsDir}/knowledge/document-impact.json for selective regeneration decisions`);
    }
  }

  lines.push('');
  return lines;
}

export function printRunSummary(input: RunSummaryInput): void {
  for (const line of formatRunSummary(input)) {
    console.log(line);
  }
}

export function isPipelineSuccessful(result: PipelineExecutionResult): boolean {
  return result.success;
}
