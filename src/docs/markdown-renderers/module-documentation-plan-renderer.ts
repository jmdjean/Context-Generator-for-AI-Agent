import { PlannedDocument } from '../../domain/documentation-plan';
import {
  ModuleDocumentationPlanEntry,
  ProjectKnowledge,
} from '../../knowledge';
import {
  finishDocument,
  inlineCode,
  renderDocumentHeader,
  tableCell,
} from './render-helpers';

function renderPlanEntries(entries: readonly ModuleDocumentationPlanEntry[]): string[] {
  const lines = [
    '',
    '## Module documentation sequence',
    '',
    '| Order | Module | Document | Status | Rationale |',
    '|---|---|---|---|---|',
  ];

  if (entries.length === 0) {
    lines.push('| — | *(none)* | — | pending | No modules discovered |');
    return lines;
  }

  for (const entry of entries) {
    lines.push(
      `| ${entry.order} | ${inlineCode(entry.moduleRelativePath)} | ${inlineCode(entry.documentPath)} | ${entry.status} | ${tableCell(entry.rationale ?? '—')} |`,
    );
  }
  return lines;
}

export function renderModuleDocumentationPlanDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const modulePlan = knowledge.analysis.stagedDocumentation?.modulePlan;
  const entries = modulePlan?.entries ?? [];

  const lines = [
    ...renderDocumentHeader(document, knowledge),
    '',
    'This plan is mirrored from `analysis.stagedDocumentation.modulePlan`. Downstream module documents should follow this order; the documentation writer emits architecture and module-plan outputs before per-module cards.',
    '',
    `## Plan status`,
    '',
    `- Overall status: ${modulePlan?.status ?? 'pending'}`,
    `- Entries: ${entries.length}`,
    `- Generated: ${modulePlan?.generatedAt ?? 'not yet'}`,
    ...renderPlanEntries(entries),
  ];

  if (modulePlan?.warnings && modulePlan.warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of modulePlan.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    '',
    '## How agents should use this plan',
    '',
    '1. Confirm architecture context in `architecture.md`.',
    '2. Work through module documents in the order above.',
    '3. Treat each module card as enrichment until its result status is `completed`.',
    '4. Update `DOCUMENTATION_STATUS.md` trust labels when coverage changes.',
  );

  return finishDocument(lines);
}
