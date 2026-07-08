import { getProjectRoot, ProjectKnowledge } from '../knowledge';
import { CURSOR_EXPORT_TARGET, CURSOR_RULES_RELATIVE_PATH } from './exporter-constants';
import {
  AgentExporter,
  ExportOptions,
  ExportResult,
  ExportTarget,
} from './exporter-contract';
import { renderCursorRules } from './cursor-rules-renderer';
import { runSingleFileExport } from './single-file-exporter';

function exportCursorRules(
  knowledge: ProjectKnowledge,
  options: ExportOptions,
): ExportResult {
  return runSingleFileExport({
    knowledge,
    options,
    target: CURSOR_EXPORT_TARGET,
    writeRootPath: getProjectRoot(knowledge),
    relativePath: CURSOR_RULES_RELATIVE_PATH,
    render: renderCursorRules,
    skippedWarningLabel: 'Cursor rule',
  });
}

export const cursorExporter: AgentExporter = {
  id: 'cursor',
  name: 'Cursor Rules',
  description:
    'Produces a Cursor rule under .cursor/rules/ derived from the PKM for always-on project context.',
  supports(target: ExportTarget): boolean {
    return target === CURSOR_EXPORT_TARGET;
  },
  export(knowledge: ProjectKnowledge, options: ExportOptions): ExportResult {
    return exportCursorRules(knowledge, options);
  },
};
