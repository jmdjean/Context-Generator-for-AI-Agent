import * as path from 'node:path';
import { ExportTarget } from './exporter-contract';

export const GENERIC_AGENT_EXPORT_TARGET: ExportTarget = 'generic';
export const CURSOR_EXPORT_TARGET: ExportTarget = 'cursor';

export const GENERIC_AGENT_PACK_RELATIVE_PATH = path.posix.join(
  'agent-pack',
  'AGENTS.generated.md',
);

export const CURSOR_RULES_RELATIVE_PATH = path.posix.join(
  '.cursor',
  'rules',
  'ai-project-docs.mdc',
);

export const DEFAULT_ENABLED_EXPORT_TARGETS: ReadonlyArray<ExportTarget> = ['generic'];
