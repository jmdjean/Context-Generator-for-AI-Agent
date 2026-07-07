import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUnsafeEntryName,
  mergeIgnoredPaths,
  parseGitignoreContent,
  scopeGitignorePatternsToDirectory,
  shouldIgnoreEntry,
  createIgnoreRules,
} from './ignore-rules';

describe('ignore-rules', () => {
  it('rejects unsafe entry names', () => {
    assert.equal(isUnsafeEntryName('.'), true);
    assert.equal(isUnsafeEntryName('..'), true);
    assert.equal(isUnsafeEntryName('src/../etc'), true);
    assert.equal(isUnsafeEntryName('package.json'), false);
  });

  it('merges custom ignored paths with defaults', () => {
    const merged = mergeIgnoredPaths(['tmp']);
    assert.ok(merged.includes('dist'));
    assert.ok(merged.includes('tmp'));
  });

  it('parses gitignore comments, negation lines, and preserves anchoring', () => {
    const patterns = parseGitignoreContent(`
# comment
/dist
!important.log
build/
`);
    assert.deepEqual(patterns, ['/dist', 'build']);
  });

  it('treats anchored root patterns differently from unanchored patterns', () => {
    const rules = createIgnoreRules(['/dist']);

    assert.equal(shouldIgnoreEntry('dist', 'dist', rules, false), true);
    assert.equal(shouldIgnoreEntry('file.txt', 'dist/file.txt', rules, false), true);
    assert.equal(shouldIgnoreEntry('dist', 'packages/dist', rules, false), false);
  });

  it('scopes nested gitignore patterns to a directory', () => {
    const scoped = scopeGitignorePatternsToDirectory(['/out', 'dist'], 'packages/app');
    assert.deepEqual(scoped, ['/packages/app/out', 'packages/app/dist']);
  });

  it('always ignores node_modules and hidden files by default', () => {
    const rules = createIgnoreRules(['dist']);

    assert.equal(shouldIgnoreEntry('node_modules', 'node_modules', rules, false), true);
    assert.equal(shouldIgnoreEntry('.env', '.env', rules, false), true);
    assert.equal(shouldIgnoreEntry('src', 'src', rules, false), false);
  });

  it('matches wildcard and nested path patterns', () => {
    const rules = createIgnoreRules(['*.log', 'coverage']);

    assert.equal(shouldIgnoreEntry('debug.log', 'logs/debug.log', rules, false), true);
    assert.equal(shouldIgnoreEntry('app', 'packages/app/coverage', rules, false), true);
    assert.equal(shouldIgnoreEntry('app.ts', 'src/app.ts', rules, false), false);
  });
});
