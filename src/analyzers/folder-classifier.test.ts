import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFolder, reconcileClassificationSignals } from './folder-classifier';

describe('folder-classifier', () => {
  it('classifies well-known folder names with high confidence', () => {
    const result = classifyFolder({
      name: 'src',
      relativePath: 'src',
      childFileNames: [],
      childFolderNames: ['core'],
    });

    assert.equal(result.classification, 'source');
    assert.equal(result.confidence, 'high');
    assert.ok(result.signals.includes('name-match:source'));
  });

  it('classifies test folders by name', () => {
    const result = classifyFolder({
      name: '__tests__',
      relativePath: 'src/__tests__',
      childFileNames: [],
      childFolderNames: [],
    });

    assert.equal(result.classification, 'test');
    assert.equal(result.confidence, 'high');
  });

  it('treats co-located tests as source when non-test source files exist', () => {
    const result = classifyFolder({
      name: 'components',
      relativePath: 'src/components',
      childFileNames: ['button.test.ts', 'card.tsx'],
      childFolderNames: [],
    });

    assert.equal(result.classification, 'source');
    assert.equal(result.confidence, 'medium');
    assert.ok(result.signals.includes('path-context:source-files'));
  });

  it('classifies dedicated test folders without source files as test', () => {
    const result = classifyFolder({
      name: 'fixtures',
      relativePath: 'fixtures',
      childFileNames: ['app.test.ts', 'auth.spec.ts'],
      childFolderNames: [],
    });

    assert.equal(result.classification, 'test');
    assert.equal(result.confidence, 'medium');
  });

  it('classifies known modules under src as source even when the name matches docs', () => {
    const result = classifyFolder({
      name: 'docs',
      relativePath: 'src/docs',
      childFileNames: ['README.md'],
      childFolderNames: [],
    });

    assert.equal(result.classification, 'source');
    assert.equal(result.confidence, 'high');
    assert.ok(result.signals.includes('path-context:source-module'));
    assert.ok(result.signals.includes('refined-from:documentation'));
    assert.equal(result.signals.includes('name-match:documentation'), false);
  });

  it('classifies known modules under packages as source', () => {
    const result = classifyFolder({
      name: 'scanner',
      relativePath: 'packages/scanner',
      childFileNames: ['repository-scanner.ts'],
      childFolderNames: [],
    });

    assert.equal(result.classification, 'source');
    assert.equal(result.confidence, 'high');
    assert.ok(result.signals.includes('path-context:source-module'));
  });

  it('reconciles conflicting name-match signals after refinement', () => {
    const reconciled = reconcileClassificationSignals(
      ['folder-name:config', 'name-match:config', 'path-context:source-module'],
      'config',
      'source',
    );

    assert.equal(reconciled.includes('name-match:config'), false);
    assert.ok(reconciled.includes('refined-from:config'));
  });

  it('classifies dependency caches', () => {
    const result = classifyFolder({
      name: 'node_modules',
      relativePath: 'node_modules',
      childFileNames: [],
      childFolderNames: ['typescript'],
    });

    assert.equal(result.classification, 'dependency-cache');
    assert.equal(result.confidence, 'high');
  });
});
