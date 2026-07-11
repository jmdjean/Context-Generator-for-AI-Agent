import { DocumentationStage, PlannedDocument } from '../domain/documentation-plan';

/**
 * Explicit write order for staged documentation. Architecture and module-plan
 * outputs precede per-module documents so later incremental logic can reason
 * about stage boundaries without path heuristics.
 */
export const DOCUMENTATION_STAGE_WRITE_ORDER: ReadonlyArray<DocumentationStage> = [
  'baseline',
  'routing',
  'architecture',
  'module-plan',
  'module',
  'readiness',
];

const STAGE_RANK = new Map<DocumentationStage, number>(
  DOCUMENTATION_STAGE_WRITE_ORDER.map((stage, index) => [stage, index]),
);

function resolveDocumentStage(document: PlannedDocument): DocumentationStage {
  return document.stage ?? 'baseline';
}

function stageRank(stage: DocumentationStage): number {
  return STAGE_RANK.get(stage) ?? DOCUMENTATION_STAGE_WRITE_ORDER.length;
}

/**
 * Sort planned documents by stage metadata, then by in-stage `order`, then path.
 * Prefer document metadata over path heuristics when deciding write order.
 */
export function orderDocumentsForWriting(
  documents: readonly PlannedDocument[],
): PlannedDocument[] {
  return [...documents].sort((left, right) => {
    const byStage = stageRank(resolveDocumentStage(left)) - stageRank(resolveDocumentStage(right));
    if (byStage !== 0) {
      return byStage;
    }

    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.relativePath.localeCompare(right.relativePath);
  });
}
