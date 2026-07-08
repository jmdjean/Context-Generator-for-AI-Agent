import { ProjectKnowledge } from '../knowledge';
import { ExportOptions, ExportResult, ExportTarget } from './exporter-contract';
import { writeExportFile } from './export-file-writer';

export interface SingleFileExportInput {
  knowledge: ProjectKnowledge;
  options: ExportOptions;
  target: ExportTarget;
  writeRootPath: string;
  relativePath: string;
  render: (knowledge: ProjectKnowledge, exportedAt: string) => string;
  skippedWarningLabel: string;
}

export function runSingleFileExport(input: SingleFileExportInput): ExportResult {
  const generatedAt = new Date().toISOString();
  const content = input.render(input.knowledge, generatedAt);
  const warnings: string[] = [];

  const fileResult = writeExportFile(
    input.writeRootPath,
    input.relativePath,
    content,
    input.options.overwriteGeneratedOnly,
  );

  if (fileResult.status === 'skipped' && fileResult.reason) {
    warnings.push(`skipped ${input.relativePath}: ${fileResult.reason}`);
    console.warn(`Warning: skipped user-managed ${input.skippedWarningLabel} at ${input.relativePath}`);
  }

  return {
    target: input.target,
    filesWritten: fileResult.status === 'written' ? 1 : 0,
    filesSkipped: fileResult.status === 'skipped' ? 1 : 0,
    warnings,
    generatedAt,
    files: [fileResult],
  };
}
