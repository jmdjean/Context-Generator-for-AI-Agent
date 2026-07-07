import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  analyzeDependencyGraph,
  enrichProjectKnowledgeWithDependencyGraph,
  resolveRelativeImportPath,
} from './dependency-graph-analyzer';
import { ModuleKnowledge, ProjectKnowledge } from '../knowledge/project-knowledge';

function createModule(
  relativePath: string,
  overrides: Partial<ModuleKnowledge> = {},
): ModuleKnowledge {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    path: relativePath,
    relativePath,
    type: 'core',
    responsibility: 'test module',
    importantFiles: [],
    relatedFolders: [],
    signals: [],
    confidence: 'high',
    ...overrides,
  };
}

function createKnowledge(
  rootPath: string,
  modules: ModuleKnowledge[],
  treeChildren: ProjectKnowledge['repository']['repositoryTree'],
): ProjectKnowledge {
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
      repositoryTree: treeChildren,
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
      status: 'partial',
      modules,
    },
  };
}

describe('dependency-graph-analyzer', () => {
  it('resolves relative import paths from source files', () => {
    assert.equal(
      resolveRelativeImportPath('src/core/handler.ts', '../knowledge'),
      'src/knowledge',
    );
    assert.equal(
      resolveRelativeImportPath('src/core/handler.ts', '../knowledge/project-knowledge'),
      'src/knowledge/project-knowledge',
    );
  });

  it('creates import edges between modules from relative imports', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-graph-'));

    try {
      const coreDir = path.join(tempRoot, 'src', 'core');
      const knowledgeDir = path.join(tempRoot, 'src', 'knowledge');
      fs.mkdirSync(coreDir, { recursive: true });
      fs.mkdirSync(knowledgeDir, { recursive: true });
      fs.writeFileSync(
        path.join(coreDir, 'pipeline-handlers.ts'),
        `import { buildProjectKnowledge } from '../knowledge';\n`,
        'utf-8',
      );
      fs.writeFileSync(path.join(knowledgeDir, 'index.ts'), `export {};\n`, 'utf-8');

      const modules = [createModule('src/core'), createModule('src/knowledge')];
      const knowledge = createKnowledge(tempRoot, modules, {
        name: 'sample',
        path: tempRoot,
        relativePath: '',
        type: 'directory',
        children: [
          {
            name: 'src',
            path: path.join(tempRoot, 'src'),
            relativePath: 'src',
            type: 'directory',
            children: [
              {
                name: 'core',
                path: path.join(tempRoot, 'src', 'core'),
                relativePath: 'src/core',
                type: 'directory',
                children: [
                  {
                    name: 'pipeline-handlers.ts',
                    path: path.join(tempRoot, 'src', 'core', 'pipeline-handlers.ts'),
                    relativePath: 'src/core/pipeline-handlers.ts',
                    type: 'file',
                  },
                ],
              },
              {
                name: 'knowledge',
                path: path.join(tempRoot, 'src', 'knowledge'),
                relativePath: 'src/knowledge',
                type: 'directory',
                children: [
                  {
                    name: 'index.ts',
                    path: path.join(tempRoot, 'src', 'knowledge', 'index.ts'),
                    relativePath: 'src/knowledge/index.ts',
                    type: 'file',
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = analyzeDependencyGraph(knowledge);

      assert.equal(result.totalNodes, 2);
      assert.equal(result.totalEdges, 1);
      assert.equal(result.importsAnalyzed, 1);
      assert.equal(result.filesRead, 2);
      assert.equal(result.filesSkipped, 0);
      assert.equal(result.dependencyGraph.generatedAt, '2026-01-01T00:00:00.000Z');
      assert.equal(result.dependencyGraph.edges[0]?.from, 'src/core');
      assert.equal(result.dependencyGraph.edges[0]?.to, 'src/knowledge');
      assert.equal(result.dependencyGraph.edges[0]?.type, 'imports');
      assert.equal(result.dependencyGraph.edges[0]?.confidence, 'high');
      assert.equal(result.dependencyGraph.edges[0]?.evidence[0]?.sourceFile, 'src/core/pipeline-handlers.ts');
      assert.equal(result.dependencyGraph.edges[0]?.evidence[0]?.importPath, '../knowledge');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('assigns high confidence when importing a file inside a module', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-graph-nested-'));

    try {
      const coreDir = path.join(tempRoot, 'src', 'core');
      const knowledgeDir = path.join(tempRoot, 'src', 'knowledge');
      fs.mkdirSync(coreDir, { recursive: true });
      fs.mkdirSync(knowledgeDir, { recursive: true });
      fs.writeFileSync(
        path.join(coreDir, 'handler.ts'),
        `import { ProjectKnowledge } from '../knowledge/project-knowledge';\n`,
        'utf-8',
      );
      fs.writeFileSync(
        path.join(knowledgeDir, 'project-knowledge.ts'),
        `export interface ProjectKnowledge {}\n`,
        'utf-8',
      );

      const modules = [createModule('src/core'), createModule('src/knowledge')];
      const knowledge = createKnowledge(tempRoot, modules, {
        name: 'sample',
        path: tempRoot,
        relativePath: '',
        type: 'directory',
        children: [
          {
            name: 'src',
            path: path.join(tempRoot, 'src'),
            relativePath: 'src',
            type: 'directory',
            children: [
              {
                name: 'core',
                path: path.join(tempRoot, 'src', 'core'),
                relativePath: 'src/core',
                type: 'directory',
                children: [
                  {
                    name: 'handler.ts',
                    path: path.join(tempRoot, 'src', 'core', 'handler.ts'),
                    relativePath: 'src/core/handler.ts',
                    type: 'file',
                  },
                ],
              },
              {
                name: 'knowledge',
                path: path.join(tempRoot, 'src', 'knowledge'),
                relativePath: 'src/knowledge',
                type: 'directory',
                children: [
                  {
                    name: 'project-knowledge.ts',
                    path: path.join(tempRoot, 'src', 'knowledge', 'project-knowledge.ts'),
                    relativePath: 'src/knowledge/project-knowledge.ts',
                    type: 'file',
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = analyzeDependencyGraph(knowledge);
      assert.equal(result.totalEdges, 1);
      assert.equal(result.dependencyGraph.edges[0]?.confidence, 'high');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does not create edges from test files', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-graph-tests-'));

    try {
      const coreDir = path.join(tempRoot, 'src', 'core');
      fs.mkdirSync(coreDir, { recursive: true });
      fs.writeFileSync(
        path.join(coreDir, 'handler.test.ts'),
        `import { ProjectKnowledge } from '../knowledge/project-knowledge';\n`,
        'utf-8',
      );

      const modules = [createModule('src/core'), createModule('src/knowledge')];
      const knowledge = createKnowledge(tempRoot, modules, {
        name: 'sample',
        path: tempRoot,
        relativePath: '',
        type: 'directory',
        children: [
          {
            name: 'src',
            path: path.join(tempRoot, 'src'),
            relativePath: 'src',
            type: 'directory',
            children: [
              {
                name: 'core',
                path: path.join(tempRoot, 'src', 'core'),
                relativePath: 'src/core',
                type: 'directory',
                children: [
                  {
                    name: 'handler.test.ts',
                    path: path.join(tempRoot, 'src', 'core', 'handler.test.ts'),
                    relativePath: 'src/core/handler.test.ts',
                    type: 'file',
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = analyzeDependencyGraph(knowledge);
      assert.equal(result.totalEdges, 0);
      assert.equal(result.importsAnalyzed, 0);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does not create edges when import resolution escapes the repository', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-graph-unresolved-'));

    try {
      const coreDir = path.join(tempRoot, 'src', 'core');
      fs.mkdirSync(coreDir, { recursive: true });
      fs.writeFileSync(
        path.join(coreDir, 'handler.ts'),
        `import { helper } from '../../../../outside/foo';\n`,
        'utf-8',
      );

      const modules = [
        createModule('src/core'),
        createModule('src/features/foo'),
      ];
      const knowledge = createKnowledge(tempRoot, modules, {
        name: 'sample',
        path: tempRoot,
        relativePath: '',
        type: 'directory',
        children: [
          {
            name: 'src',
            path: path.join(tempRoot, 'src'),
            relativePath: 'src',
            type: 'directory',
            children: [
              {
                name: 'core',
                path: path.join(tempRoot, 'src', 'core'),
                relativePath: 'src/core',
                type: 'directory',
                children: [
                  {
                    name: 'handler.ts',
                    path: path.join(tempRoot, 'src', 'core', 'handler.ts'),
                    relativePath: 'src/core/handler.ts',
                    type: 'file',
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = analyzeDependencyGraph(knowledge);
      assert.equal(result.totalEdges, 0);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('excludes documentation modules without edges from graph nodes', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-graph-docs-nodes-'));

    try {
      const modules = [
        createModule('src/core'),
        createModule('docs', { type: 'documentation' }),
      ];
      const knowledge = createKnowledge(tempRoot, modules, {
        name: 'sample',
        path: tempRoot,
        relativePath: '',
        type: 'directory',
      });

      const result = analyzeDependencyGraph(knowledge);
      assert.ok(result.dependencyGraph.nodes.every((node) => node.id !== 'docs'));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('counts only relative imports in importsAnalyzed', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-graph-relative-count-'));

    try {
      const coreDir = path.join(tempRoot, 'src', 'core');
      fs.mkdirSync(coreDir, { recursive: true });
      fs.writeFileSync(
        path.join(coreDir, 'handler.ts'),
        `import fs from 'node:fs';\nimport { x } from '../knowledge';\n`,
        'utf-8',
      );

      const modules = [createModule('src/core'), createModule('src/knowledge')];
      const knowledge = createKnowledge(tempRoot, modules, {
        name: 'sample',
        path: tempRoot,
        relativePath: '',
        type: 'directory',
        children: [
          {
            name: 'src',
            path: path.join(tempRoot, 'src'),
            relativePath: 'src',
            type: 'directory',
            children: [
              {
                name: 'core',
                path: path.join(tempRoot, 'src', 'core'),
                relativePath: 'src/core',
                type: 'directory',
                children: [
                  {
                    name: 'handler.ts',
                    path: path.join(tempRoot, 'src', 'core', 'handler.ts'),
                    relativePath: 'src/core/handler.ts',
                    type: 'file',
                  },
                ],
              },
              {
                name: 'knowledge',
                path: path.join(tempRoot, 'src', 'knowledge'),
                relativePath: 'src/knowledge',
                type: 'directory',
              },
            ],
          },
        ],
      });

      const result = analyzeDependencyGraph(knowledge);
      assert.equal(result.importsAnalyzed, 1);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('enriches PKM analysis.dependencyGraph', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-graph-enrich-'));

    try {
      const knowledge = createKnowledge(tempRoot, [createModule('src/core')], {
        name: 'sample',
        path: tempRoot,
        relativePath: '',
        type: 'directory',
      });

      const { knowledge: enriched, result } = enrichProjectKnowledgeWithDependencyGraph(knowledge);

      assert.equal(enriched.analysis.dependencyGraph?.nodes.length, result.totalNodes);
      assert.equal(enriched.analysis.dependencyGraph?.edges.length, result.totalEdges);
      assert.equal(enriched.analysis.dependencyGraph?.generatedAt, knowledge.metadata.generatedAt);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
