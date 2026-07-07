import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { analyzeFolderKnowledge, enrichProjectKnowledgeWithFolderAnalysis, shouldIgnoreFolder } from './folder-analyzer';
import { ProjectKnowledge } from '../knowledge/project-knowledge';

function createKnowledge(rootPath: string): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'sample',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'sample',
      rootPath,
      detectedFiles: ['package.json'],
      ignoredPaths: ['dist'],
      repositoryTree: {
        name: 'sample',
        path: rootPath,
        relativePath: '',
        type: 'directory',
        children: [
          {
            name: 'package.json',
            path: path.join(rootPath, 'package.json'),
            relativePath: 'package.json',
            type: 'file',
          },
          {
            name: 'src',
            path: path.join(rootPath, 'src'),
            relativePath: 'src',
            type: 'directory',
            children: [
              {
                name: 'knowledge',
                path: path.join(rootPath, 'src', 'knowledge'),
                relativePath: 'src/knowledge',
                type: 'directory',
                children: [
                  {
                    name: 'README.md',
                    path: path.join(rootPath, 'src', 'knowledge', 'README.md'),
                    relativePath: 'src/knowledge/README.md',
                    type: 'file',
                  },
                ],
              },
            ],
          },
          {
            name: 'packages',
            path: path.join(rootPath, 'packages'),
            relativePath: 'packages',
            type: 'directory',
            children: [
              {
                name: 'scanner',
                path: path.join(rootPath, 'packages', 'scanner'),
                relativePath: 'packages/scanner',
                type: 'directory',
                children: [
                  {
                    name: 'scan.ts',
                    path: path.join(rootPath, 'packages', 'scanner', 'scan.ts'),
                    relativePath: 'packages/scanner/scan.ts',
                    type: 'file',
                  },
                ],
              },
            ],
          },
          {
            name: 'dist',
            path: path.join(rootPath, 'dist'),
            relativePath: 'dist',
            type: 'directory',
            children: [
              {
                name: 'cli.js',
                path: path.join(rootPath, 'dist', 'cli.js'),
                relativePath: 'dist/cli.js',
                type: 'file',
              },
            ],
          },
          {
            name: 'node_modules',
            path: path.join(rootPath, 'node_modules'),
            relativePath: 'node_modules',
            type: 'directory',
            children: [
              {
                name: 'typescript',
                path: path.join(rootPath, 'node_modules', 'typescript'),
                relativePath: 'node_modules/typescript',
                type: 'directory',
                children: [],
              },
            ],
          },
          {
            name: '.ai-docs',
            path: path.join(rootPath, '.ai-docs'),
            relativePath: '.ai-docs',
            type: 'directory',
            children: [
              {
                name: 'knowledge',
                path: path.join(rootPath, '.ai-docs', 'knowledge'),
                relativePath: '.ai-docs/knowledge',
                type: 'directory',
                children: [],
              },
            ],
          },
        ],
      },
    },
    technologies: {
      languages: ['TypeScript'],
      frameworks: [],
      packageManagers: ['npm'],
      tooling: [],
      confidence: 'medium',
    },
    documentation: {
      plan: {
        docsDir: '.ai-docs',
        documents: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'pending',
    },
  };
}

describe('folder-analyzer', () => {
  it('ignores build output, generated docs, and persisted knowledge folders', () => {
    assert.equal(shouldIgnoreFolder('dist', '.ai-docs'), true);
    assert.equal(shouldIgnoreFolder('.ai-docs', '.ai-docs'), true);
    assert.equal(shouldIgnoreFolder('.ai-docs/knowledge', '.ai-docs'), true);
    assert.equal(shouldIgnoreFolder('.project-docs/knowledge', '.project-docs'), true);
    assert.equal(shouldIgnoreFolder('src', '.ai-docs'), false);
  });

  it('includes project root important files', () => {
    const knowledge = createKnowledge('/tmp/sample');
    const result = analyzeFolderKnowledge(knowledge);
    const rootFolder = result.folders.find((folder) => folder.relativePath === '');

    assert.ok(rootFolder);
    assert.deepEqual(rootFolder.importantFiles, ['package.json']);
    assert.equal(rootFolder.depth, 0);
    assert.equal(rootFolder.classification, 'config');
  });

  it('does not descend into ignored folders', () => {
    const knowledge = createKnowledge('/tmp/sample');
    const result = analyzeFolderKnowledge(knowledge);

    assert.equal(
      result.folders.some((folder) => folder.relativePath === 'node_modules/typescript'),
      false,
    );
    assert.equal(result.folders.some((folder) => folder.relativePath === 'dist'), false);
    assert.equal(result.folders.some((folder) => folder.relativePath === '.ai-docs'), false);
  });

  it('classifies known modules under packages with tailored responsibilities', () => {
    const knowledge = createKnowledge('/tmp/sample');
    const result = analyzeFolderKnowledge(knowledge);
    const scannerFolder = result.folders.find(
      (folder) => folder.relativePath === 'packages/scanner',
    );

    assert.ok(scannerFolder);
    assert.equal(scannerFolder.classification, 'source');
    assert.equal(scannerFolder.responsibility, 'Builds the repository tree used by analyzers.');
  });

  it('marks truncated folders in signals', () => {
    const knowledge = createKnowledge('/tmp/sample');
    knowledge.repository.repositoryTree!.children!.push({
      name: 'large',
      path: path.join('/tmp/sample', 'large'),
      relativePath: 'large',
      type: 'directory',
      truncated: true,
      children: [],
    });

    const result = analyzeFolderKnowledge(knowledge);
    const truncatedFolder = result.folders.find((folder) => folder.relativePath === 'large');

    assert.ok(truncatedFolder);
    assert.ok(truncatedFolder.signals.includes('tree-truncated:true'));
  });

  it('sets analysis status to partial and clears folderContexts without a tree', () => {
    const withTree = createKnowledge('/tmp/sample');
    const enriched = enrichProjectKnowledgeWithFolderAnalysis(withTree);

    assert.equal(enriched.knowledge.analysis.status, 'partial');
    assert.ok(enriched.knowledge.analysis.folderContexts !== undefined);

    const withoutTree: ProjectKnowledge = {
      ...withTree,
      repository: {
        ...withTree.repository,
        repositoryTree: undefined,
      },
      analysis: {
        status: 'pending',
        folderContexts: [{ relativePath: 'stale' } as never],
      },
    };

    const cleared = enrichProjectKnowledgeWithFolderAnalysis(withoutTree);
    assert.equal(cleared.knowledge.analysis.status, 'pending');
    assert.equal(cleared.knowledge.analysis.folderContexts, undefined);
  });

  it('produces documentable folder knowledge from the repository tree', () => {
    const knowledge = createKnowledge('/tmp/sample');
    const result = analyzeFolderKnowledge(knowledge);

    assert.equal(result.totalFolders, 8);
    assert.equal(result.ignoredFolders, 3);
    assert.equal(result.documentableFolders, 5);

    const srcFolder = result.folders.find((folder) => folder.relativePath === 'src');
    const knowledgeFolder = result.folders.find(
      (folder) => folder.relativePath === 'src/knowledge',
    );

    assert.ok(srcFolder);
    assert.equal(srcFolder.classification, 'source');
    assert.equal(
      srcFolder.responsibility,
      'Contains the main source code of the project.',
    );

    assert.ok(knowledgeFolder);
    assert.equal(knowledgeFolder.classification, 'source');
    assert.equal(knowledgeFolder.confidence, 'high');
    assert.equal(
      knowledgeFolder.responsibility,
      'Represents and persists the Project Knowledge Model used as the source of truth.',
    );
    assert.deepEqual(knowledgeFolder.importantFiles, ['src/knowledge/README.md']);
    assert.equal(knowledgeFolder.signals.includes('name-match:documentation'), false);
  });
});
