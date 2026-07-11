import { PlannedDocument } from '../../domain/documentation-plan';
import { NavigationEntry, ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  humanizeIdentifier,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

function renderRouterEntry(entry: NavigationEntry): string[] {
  const lines = [
    '',
    `### ${humanizeIdentifier(entry.taskType)}`,
    '',
    entry.description,
    '',
  ];

  if (entry.recommendedDocuments.length === 0) {
    lines.push('1. `AI_START_HERE.md`');
    lines.push('2. `architecture.md`');
    lines.push('3. `DOCUMENTATION_MAINTENANCE.md`');
  } else {
    entry.recommendedDocuments.forEach((relativePath, index) => {
      lines.push(`${index + 1}. ${inlineCode(relativePath)}`);
    });
    lines.push(`${entry.recommendedDocuments.length + 1}. \`DOCUMENTATION_MAINTENANCE.md\``);
  }

  if (entry.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    lines.push('');
    for (const warning of entry.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines;
}

export function renderContextRouterDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [
    ...renderDocumentHeader(document, knowledge),
    '',
    'Match your task to a category below. Read the listed documents in order, then stop when you have enough context. Prefer 4–8 steps; do not read the entire docs folder.',
  ];

  const navigationMap = knowledge.analysis.navigationMap;
  if (!navigationMap || navigationMap.entries.length === 0) {
    lines.push('');
    lines.push('### Any task');
    lines.push('');
    lines.push('1. `AI_START_HERE.md`');
    lines.push('2. `architecture.md`');
    lines.push('3. `agent-navigation.md`');
    lines.push('4. `folder-structure.md`');
    lines.push('5. `DOCUMENTATION_MAINTENANCE.md`');
    lines.push('');
    lines.push(
      'The navigation map is not populated yet. Re-run analysis to replace this fallback with task-specific routes.',
    );
  } else {
    for (const entry of navigationMap.entries) {
      lines.push(...renderRouterEntry(entry));
    }
  }

  lines.push(
    '',
    '## Router rules',
    '',
    '- Order from general to specific.',
    '- Stop when enough context is loaded.',
    '- Prefer impact and architecture docs before risky shared changes.',
    '- Use `DOCUMENTATION_STATUS.md` to judge how much trust to place in a document.',
  );

  return finishDocument(lines);
}
