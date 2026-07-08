import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertSupportedExportTargets,
  expandExportTargets,
  parseExportTargetSelector,
  resolveEnabledExportTargets,
} from './export-target-resolver';
import { listSupportedExportTargets } from './exporter-registry';

describe('export-target-resolver', () => {
  it('parses known selectors case-insensitively', () => {
    assert.equal(parseExportTargetSelector('CURSOR'), 'cursor');
    assert.equal(parseExportTargetSelector(' all '), 'all');
    assert.equal(parseExportTargetSelector('claude'), 'claude');
    assert.equal(parseExportTargetSelector('unknown'), undefined);
  });

  it('expands all to registered supported targets', () => {
    assert.deepEqual(expandExportTargets('all'), listSupportedExportTargets());
    assert.deepEqual(expandExportTargets('cursor'), ['cursor']);
  });

  it('resolves enabled targets without duplicates', () => {
    assert.deepEqual(resolveEnabledExportTargets(['all', 'generic']), ['generic', 'cursor']);
  });

  it('throws for unsupported targets that have no exporter', () => {
    assert.throws(
      () => assertSupportedExportTargets(['claude']),
      /Unsupported export target\(s\): claude/,
    );
  });
});
