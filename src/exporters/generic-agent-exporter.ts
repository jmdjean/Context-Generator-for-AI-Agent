import { getDocsDir, getProjectRoot, ProjectKnowledge } from '../knowledge';
import { resolvePathWithinRoot } from '../utils/fs';
import { GENERIC_AGENT_EXPORT_TARGET, GENERIC_AGENT_PACK_RELATIVE_PATH } from './exporter-constants';
import {
  AgentExporter,
  ExportOptions,
  ExportResult,
  ExportTarget,
} from './exporter-contract';
import { renderGenericAgentPack } from './generic-agent-pack-renderer';
import { runSingleFileExport } from './single-file-exporter';

function exportGenericAgentPack(
  knowledge: ProjectKnowledge,
  options: ExportOptions,
): ExportResult {
  return runSingleFileExport({
    knowledge,
    options,
    target: GENERIC_AGENT_EXPORT_TARGET,
    writeRootPath: resolvePathWithinRoot(getProjectRoot(knowledge), getDocsDir(knowledge)),
    relativePath: GENERIC_AGENT_PACK_RELATIVE_PATH,
    render: renderGenericAgentPack,
    skippedWarningLabel: 'agent export',
  });
}

export const genericAgentExporter: AgentExporter = {
  id: 'generic-agent',
  name: 'Generic Agent Pack',
  description:
    'Produces a portable agent context pack under agent-pack/ for agents without a dedicated exporter.',
  supports(target: ExportTarget): boolean {
    return target === GENERIC_AGENT_EXPORT_TARGET;
  },
  export(knowledge: ProjectKnowledge, options: ExportOptions): ExportResult {
    return exportGenericAgentPack(knowledge, options);
  },
};
