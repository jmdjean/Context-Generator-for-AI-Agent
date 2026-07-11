import { AgentExportResultKnowledge, AgentExportsKnowledge, ProjectKnowledge } from '../knowledge';
import { ExportOptions, ExportResult, ExportTarget } from './exporter-contract';
import {
  findUnsupportedExportTargets,
  resolveExportersForTarget,
} from './exporter-registry';

export interface AgentExportRunResult {
  knowledge: ProjectKnowledge;
  summary: AgentExportsKnowledge;
}

export interface AgentExportRunInput {
  knowledge: ProjectKnowledge;
  targetProjectPath: string;
  docsDir: string;
  enabledTargets: ReadonlyArray<ExportTarget>;
  overwriteGeneratedOnly?: boolean;
}

function mapExportResult(result: ExportResult): AgentExportResultKnowledge {
  return {
    target: result.target,
    filesWritten: result.filesWritten,
    filesSkipped: result.filesSkipped,
    warnings: result.warnings,
    generatedAt: result.generatedAt,
    files: result.files.map((file) => ({
      relativePath: file.relativePath,
      status: file.status,
      reason: file.reason,
    })),
  };
}

function buildExportOptions(input: AgentExportRunInput): ExportOptions {
  return {
    docsDir: input.docsDir,
    targetProjectPath: input.targetProjectPath,
    overwriteGeneratedOnly: input.overwriteGeneratedOnly ?? true,
    enabledTargets: [...input.enabledTargets],
  };
}

function warnUnsupportedTargets(targets: ReadonlyArray<ExportTarget>): string[] {
  const warnings: string[] = [];

  for (const target of findUnsupportedExportTargets(targets)) {
    const message = `no exporter registered for target: ${target}`;
    warnings.push(message);
    console.warn(`Warning: ${message}`);
  }

  return warnings;
}

export function runAgentExports(input: AgentExportRunInput): AgentExportRunResult {
  const options = buildExportOptions(input);
  const results: ExportResult[] = [];
  const generatedAt = new Date().toISOString();
  const runWarnings = warnUnsupportedTargets(options.enabledTargets);

  for (const target of options.enabledTargets) {
    const exporters = resolveExportersForTarget(target);

    for (const exporter of exporters) {
      results.push(exporter.export(input.knowledge, options));
    }
  }

  const summary: AgentExportsKnowledge = {
    enabled: true,
    enabledTargets: [...options.enabledTargets],
    results: results.map(mapExportResult),
    generatedAt,
    warnings: [
      ...runWarnings,
      ...results.flatMap((result) => result.warnings),
    ],
  };

  const knowledge: ProjectKnowledge = {
    ...input.knowledge,
    analysis: {
      ...input.knowledge.analysis,
      agentExports: summary,
    },
  };

  return { knowledge, summary };
}

export function summarizeAgentExportResults(
  summary: Pick<AgentExportsKnowledge, 'results' | 'warnings'>,
): {
  filesWritten: number;
  filesSkipped: number;
  warnings: string[];
} {
  let filesWritten = 0;
  let filesSkipped = 0;

  for (const result of summary.results) {
    filesWritten += result.filesWritten;
    filesSkipped += result.filesSkipped;
  }

  return {
    filesWritten,
    filesSkipped,
    warnings: summary.warnings,
  };
}
