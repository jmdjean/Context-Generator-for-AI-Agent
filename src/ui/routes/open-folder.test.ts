import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { handleOpenFolder } from './open-folder';

describe('handleOpenFolder', () => {
  it('returns 400 when path is missing', async () => {
    const result = await handleOpenFolder({});
    assert.equal(result.status, 400);
    const body = result.body as { code?: string };
    assert.equal(body.code, 'BAD_REQUEST');
  });

  it('rejects paths that are not docs output folders', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-open-'));
    try {
      const result = await handleOpenFolder(
        { path: tempDir },
        { openPath: async () => undefined },
      );
      assert.equal(result.status, 400);
      const body = result.body as { error?: string };
      assert.match(body.error ?? '', /does not look like an AI Project Docs output folder/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('opens a validated docs folder', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-open-'));
    const opened: string[] = [];
    try {
      fs.mkdirSync(path.join(tempDir, 'knowledge'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'knowledge', 'project-knowledge.json'),
        '{}',
        'utf8',
      );

      const result = await handleOpenFolder(
        { path: tempDir },
        {
          openPath: async (absolutePath) => {
            opened.push(absolutePath);
          },
        },
      );

      assert.equal(result.status, 200);
      assert.deepEqual(result.body, {
        opened: true,
        path: path.resolve(tempDir),
      });
      assert.deepEqual(opened, [path.resolve(tempDir)]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
