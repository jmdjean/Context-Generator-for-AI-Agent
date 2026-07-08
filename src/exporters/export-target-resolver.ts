import { AgentExportTarget } from '../knowledge';
import { findUnsupportedExportTargets, listSupportedExportTargets } from './exporter-registry';

export type ExportTargetSelector = AgentExportTarget | 'all';

const KNOWN_EXPORT_TARGET_SELECTORS: ReadonlyArray<string> = [
  'generic',
  'cursor',
  'claude',
  'codex',
  'copilot',
  'all',
];

export function parseExportTargetSelector(value: string): ExportTargetSelector | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'all') {
    return 'all';
  }

  if (KNOWN_EXPORT_TARGET_SELECTORS.includes(normalized)) {
    return normalized as AgentExportTarget;
  }

  return undefined;
}

export function expandExportTargets(selector: ExportTargetSelector): AgentExportTarget[] {
  if (selector === 'all') {
    return listSupportedExportTargets();
  }

  return [selector];
}

export function assertSupportedExportTargets(targets: ReadonlyArray<AgentExportTarget>): void {
  const unsupported = findUnsupportedExportTargets(targets);
  if (unsupported.length === 0) {
    return;
  }

  throw new Error(
    `Unsupported export target(s): ${unsupported.join(', ')}. Supported targets: generic, cursor, all.`,
  );
}

export function resolveEnabledExportTargets(
  selectors: ReadonlyArray<ExportTargetSelector>,
): AgentExportTarget[] {
  const expanded = selectors.flatMap((selector) => expandExportTargets(selector));
  const uniqueTargets = [...new Set(expanded)];
  assertSupportedExportTargets(uniqueTargets);
  return uniqueTargets;
}
