import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import {
  analyzeModuleKnowledge,
  enrichProjectKnowledgeWithModuleAnalysis,
} from './module-analyzer';
import { FolderKnowledge, ProjectKnowledge } from '../knowledge/project-knowledge';

function createFolder(
  rootPath: string,
  relativePath: string,
  overrides: Partial<FolderKnowledge> = {},
): FolderKnowledge {
  const name = relativePath.split('/').pop() ?? relativePath;
  return {
    path: path.join(rootPath, ...relativePath.split('/')),
    relativePath,
    name,
    depth: relativePath.split('/').filter((segment) => segment.length > 0).length,
    classification: 'source',
    responsibility: 'test',
    importantFiles: [],
    childFolders: [],
    signals: [`folder-name:${name}`],
    confidence: 'high',
    ...overrides,
  };
}

function createKnowledge(
  rootPath: string,
  folders: FolderKnowledge[],
  options: { includeTree?: boolean } = {},
): ProjectKnowledge {
  const includeTree = options.includeTree ?? false;
  const resolvedRoot = path.resolve(rootPath);

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
      rootPath: resolvedRoot,
      detectedFiles: ['package.json'],
      ignoredPaths: ['dist'],
      repositoryTree: includeTree
        ? {
            name: 'sample',
            path: resolvedRoot,
            relativePath: '',
            type: 'directory',
            children: [
              {
                name: 'apps',
                path: path.join(resolvedRoot, 'apps'),
                relativePath: 'apps',
                type: 'directory',
                children: [
                  {
                    name: 'admin',
                    path: path.join(resolvedRoot, 'apps', 'admin'),
                    relativePath: 'apps/admin',
                    type: 'directory',
                    children: [
                      {
                        name: 'README.md',
                        path: path.join(resolvedRoot, 'apps', 'admin', 'README.md'),
                        relativePath: 'apps/admin/README.md',
                        type: 'file',
                      },
                    ],
                  },
                ],
              },
            ],
          }
        : undefined,
    },
    technologies: {
      languages: ['TypeScript'],
      frameworks: ['NestJS'],
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
      status: 'partial',
      folderContexts: folders,
    },
  };
}

describe('module-analyzer', () => {
  it('discovers modules from folder knowledge without scanning the filesystem', () => {
    const rootPath = path.join('C:', 'repo');
    const folders = [
      createFolder(rootPath, 'src/knowledge'),
      createFolder(rootPath, 'src/scanner'),
      createFolder(rootPath, 'src/analyzers'),
      createFolder(rootPath, 'src/docs'),
      createFolder(rootPath, 'src/detectors'),
      createFolder(rootPath, 'src/core'),
      createFolder(rootPath, 'src/domain'),
      createFolder(rootPath, 'src/config'),
      createFolder(rootPath, 'src/utils'),
      createFolder(rootPath, 'packages/scanner', {
        importantFiles: ['packages/scanner/package.json'],
      }),
      createFolder(rootPath, 'docs'),
    ];

    const result = analyzeModuleKnowledge(createKnowledge(rootPath, folders));

    assert.equal(result.totalModules, 12);
    assert.equal(result.highConfidenceModules, 12);
    assert.equal(result.mediumConfidenceModules, 0);
    assert.ok(result.modules.some((module) => module.relativePath === 'src/knowledge'));
    assert.ok(result.modules.some((module) => module.relativePath === 'packages/scanner'));
    assert.equal(
      result.modules.find((module) => module.relativePath === 'packages/scanner')?.framework,
      undefined,
    );
    assert.ok(
      result.modules.every((module) =>
        module.signals.some((signal) => signal.startsWith('module-key:')),
      ),
    );
  });

  it('adds the configured docs output directory from metadata when absent from folder contexts', () => {
    const rootPath = path.join('C:', 'repo');
    const result = analyzeModuleKnowledge(createKnowledge(rootPath, [createFolder(rootPath, 'docs')]));

    const aiDocs = result.modules.find((module) => module.relativePath === '.ai-docs');
    assert.ok(aiDocs);
    assert.equal(aiDocs.type, 'documentation');
    assert.deepEqual(aiDocs.relatedFolders, []);
    assert.ok(aiDocs.signals.includes('source:metadata.docsDir'));
    assert.ok(aiDocs.signals.includes('related-folders:unverified'));
  });

  it('uses folder knowledge child folders for the docs output module when available', () => {
    const rootPath = path.join('C:', 'repo');
    const folders = [
      createFolder(rootPath, 'docs'),
      createFolder(rootPath, '.ai-docs', { childFolders: ['knowledge', 'README.md'] }),
    ];
    const result = analyzeModuleKnowledge(createKnowledge(rootPath, folders));
    const aiDocs = result.modules.find((module) => module.relativePath === '.ai-docs');

    assert.ok(aiDocs);
    assert.deepEqual(aiDocs.relatedFolders, ['knowledge', 'README.md']);
    assert.equal(aiDocs.signals.includes('related-folders:unverified'), false);
  });

  it('discovers tree-only module candidates from the repository tree', () => {
    const rootPath = path.join('C:', 'repo');
    const result = analyzeModuleKnowledge(createKnowledge(rootPath, [], { includeTree: true }));

    assert.equal(result.totalModules, 2);
    assert.ok(result.modules.some((module) => module.relativePath === 'apps/admin'));
    assert.ok(result.modules.some((module) => module.relativePath === '.ai-docs'));

    const adminModule = result.modules.find((module) => module.relativePath === 'apps/admin');
    assert.equal(adminModule?.type, 'application');
    assert.equal(adminModule?.confidence, 'medium');
    assert.equal(adminModule?.framework, 'NestJS');
    assert.ok(adminModule?.signals.includes('source:repository-tree'));
  });

  it('enriches project knowledge with module analysis results', () => {
    const rootPath = path.join('C:', 'repo');
    const knowledge = createKnowledge(rootPath, [createFolder(rootPath, 'src/knowledge')]);
    const { knowledge: enriched, result } = enrichProjectKnowledgeWithModuleAnalysis(knowledge);

    assert.equal(result.totalModules, 2);
    assert.equal(enriched.analysis.modules?.length, 2);
    assert.ok(enriched.analysis.modules?.some((module) => module.relativePath === 'src/knowledge'));
    assert.ok(enriched.analysis.modules?.some((module) => module.relativePath === '.ai-docs'));
  });

  it('persists metadata-only module discovery through enrichProjectKnowledgeWithModuleAnalysis', () => {
    const rootPath = path.join('C:', 'repo');
    const knowledge = createKnowledge(rootPath, []);
    knowledge.analysis.folderContexts = undefined;
    knowledge.repository.repositoryTree = undefined;

    const { knowledge: enriched, result } = enrichProjectKnowledgeWithModuleAnalysis(knowledge);

    assert.equal(result.totalModules, 1);
    assert.equal(enriched.analysis.modules?.length, 1);
    assert.equal(enriched.analysis.modules?.[0]?.relativePath, '.ai-docs');
    assert.equal(enriched.analysis.status, 'partial');
  });

  it('still adds the docs output module when folder analysis only found non-module folders', () => {
    const rootPath = path.join('C:', 'repo');
    const knowledge = createKnowledge(rootPath, [createFolder(rootPath, 'src')]);
    const { knowledge: enriched } = enrichProjectKnowledgeWithModuleAnalysis(knowledge);

    assert.equal(enriched.analysis.modules?.length, 1);
    assert.equal(enriched.analysis.modules?.[0]?.relativePath, '.ai-docs');
    assert.equal(enriched.analysis.status, 'partial');
  });
});
