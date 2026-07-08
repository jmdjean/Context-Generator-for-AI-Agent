import { AgentExporter, ExportTarget } from './exporter-contract';
import { cursorExporter } from './cursor-exporter';
import { genericAgentExporter } from './generic-agent-exporter';

const EXPORTERS: ReadonlyArray<AgentExporter> = [genericAgentExporter, cursorExporter];

const KNOWN_EXPORT_TARGETS: ReadonlyArray<ExportTarget> = [
  'generic',
  'cursor',
  'claude',
  'codex',
  'copilot',
];

export function listSupportedExportTargets(): ExportTarget[] {
  return KNOWN_EXPORT_TARGETS.filter((target) => resolveExportersForTarget(target).length > 0);
}

export function listAgentExporters(): ReadonlyArray<AgentExporter> {
  return EXPORTERS;
}

export function getAgentExporterById(id: string): AgentExporter | undefined {
  return EXPORTERS.find((exporter) => exporter.id === id);
}

export function resolveExportersForTarget(target: ExportTarget): ReadonlyArray<AgentExporter> {
  return EXPORTERS.filter((exporter) => exporter.supports(target));
}

export function findUnsupportedExportTargets(
  targets: ReadonlyArray<ExportTarget>,
): ExportTarget[] {
  return targets.filter((target) => resolveExportersForTarget(target).length === 0);
}
