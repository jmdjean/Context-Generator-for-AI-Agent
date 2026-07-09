import * as path from 'node:path';
import { RuntimeConfig } from '../config';
import { PipelineExecutionResult } from './pipeline-orchestrator';

function formatTechnologies(result: PipelineExecutionResult): string {
  const technologies = result.projectKnowledge?.technologies;
  if (!technologies) {
    return 'not detected';
  }

  const detected = [
    ...new Set([
      ...technologies.languages,
      ...technologies.frameworks,
      ...technologies.packageManagers,
      ...technologies.tooling,
    ]),
  ];

  return detected.length > 0 ? detected.join(', ') : 'none detected';
}

function buildKnowledgeLines(result: PipelineExecutionResult): string[] {
  const analysis = result.projectKnowledge?.analysis;
  const treeGenerated = result.projectKnowledge?.repository.repositoryTree !== undefined;

  return [
    `- Repository tree: ${treeGenerated ? 'generated' : 'missing'}`,
    `- Files scanned: ${result.scanStats?.filesScanned ?? 0}`,
    `- Folders analyzed: ${analysis?.folderContexts?.length ?? 0}`,
    `- Modules discovered: ${analysis?.modules?.length ?? 0}`,
    `- Dependency edges: ${analysis?.dependencyGraph?.edges.length ?? 0}`,
    `- Conventions detected: ${analysis?.conventions?.length ?? 0}`,
    `- Navigation entries: ${analysis?.navigationMap?.entries.length ?? 0}`,
  ];
}

function buildValidationLines(result: PipelineExecutionResult): string[] {
  const validation = result.validationResult;
  if (!validation) {
    return ['- Status: not run'];
  }

  const lines = [
    `- Errors: ${validation.errors.length}`,
    `- Warnings: ${validation.warnings.length}`,
    `- Status: ${validation.status}`,
  ];

  for (const issue of validation.errors) {
    lines.push(`  - Error: ${issue.documentPath} — ${issue.message}`);
  }
  for (const issue of validation.warnings) {
    lines.push(`  - Warning: ${issue.documentPath} — ${issue.message}`);
  }

  return lines;
}

export function formatRunSummary(
  config: RuntimeConfig,
  result: PipelineExecutionResult,
): string {
  const projectName =
    result.projectKnowledge?.metadata.projectName ?? path.basename(config.targetProjectPath);
  const header = result.success
    ? 'AI Project Docs completed'
    : 'AI Project Docs completed with errors';

  const lines: string[] = [
    header,
    '',
    `Project: ${projectName}`,
    `Target: ${config.targetProjectPath}`,
    `Docs: ${config.docsDir}`,
    `Technologies: ${formatTechnologies(result)}`,
    '',
    'Knowledge:',
    ...buildKnowledgeLines(result),
    '',
    'Documentation:',
    `- Written: ${result.documentationWriteResult?.writtenCount ?? 0}`,
    `- Skipped: ${result.documentationWriteResult?.skippedCount ?? 0}`,
    '',
    'Validation:',
    ...buildValidationLines(result),
  ];

  if (result.errors.length > 0) {
    lines.push('', 'Errors:');
    for (const error of result.errors) {
      lines.push(`- ${error.stepName}: ${error.message}`);
    }
  }

  if (result.success) {
    lines.push(
      '',
      'Next steps:',
      `- Review ${config.docsDir}/README.md`,
      `- Share ${config.docsDir}/agent-navigation.md with your AI coding agent`,
    );
  }

  return lines.join('\n');
}
