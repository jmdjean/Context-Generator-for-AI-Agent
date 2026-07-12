import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWLEDGE_FILE_NAMES,
  listKnowledgeRelativeFilePaths,
  listPersistedKnowledgeRelativeFilePaths,
} from './knowledge-paths';

describe('knowledge-paths', () => {
  it('lists repository-tree.json only when requested', () => {
    const withTree = listPersistedKnowledgeRelativeFilePaths('.ai-docs', true);
    const withoutTree = listPersistedKnowledgeRelativeFilePaths('.ai-docs', false);

    assert.ok(withTree.includes('.ai-docs/knowledge/repository-tree.json'));
    assert.ok(!withoutTree.includes('.ai-docs/knowledge/repository-tree.json'));
  });

  it('lists folders.json only when requested', () => {
    const withFolders = listPersistedKnowledgeRelativeFilePaths('.ai-docs', true, true);
    const withoutFolders = listPersistedKnowledgeRelativeFilePaths('.ai-docs', true, false);

    assert.ok(withFolders.includes('.ai-docs/knowledge/folders.json'));
    assert.ok(!withoutFolders.includes('.ai-docs/knowledge/folders.json'));
  });

  it('lists modules.json only when requested', () => {
    const withModules = listPersistedKnowledgeRelativeFilePaths('.ai-docs', true, true, true);
    const withoutModules = listPersistedKnowledgeRelativeFilePaths('.ai-docs', true, true, false);

    assert.ok(withModules.includes('.ai-docs/knowledge/modules.json'));
    assert.ok(!withoutModules.includes('.ai-docs/knowledge/modules.json'));
  });

  it('lists dependencies.json only when requested', () => {
    const withDependencies = listPersistedKnowledgeRelativeFilePaths('.ai-docs', true, true, true, true);
    const withoutDependencies = listPersistedKnowledgeRelativeFilePaths('.ai-docs', true, true, true, false);

    assert.ok(withDependencies.includes('.ai-docs/knowledge/dependencies.json'));
    assert.ok(!withoutDependencies.includes('.ai-docs/knowledge/dependencies.json'));
  });

  it('lists staged-documentation.json only when requested', () => {
    const withStaged = listPersistedKnowledgeRelativeFilePaths(
      '.ai-docs',
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    );
    const withoutStaged = listPersistedKnowledgeRelativeFilePaths(
      '.ai-docs',
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    );

    assert.ok(withStaged.includes('.ai-docs/knowledge/staged-documentation.json'));
    assert.ok(!withoutStaged.includes('.ai-docs/knowledge/staged-documentation.json'));
  });

  it('defaults listKnowledgeRelativeFilePaths to omit optional split files', () => {
    const defaultListing = listKnowledgeRelativeFilePaths('.ai-docs');
    const fullListing = listKnowledgeRelativeFilePaths('.ai-docs', true, true, true, true);

    assert.ok(defaultListing.includes('.ai-docs/knowledge/project-knowledge.json'));
    assert.ok(defaultListing.includes('.ai-docs/knowledge/repository-tree.json'));
    assert.ok(!defaultListing.includes('.ai-docs/knowledge/folders.json'));
    assert.ok(!defaultListing.includes('.ai-docs/knowledge/modules.json'));
    assert.ok(!defaultListing.includes('.ai-docs/knowledge/dependencies.json'));
    assert.ok(fullListing.includes('.ai-docs/knowledge/folders.json'));
    assert.ok(fullListing.includes('.ai-docs/knowledge/modules.json'));
    assert.ok(fullListing.includes('.ai-docs/knowledge/dependencies.json'));
  });
});
