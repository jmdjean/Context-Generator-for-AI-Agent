import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { createRepositoryBoundary } from './repository-boundary';

describe('repository-boundary', () => {
  it('resolves safe relative paths inside the repository root', () => {
    const boundary = createRepositoryBoundary('/tmp/project');
    const resolved = boundary.resolveRelative('src/index.ts');

    assert.ok(resolved.endsWith(path.join('src', 'index.ts')));
  });

  it('rejects paths that escape the repository root', () => {
    const boundary = createRepositoryBoundary('/tmp/project');

    assert.throws(() => boundary.resolveRelative('..'), /escapes repository root/);
    assert.throws(() => boundary.toRelative('/tmp/outside'), /escapes repository root/);
  });
});
