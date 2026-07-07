import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRepositoryBoundary } from '../scanner/repository-boundary';
import {
  listImportSourceFiles,
  parseImportsFromFile,
  parseImportsFromText,
  prepareSourceForImportScan,
} from './import-parser';
import { RepositoryNode } from '../domain';

describe('import-parser', () => {
  it('extracts import, export-from, side-effect import, require, and dynamic import patterns', () => {
    const source = `
import { foo } from '../domain';
import type { Bar } from "./types";
import '../styles/global.css';
export { helper } from '../utils/helper';
const mod = require('../legacy/module');
const lazy = import('../features/dashboard');
`;

    const parsed = parseImportsFromText('src/core/index.ts', source);

    assert.deepEqual(
      parsed.map((entry) => entry.importPath),
      [
        '../domain',
        './types',
        '../styles/global.css',
        '../utils/helper',
        '../legacy/module',
        '../features/dashboard',
      ],
    );
    assert.ok(parsed.every((entry) => entry.sourceFile === 'src/core/index.ts'));
  });

  it('ignores import-like strings in comments and string literals', () => {
    const source = `
// import { fake } from '../fake';
const doc = "require('../fake/module')";
/* import '../fake/styles.css'; */
import { real } from '../knowledge';
`;

    const parsed = parseImportsFromText('src/core/index.ts', source);
    assert.deepEqual(parsed.map((entry) => entry.importPath), ['../knowledge']);
  });

  it('prepareSourceForImportScan removes comments and non-import string literals', () => {
    const sanitized = prepareSourceForImportScan(`
// import '../hidden'
const value = "require('../hidden')";
import { visible } from '../visible';
`);
    assert.match(sanitized, /import \{ visible \} from '\.\.\/visible'/);
    assert.doesNotMatch(sanitized, /hidden/);
  });

  it('preserves duplicate import specifiers from the same file', () => {
    const source = `
import { a } from '../knowledge';
import { b } from '../knowledge';
`;

    const parsed = parseImportsFromText('src/core/index.ts', source);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.importPath, '../knowledge');
    assert.equal(parsed[1]?.importPath, '../knowledge');
  });

  it('reads imports from files under module paths via repository boundary', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'import-parser-'));

    try {
      const sourceDir = path.join(tempRoot, 'src', 'core');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, 'handler.ts'),
        `import { buildProjectKnowledge } from '../knowledge';\n`,
        'utf-8',
      );

      const boundary = createRepositoryBoundary(tempRoot);
      const parsed = parseImportsFromFile('src/core/handler.ts', boundary);

      assert.equal(parsed.length, 1);
      assert.equal(parsed[0]?.importPath, '../knowledge');
      assert.equal(parsed[0]?.sourceFile, 'src/core/handler.ts');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('skips test files when listing import source files', () => {
    const tree: RepositoryNode = {
      name: 'sample',
      path: '/sample',
      relativePath: '',
      type: 'directory',
      children: [
        {
          name: 'handler.ts',
          path: '/sample/src/core/handler.ts',
          relativePath: 'src/core/handler.ts',
          type: 'file',
        },
        {
          name: 'handler.test.ts',
          path: '/sample/src/core/handler.test.ts',
          relativePath: 'src/core/handler.test.ts',
          type: 'file',
        },
      ],
    };

    const files = listImportSourceFiles(tree, {
      docsDir: '.ai-docs',
      modulePaths: ['src/core'],
      boundary: createRepositoryBoundary('/sample'),
    });

    assert.deepEqual(files, ['src/core/handler.ts']);
  });

  it('skips files under test folders when listing import source files', () => {
    const tree: RepositoryNode = {
      name: 'sample',
      path: '/sample',
      relativePath: '',
      type: 'directory',
      children: [
        {
          name: 'setup.ts',
          path: '/sample/src/__tests__/setup.ts',
          relativePath: 'src/__tests__/setup.ts',
          type: 'file',
        },
        {
          name: 'handler.ts',
          path: '/sample/src/core/handler.ts',
          relativePath: 'src/core/handler.ts',
          type: 'file',
        },
      ],
    };

    const files = listImportSourceFiles(tree, {
      docsDir: '.ai-docs',
      modulePaths: ['src/core', 'src/__tests__'],
      boundary: createRepositoryBoundary('/sample'),
    });

    assert.deepEqual(files, ['src/core/handler.ts']);
  });
});
