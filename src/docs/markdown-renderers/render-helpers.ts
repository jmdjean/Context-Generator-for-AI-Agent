import { PlannedDocument } from '../../domain/documentation-plan';
import { ProjectKnowledge } from '../../knowledge';
import { GENERATED_FILE_MARKER } from '../document-template';

export type MarkdownRenderer = (
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
) => string;

export function renderDocumentHeader(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string[] {
  return [
    GENERATED_FILE_MARKER,
    '',
    `# ${document.title}`,
    '',
    document.purpose,
    '',
    `- Project: ${knowledge.metadata.projectName}`,
    `- Generated: ${knowledge.metadata.generatedAt}`,
    `- PKM schema: ${knowledge.metadata.schemaVersion}`,
    `- Analysis status: ${knowledge.analysis.status}`,
  ];
}

export function finishDocument(lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

export function inlineCode(value: string): string {
  return `\`${value}\``;
}

export function formatInlineList(items: readonly string[], fallback = 'None detected'): string {
  return items.length > 0 ? items.join(', ') : fallback;
}

export function formatInlineCodeList(items: readonly string[], fallback = 'None'): string {
  return items.length > 0 ? items.map(inlineCode).join(', ') : fallback;
}

export function tableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

export function humanizeIdentifier(value: string): string {
  const spaced = value.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function displayRelativePath(relativePath: string): string {
  return relativePath === '' ? '.' : relativePath;
}
