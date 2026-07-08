import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GENERATED_FILE_MARKER } from './document-template';
import {
  assertDocumentImpactConsistency,
  buildRegenerationPathSet,
  hasGeneratedFileMarker,
  isToolManagedExportContent,
} from './documentation-write-policy';

describe('documentation-write-policy', () => {
  it('detects generated markers when a UTF-8 BOM is present', () => {
    const content = `\uFEFF${GENERATED_FILE_MARKER}\n\n# Sample`;
    assert.equal(hasGeneratedFileMarker(content), true);
  });

  it('detects tool-managed export content at the file start', () => {
    const content = `${GENERATED_FILE_MARKER}\n\n# Pack\n`;
    assert.equal(isToolManagedExportContent(content), true);
  });

  it('detects tool-managed Cursor rules with YAML frontmatter and a marker line in the body', () => {
    const content = `---\nalwaysApply: true\n---\n\n${GENERATED_FILE_MARKER}\n\n# Rule\n`;
    assert.equal(isToolManagedExportContent(content), true);
  });

  it('does not treat prose mentioning the marker as tool-managed export content', () => {
    const content = `# Custom rule\n\nSee ${GENERATED_FILE_MARKER} for details.\n`;
    assert.equal(isToolManagedExportContent(content), false);
  });

  it('does not treat YAML frontmatter without a marker line as tool-managed export content', () => {
    const content = `---\nalwaysApply: true\n---\n\n# Custom rule\n`;
    assert.equal(isToolManagedExportContent(content), false);
  });

  it('builds a regeneration path set from impacted documents', () => {
    const paths = buildRegenerationPathSet({
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

    assert.deepEqual([...paths], ['architecture.md']);
  });

  it('throws when impacted and unchanged document lists overlap', () => {
    assert.throws(
      () =>
        assertDocumentImpactConsistency({
          impactedDocuments: [
            {
              documentPath: 'architecture.md',
              reason: 'Modules changed',
              impactedBy: ['modules'],
              shouldRegenerate: true,
            },
          ],
          unchangedDocuments: ['architecture.md'],
          generatedAt: '2026-01-02T00:00:00.000Z',
        }),
      /both impacted and unchanged/,
    );
  });
});
