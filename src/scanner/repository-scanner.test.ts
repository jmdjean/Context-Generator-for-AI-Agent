import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanRepository } from './repository-scanner';
import { RepositoryInfo, RepositoryNode } from '../domain';

function createRepositoryInfo(rootPath: string): RepositoryInfo {
  return {
    name: path.basename(rootPath),
    rootPath,
    detectedFiles: fs.readdirSync(rootPath),
    ignoredPaths: [],
  };
}

describe('repository-scanner', () => {
  it('skips unvisited directories after maxFiles is reached', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-limit-'));

    try {
      fs.mkdirSync(path.join(tempRoot, 'dir1'));
      fs.mkdirSync(path.join(tempRoot, 'dir2'));
      fs.writeFileSync(path.join(tempRoot, 'dir1', 'a.txt'), 'a');
      fs.writeFileSync(path.join(tempRoot, 'dir1', 'b.txt'), 'b');
      fs.writeFileSync(path.join(tempRoot, 'dir2', 'c.txt'), 'c');

      const result = scanRepository(createRepositoryInfo(tempRoot), { maxFiles: 2 });
      const childNames = (result.tree.children ?? []).map((child: { name: string }) => child.name);

      assert.equal(result.stats.limitReached, true);
      assert.deepEqual(childNames, ['dir1']);
      assert.equal(result.tree.truncated, true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('marks directories truncated when maxDepth is reached with omitted entries', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-depth-'));

    try {
      const nestedDirectory = path.join(tempRoot, 'level1', 'level2');
      fs.mkdirSync(nestedDirectory, { recursive: true });
      fs.writeFileSync(path.join(nestedDirectory, 'deep.txt'), 'deep');

      const result = scanRepository(createRepositoryInfo(tempRoot), { maxDepth: 1 });
      const level1 = (result.tree.children ?? []).find((child: RepositoryNode) => child.name === 'level1');

      assert.ok(level1);
      assert.equal(level1.truncated, true);
      assert.equal(result.stats.maxDepthReached, true);
      assert.equal(level1.children, undefined);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does not mark maxDepth truncated when only omitted entries are gitignored locally', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-depth-ignore-'));

    try {
      const level1Directory = path.join(tempRoot, 'level1');
      fs.mkdirSync(level1Directory);
      fs.writeFileSync(path.join(level1Directory, '.gitignore'), 'ignored-only/\n');
      fs.mkdirSync(path.join(level1Directory, 'ignored-only'));
      fs.writeFileSync(path.join(level1Directory, 'ignored-only', 'deep.txt'), 'deep');

      const result = scanRepository(createRepositoryInfo(tempRoot), { maxDepth: 1 });
      const level1 = (result.tree.children ?? []).find((child: RepositoryNode) => child.name === 'level1');

      assert.ok(level1);
      assert.equal(level1.truncated, undefined);
      assert.equal(result.stats.maxDepthReached, false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('ignores the configured output docs directory', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-docs-'));

    try {
      const docsDirectory = path.join(tempRoot, 'generated-docs');
      fs.mkdirSync(docsDirectory);
      fs.writeFileSync(path.join(docsDirectory, 'output.md'), 'docs');
      fs.writeFileSync(path.join(tempRoot, 'README.md'), 'readme');

      const result = scanRepository(createRepositoryInfo(tempRoot), {
        outputDocsDir: 'generated-docs',
      });
      const childNames = (result.tree.children ?? []).map((child: { name: string }) => child.name);

      assert.deepEqual(childNames, ['README.md']);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
