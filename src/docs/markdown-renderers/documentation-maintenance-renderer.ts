import { PlannedDocument } from '../../domain/documentation-plan';
import { ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  humanizeIdentifier,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

function renderChangeTypeTable(knowledge: ProjectKnowledge): string[] {
  const lines = [
    '',
    '## Change type → docs to update',
    '',
    '| Change type | Update these documents |',
    '|---|---|',
  ];

  const navigationMap = knowledge.analysis.navigationMap;
  if (!navigationMap || navigationMap.entries.length === 0) {
    lines.push('| Architecture / module boundary | `architecture.md`, `PROJECT_MAP.md`, `dependency-map.md` |');
    lines.push('| New feature or pipeline step | `implementation-guide.md`, related module docs under `code/components/` |');
    lines.push('| Bug fix in existing behavior | Module card for the touched path; `DOCUMENTATION_STATUS.md` if coverage changes |');
    lines.push('| Documentation-only | `DOCUMENTATION_STATUS.md`, `CONTEXT_ROUTER.md` if routes change |');
    return lines;
  }

  for (const entry of navigationMap.entries) {
    const docs =
      entry.recommendedDocuments.length > 0
        ? entry.recommendedDocuments.map((path) => inlineCode(path)).join(', ')
        : '`architecture.md`';
    lines.push(`| ${humanizeIdentifier(entry.taskType)} | ${docs} |`);
  }

  return lines;
}

export function renderDocumentationMaintenanceDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [
    ...renderDocumentHeader(document, knowledge),
    '',
    'Keep agent documentation aligned with code in the **same session** as the behavior change. Prefer accurate partial updates over polished but stale prose.',
    ...renderChangeTypeTable(knowledge),
    '',
    '## When to add a router category',
    '',
    '- The same task shape recurs and is not covered in `CONTEXT_ROUTER.md`.',
    '- A high-risk shared surface gains a new impact or module document.',
    '- Do not add categories for one-off investigations.',
    '',
    '## What not to touch',
    '',
    '- Unrelated module cards and playbook docs outside the change blast radius.',
    '- User-managed files without the generated-file marker.',
    '- Invented frameworks, modules, or dependencies not present in the PKM.',
    '',
    '## Completion checks',
    '',
    '1. Affected playbook or module documents reflect the new behavior.',
    '2. `CONTEXT_ROUTER.md` still points at the right reading order.',
    '3. `DOCUMENTATION_STATUS.md` honesty markers match actual coverage.',
    '4. Cross-check code when a claim is not backed by PKM evidence.',
  ];

  return finishDocument(lines);
}
