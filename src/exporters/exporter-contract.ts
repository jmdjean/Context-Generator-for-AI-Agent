import { AgentExportTarget, ProjectKnowledge } from '../knowledge';

export type ExportTarget = AgentExportTarget;

export interface ExportOptions {
  docsDir: string;
  targetProjectPath: string;
  overwriteGeneratedOnly: boolean;
  enabledTargets: ExportTarget[];
}

export interface ExportedFile {
  relativePath: string;
  status: 'written' | 'skipped';
  reason?: string;
}

export interface ExportResult {
  target: ExportTarget;
  filesWritten: number;
  filesSkipped: number;
  warnings: string[];
  generatedAt: string;
  files: ExportedFile[];
}

export interface AgentExporter {
  id: string;
  name: string;
  description: string;
  supports(target: ExportTarget): boolean;
  export(knowledge: ProjectKnowledge, options: ExportOptions): ExportResult;
}
