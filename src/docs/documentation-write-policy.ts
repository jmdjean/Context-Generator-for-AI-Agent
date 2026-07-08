import { DocumentImpactSummaryKnowledge } from '../knowledge';
import { GENERATED_FILE_MARKER } from './document-template';

export function normalizeGeneratedFileContent(content: string): string {
  return content.replace(/^\uFEFF/, '');
}

export function hasGeneratedFileMarker(content: string): boolean {
  return normalizeGeneratedFileContent(content).startsWith(GENERATED_FILE_MARKER);
}

function hasGeneratedFileMarkerOnOwnLine(content: string): boolean {
  return content.split('\n').some((line) => line.trim() === GENERATED_FILE_MARKER);
}

export function isToolManagedExportContent(content: string): boolean {
  const normalized = normalizeGeneratedFileContent(content);

  if (normalized.startsWith(GENERATED_FILE_MARKER)) {
    return true;
  }

  const frontmatterMatch = normalized.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!frontmatterMatch) {
    return false;
  }

  const body = normalized.slice(frontmatterMatch[0].length);
  return hasGeneratedFileMarkerOnOwnLine(body);
}

export function buildRegenerationPathSet(
  impactSummary: DocumentImpactSummaryKnowledge,
): ReadonlySet<string> {
  return new Set(
    impactSummary.impactedDocuments
      .filter((impact) => impact.shouldRegenerate)
      .map((impact) => impact.documentPath),
  );
}

export function assertDocumentImpactConsistency(
  impactSummary: DocumentImpactSummaryKnowledge,
): void {
  const regenerationPaths = buildRegenerationPathSet(impactSummary);
  const unchangedPaths = new Set(impactSummary.unchangedDocuments);

  for (const documentPath of regenerationPaths) {
    if (unchangedPaths.has(documentPath)) {
      throw new Error(
        `document impact summary lists ${documentPath} as both impacted and unchanged`,
      );
    }
  }
}
