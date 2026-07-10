import { DocumentImpactSummaryKnowledge } from '../knowledge';

export function formatDocumentImpactSummaryLine(summary: DocumentImpactSummaryKnowledge): string {
  if (summary.impactedDocuments.length === 0) {
    return 'no documents impacted';
  }

  return `${summary.impactedDocuments.length} impacted, ${summary.unchangedDocuments.length} unchanged`;
}

export function formatRunSummaryDocumentImpactLines(
  summary: DocumentImpactSummaryKnowledge,
): string[] {
  return [
    '',
    'Document impact:',
    `- Impacted documents: ${summary.impactedDocuments.length}`,
    `- Unchanged documents: ${summary.unchangedDocuments.length}`,
  ];
}
