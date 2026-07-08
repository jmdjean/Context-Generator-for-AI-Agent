import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { GENERATED_FILE_MARKER } from '../docs/document-template';
import { writeExportFile } from './export-file-writer';

describe('writeExportFile', () => {
  it('writes a new export file', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-file-writer-'));

    try {
      const result = writeExportFile(
        tempRoot,
        'agent-pack/AGENTS.generated.md',
        `${GENERATED_FILE_MARKER}\n\n# Pack\n`,
        true,
      );

      assert.equal(result.status, 'written');
      const outputPath = path.join(tempRoot, 'agent-pack', 'AGENTS.generated.md');
      assert.equal(fs.existsSync(outputPath), true);
      assert.match(fs.readFileSync(outputPath, 'utf-8'), /# Pack/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('skips user-managed files without the generated marker', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-file-writer-protected-'));

    try {
      const outputPath = path.join(tempRoot, 'agent-pack', 'AGENTS.generated.md');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, '# User-managed pack\n', 'utf-8');

      const result = writeExportFile(
        tempRoot,
        'agent-pack/AGENTS.generated.md',
        `${GENERATED_FILE_MARKER}\n\n# Pack\n`,
        true,
      );

      assert.equal(result.status, 'skipped');
      assert.match(result.reason ?? '', /generated marker/);
      assert.equal(fs.readFileSync(outputPath, 'utf-8'), '# User-managed pack\n');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('skips user-managed files that only mention the marker in prose', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-file-writer-prose-'));

    try {
      const outputPath = path.join(tempRoot, '.cursor', 'rules', 'custom.mdc');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(
        outputPath,
        `# Custom\n\nReference: ${GENERATED_FILE_MARKER}\n`,
        'utf-8',
      );

      const result = writeExportFile(
        tempRoot,
        '.cursor/rules/custom.mdc',
        `---\nalwaysApply: true\n---\n\n${GENERATED_FILE_MARKER}\n\n# New\n`,
        true,
      );

      assert.equal(result.status, 'skipped');
      assert.match(fs.readFileSync(outputPath, 'utf-8'), /Reference:/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('overwrites tool-managed files that carry the generated marker', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-file-writer-regen-'));

    try {
      const outputPath = path.join(tempRoot, 'agent-pack', 'AGENTS.generated.md');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${GENERATED_FILE_MARKER}\n\n# Old pack\n`, 'utf-8');

      const result = writeExportFile(
        tempRoot,
        'agent-pack/AGENTS.generated.md',
        `${GENERATED_FILE_MARKER}\n\n# New pack\n`,
        true,
      );

      assert.equal(result.status, 'written');
      assert.match(fs.readFileSync(outputPath, 'utf-8'), /# New pack/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('overwrites Cursor rules when the generated marker appears after YAML frontmatter', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-file-writer-cursor-'));

    try {
      const outputPath = path.join(tempRoot, '.cursor', 'rules', 'ai-project-docs.mdc');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(
        outputPath,
        `---\nalwaysApply: true\n---\n\n${GENERATED_FILE_MARKER}\n\n# Old rule\n`,
        'utf-8',
      );

      const result = writeExportFile(
        tempRoot,
        '.cursor/rules/ai-project-docs.mdc',
        `---\nalwaysApply: true\n---\n\n${GENERATED_FILE_MARKER}\n\n# New rule\n`,
        true,
      );

      assert.equal(result.status, 'written');
      assert.match(fs.readFileSync(outputPath, 'utf-8'), /# New rule/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
