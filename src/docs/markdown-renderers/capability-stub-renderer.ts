import { PlannedDocument } from '../../domain/documentation-plan';
import { CapabilityMapItem, ProjectKnowledge } from '../../knowledge';
import { sanitizeAiInsightText } from '../../utils/ai-text-sanitizer';
import {
  finishDocument,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

function extractCategoryAndSlug(relativePath: string): { category: string; slug: string } {
  const parts = relativePath.split('/');
  return { category: parts[0] ?? '', slug: parts[1] ?? '' };
}

function findCapabilityItem(
  knowledge: ProjectKnowledge,
  category: string,
  slug: string,
): CapabilityMapItem | undefined {
  const capabilityMap = knowledge.analysis.stagedDocumentation?.capabilityMap;
  if (!capabilityMap || capabilityMap.status !== 'completed') {
    return undefined;
  }

  const items = category === 'features'
    ? capabilityMap.features
    : category === 'integrations'
      ? capabilityMap.integrations
      : capabilityMap.domains;

  return items.find((item) => sanitizeCapabilitySlugLocal(item.name) === slug);
}

function sanitizeCapabilitySlugLocal(name: string): string {
  const result = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return result.length > 0 ? result : 'capability';
}

export function renderCapabilityStubDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const { category, slug } = extractCategoryAndSlug(document.relativePath);
  const item = findCapabilityItem(knowledge, category, slug);

  const lines = [...renderDocumentHeader(document, knowledge)];

  if (!item) {
    lines.push(
      '',
      `> **Partial.** No capability map entry found for ${inlineCode(slug)} in ${inlineCode(category)}.`,
      '',
      'This stub was created from module discovery. Re-run with `--ai` to populate capability details.',
    );
    return finishDocument(lines);
  }

  lines.push('', sanitizeAiInsightText(item.summary));

  if (item.entryPaths.length > 0) {
    lines.push('', '## Entry paths', '');
    for (const entryPath of item.entryPaths) {
      lines.push(`- ${inlineCode(sanitizeAiInsightText(entryPath))}`);
    }
  }

  if (item.relatedModules.length > 0) {
    lines.push('', '## Related modules', '');
    for (const module of item.relatedModules) {
      lines.push(`- ${inlineCode(sanitizeAiInsightText(module))}`);
    }
  }

  lines.push(
    '',
    '## Related docs',
    '',
    '- `code/index.md` — full code index',
    '- `architecture.md` — system design and boundaries',
  );

  return finishDocument(lines);
}
