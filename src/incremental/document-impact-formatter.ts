import { DocumentImpactSummaryKnowledge } from '../knowledge';

export function formatDocumentImpactLines(summary: DocumentImpactSummaryKnowledge): string[] {
  const lines = [
    '',
    'Document impact:',
    `Impacted documents: ${summary.impactedDocuments.length}`,
    `Unchanged documents: ${summary.unchangedDocuments.length}`,
  ];

  if (summary.impactedDocuments.length > 0 && summary.impactedDocuments.length <= 8) {
    for (const impact of summary.impactedDocuments) {
      lines.push(`* ${impact.documentPath}`);
    }
  }

  return lines;
}

export function printDocumentImpactSummary(summary: DocumentImpactSummaryKnowledge): void {
  for (const line of formatDocumentImpactLines(summary)) {
    console.log(line);
  }
}

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
    `* Impacted documents: ${summary.impactedDocuments.length}`,
    `* Unchanged documents: ${summary.unchangedDocuments.length}`,
  ];
}
