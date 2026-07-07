import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIgnoredPaths } from './ignore-rules';
import { resolveScannerOptions } from './scanner-options';

describe('scanner-options', () => {
  it('normalizes negative limits to zero', () => {
    const resolved = resolveScannerOptions({ maxDepth: -3, maxFiles: -10 });

    assert.equal(resolved.maxDepth, 0);
    assert.equal(resolved.maxFiles, 0);
  });

  it('merges custom ignored paths with defaults', () => {
    const resolved = resolveScannerOptions({ ignoredPaths: ['tmp'] });

    assert.ok(resolved.ignoredPaths.includes('dist'));
    assert.ok(resolved.ignoredPaths.includes('tmp'));
    assert.deepEqual(mergeIgnoredPaths(['tmp']), resolved.ignoredPaths);
  });
});
