import { PlannedDocument } from '../../domain/documentation-plan';
import { NavigationEntry, ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  formatInlineCodeList,
  humanizeIdentifier,
  renderDocumentHeader,
} from './render-helpers';

function renderNavigationEntry(entry: NavigationEntry): string[] {
  const lines = [
    '',
    `## ${humanizeIdentifier(entry.taskType)}`,
    '',
    entry.description,
    '',
    `- Recommended PKM knowledge: ${formatInlineCodeList(entry.recommendedKnowledge, 'None')}`,
    `- Recommended documents: ${formatInlineCodeList(entry.recommendedDocuments, 'None')}`,
    `- Related modules: ${formatInlineCodeList(entry.relatedModules, 'None resolved')}`,
    `- Related folders: ${formatInlineCodeList(entry.relatedFolders, 'None resolved')}`,
    `- Confidence: ${entry.confidence}`,
  ];

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

export function renderAgentNavigationDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [...renderDocumentHeader(document, knowledge)];
  const navigationMap = knowledge.analysis.navigationMap;

  if (!navigationMap || navigationMap.entries.length === 0) {
    lines.push('');
    lines.push('The AI navigation map has not been built for this snapshot. Run the full pipeline to populate it.');
    return finishDocument(lines);
  }

  lines.push('');
  lines.push('Find the task type that matches your current task, then load only the knowledge and documents it recommends. Related modules and folders are resolved against actual PKM data — empty lists mean nothing matched, not that the map is broken.');
  for (const entry of navigationMap.entries) {
    lines.push(...renderNavigationEntry(entry));
  }

  return finishDocument(lines);
}
