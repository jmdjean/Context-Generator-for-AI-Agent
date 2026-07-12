import { PlannedDocument } from '../../domain/documentation-plan';
import { CapabilityMapItem, ModuleKnowledge, ProjectKnowledge } from '../../knowledge';
import { sanitizeAiInsightText } from '../../utils/ai-text-sanitizer';
import {
  finishDocument,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

function renderCapabilityAreaList(
  heading: string,
  items: readonly CapabilityMapItem[],
): string[] {
  if (items.length === 0) {
    return [];
  }

  const lines: string[] = ['', `## ${heading}`, '', '| Area | Entry paths |', '|---|---|'];
  for (const item of items) {
    const paths =
      item.entryPaths.length > 0
        ? item.entryPaths.map((p) => inlineCode(p)).join(', ')
        : item.relatedModules.map((m) => inlineCode(m)).join(', ') || '—';
    lines.push(`| ${sanitizeAiInsightText(item.name)} | ${paths} |`);
  }
  return lines;
}

function renderModuleList(modules: readonly ModuleKnowledge[]): string[] {
  const productModules = modules.filter((m) => m.type !== 'documentation');
  if (productModules.length === 0) {
    return [
      '',
      '## Code modules',
      '',
      'No modules discovered yet. Re-run analysis to populate this index.',
    ];
  }

  const lines: string[] = ['', '## Code modules', '', '| Module | Type | Responsibility |', '|---|---|---|'];
  for (const module of productModules.slice(0, 20)) {
    lines.push(
      `| ${inlineCode(module.relativePath)} | ${module.type} | ${module.responsibility} |`,
    );
  }
  if (productModules.length > 20) {
    lines.push('', `…and ${productModules.length - 20} more. See \`PROJECT_MAP.md\`.`);
  }
  return lines;
}

export function renderCodeIndexDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const capabilityMap = knowledge.analysis.stagedDocumentation?.capabilityMap;
  const modules = knowledge.analysis.modules ?? [];

  const lines = [
    ...renderDocumentHeader(document, knowledge),
    '',
    'Entry-point index to all code documentation in this repository.',
  ];

  if (capabilityMap && capabilityMap.status === 'completed') {
    lines.push(...renderCapabilityAreaList('Features', capabilityMap.features));
    lines.push(...renderCapabilityAreaList('Integrations', capabilityMap.integrations));
    if (capabilityMap.domains.length > 0) {
      lines.push(...renderCapabilityAreaList('Domains', capabilityMap.domains));
    }
  }

  lines.push(...renderModuleList(modules));

  lines.push(
    '',
    '## Related docs',
    '',
    '- `PROJECT_MAP.md` — full module and folder map',
    '- `architecture.md` — system design and boundaries',
    '- `code/components/` — per-module documentation cards',
  );

  return finishDocument(lines);
}
