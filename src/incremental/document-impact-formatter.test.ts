import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatDocumentImpactSummaryLine,
  formatRunSummaryDocumentImpactLines,
} from './document-impact-formatter';

describe('document-impact-formatter', () => {
  it('formats run summary lines with counts', () => {
    const lines = formatRunSummaryDocumentImpactLines({
      impactedDocuments: [
        {
          documentPath: 'architecture.md',
          reason: 'Modules changed',
          impactedBy: ['modules'],
          shouldRegenerate: true,
        },
      ],
      unchangedDocuments: ['README.md'],
      generatedAt: '2026-01-02T00:00:00.000Z',
    });

    assert.deepEqual(lines, [
      '',
      'Document impact:',
      '- Impacted documents: 1',
      '- Unchanged documents: 1',
    ]);
  });

  it('describes empty impact summaries', () => {
    assert.equal(
      formatDocumentImpactSummaryLine({
        impactedDocuments: [],
        unchangedDocuments: ['README.md'],
        generatedAt: '2026-01-02T00:00:00.000Z',
      }),
      'no documents impacted',
    );
  });
});
