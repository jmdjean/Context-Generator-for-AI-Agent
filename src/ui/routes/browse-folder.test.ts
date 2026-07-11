import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { handleBrowseFolder } from './browse-folder';

describe('handleBrowseFolder', () => {
  it('returns 501 on non-Windows platforms', async () => {
    const result = await handleBrowseFolder({ platform: 'linux' });
    assert.equal(result.status, 501);
    const body = result.body as { code?: string; error?: string };
    assert.equal(body.code, 'NOT_IMPLEMENTED');
    assert.match(body.error ?? '', /Windows/i);
  });

  it('returns cancelled when the dialog is dismissed', async () => {
    const result = await handleBrowseFolder({
      platform: 'win32',
      openDialog: async () => null,
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { cancelled: true });
  });

  it('returns a validated absolute path when a folder is selected', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-browse-'));
    try {
      const result = await handleBrowseFolder({
        platform: 'win32',
        openDialog: async () => tempDir,
      });
      assert.equal(result.status, 200);
      const body = result.body as { path?: string };
      assert.equal(body.path, path.resolve(tempDir));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns 400 when the selected path is not a readable directory', async () => {
    const result = await handleBrowseFolder({
      platform: 'win32',
      openDialog: async () => path.join(os.tmpdir(), 'missing-folder-xyz-ai-docs'),
    });
    assert.equal(result.status, 400);
    const body = result.body as { code?: string };
    assert.equal(body.code, 'BAD_REQUEST');
  });
});
