import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { persistProjectKnowledge } from './knowledge-writer';
import { KNOWLEDGE_FILE_NAMES, resolveKnowledgeFilePath } from './knowledge-paths';
import { ConventionKnowledge, FolderKnowledge, ModuleKnowledge, NavigationMapKnowledge, ProjectKnowledge, DependencyGraphKnowledge } from './project-knowledge';

function createModuleContext(relativePath: string): ModuleKnowledge {
  return {
    path: relativePath,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
    type: 'core',
    responsibility: 'test',
    importantFiles: [],
    relatedFolders: [],
    signals: [],
    confidence: 'high',
  };
}

function createFolderContext(relativePath: string): FolderKnowledge {
  return {
    path: relativePath,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
    depth: 1,
    classification: 'source',
    responsibility: 'test',
    importantFiles: [],
    childFolders: [],
    signals: [],
    confidence: 'high',
  };
}

function createConvention(): ConventionKnowledge {
  return {
    category: 'documentation',
    name: 'Root README',
    description: 'The repository documents itself with a root README.md.',
    evidence: [
      { type: 'file', source: 'README.md', detail: 'Repository contains a root README.md' },
    ],
    confidence: 'high',
  };
}

function createNavigationMap(): NavigationMapKnowledge {
  return {
    entries: [
      {
        taskType: 'bug-fix',
        description: 'test',
        recommendedKnowledge: ['modules'],
        recommendedDocuments: ['implementation-guide.md'],
        relatedModules: [],
        relatedFolders: [],
        warnings: ['Avoid changing unrelated modules.'],
        confidence: 'high',
      },
    ],
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createKnowledge(
  rootPath: string,
  options: {
    includeTree?: boolean;
    includeFolderContexts?: boolean;
    includeModules?: boolean;
    includeDependencyGraph?: boolean;
    includeConventions?: boolean;
    includeNavigationMap?: boolean;
  } = {},
): ProjectKnowledge {
  const includeTree = options.includeTree ?? true;
  const includeFolderContexts = options.includeFolderContexts ?? false;
  const includeModules = options.includeModules ?? false;
  const includeDependencyGraph = options.includeDependencyGraph ?? false;
  const includeConventions = options.includeConventions ?? false;
  const includeNavigationMap = options.includeNavigationMap ?? false;

  const repositoryTree = includeTree
    ? {
        name: path.basename(rootPath),
        path: rootPath,
        relativePath: '',
        type: 'directory' as const,
        children: [
          {
            name: 'README.md',
            path: path.join(rootPath, 'README.md'),
            relativePath: 'README.md',
            type: 'file' as const,
          },
        ],
      }
    : undefined;

  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: path.basename(rootPath),
      docsDir: '.ai-docs',
    },
    repository: {
      name: path.basename(rootPath),
      rootPath,
      detectedFiles: ['README.md'],
      ignoredPaths: ['dist'],
      repositoryTree,
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
      status:
        includeFolderContexts ||
        includeModules ||
        includeDependencyGraph ||
        includeConventions ||
        includeNavigationMap
          ? 'partial'
          : 'pending',
      folderContexts: includeFolderContexts
        ? [createFolderContext('src')]
        : undefined,
      modules: includeModules ? [createModuleContext('src/knowledge')] : undefined,
      dependencyGraph: includeDependencyGraph
        ? ({
            nodes: [],
            edges: [],
            generatedAt: '2026-01-01T00:00:00.000Z',
          } satisfies DependencyGraphKnowledge)
        : undefined,
      conventions: includeConventions ? [createConvention()] : undefined,
      navigationMap: includeNavigationMap ? createNavigationMap() : undefined,
    },
  };
}

describe('knowledge-writer', () => {
  it('removes stale repository-tree.json when the PKM no longer has a tree', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-writer-'));

    try {
      const withTree = createKnowledge(tempRoot, { includeTree: true });
      persistProjectKnowledge(withTree);

      const repositoryTreePath = resolveKnowledgeFilePath(
        tempRoot,
        '.ai-docs',
        KNOWLEDGE_FILE_NAMES.repositoryTree,
      );
      assert.equal(fs.existsSync(repositoryTreePath), true);

      const withoutTree = createKnowledge(tempRoot, { includeTree: false });
      persistProjectKnowledge(withoutTree);

      assert.equal(fs.existsSync(repositoryTreePath), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('writes folders.json when folderContexts exist and removes stale file when cleared', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-writer-'));

    try {
      const withFolders = createKnowledge(tempRoot, {
        includeTree: true,
        includeFolderContexts: true,
      });
      const persistenceWithFolders = persistProjectKnowledge(withFolders);

      const foldersPath = resolveKnowledgeFilePath(
        tempRoot,
        '.ai-docs',
        KNOWLEDGE_FILE_NAMES.folders,
      );

      assert.equal(fs.existsSync(foldersPath), true);
      assert.ok(
        persistenceWithFolders.persistedRelativePaths.includes('.ai-docs/knowledge/folders.json'),
      );

      const withoutFolders = createKnowledge(tempRoot, { includeTree: true });
      persistProjectKnowledge(withoutFolders);

      assert.equal(fs.existsSync(foldersPath), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('writes modules.json when modules exist and removes stale file when cleared', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-writer-modules-'));

    try {
      const withModules = createKnowledge(tempRoot, {
        includeTree: true,
        includeModules: true,
      });
      const persistenceWithModules = persistProjectKnowledge(withModules);

      const modulesPath = resolveKnowledgeFilePath(
        tempRoot,
        '.ai-docs',
        KNOWLEDGE_FILE_NAMES.modules,
      );

      assert.equal(fs.existsSync(modulesPath), true);
      assert.ok(
        persistenceWithModules.persistedRelativePaths.includes('.ai-docs/knowledge/modules.json'),
      );

      const withoutModules = createKnowledge(tempRoot, { includeTree: true });
      persistProjectKnowledge(withoutModules);

      assert.equal(fs.existsSync(modulesPath), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('writes dependencies.json when dependencyGraph exists and removes stale file when cleared', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-writer-dependencies-'));

    try {
      const withDependencies = createKnowledge(tempRoot, {
        includeTree: true,
        includeDependencyGraph: true,
      });
      const persistenceWithDependencies = persistProjectKnowledge(withDependencies);

      const dependenciesPath = resolveKnowledgeFilePath(
        tempRoot,
        '.ai-docs',
        KNOWLEDGE_FILE_NAMES.dependencies,
      );

      assert.equal(fs.existsSync(dependenciesPath), true);
      assert.ok(
        persistenceWithDependencies.persistedRelativePaths.includes(
          '.ai-docs/knowledge/dependencies.json',
        ),
      );

      const withoutDependencies = createKnowledge(tempRoot, { includeTree: true });
      persistProjectKnowledge(withoutDependencies);

      assert.equal(fs.existsSync(dependenciesPath), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('writes conventions.json when conventions exist and removes stale file when cleared', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-writer-conventions-'));

    try {
      const withConventions = createKnowledge(tempRoot, {
        includeTree: true,
        includeConventions: true,
      });
      const persistenceWithConventions = persistProjectKnowledge(withConventions);

      const conventionsPath = resolveKnowledgeFilePath(
        tempRoot,
        '.ai-docs',
        KNOWLEDGE_FILE_NAMES.conventions,
      );

      assert.equal(fs.existsSync(conventionsPath), true);
      assert.ok(
        persistenceWithConventions.persistedRelativePaths.includes(
          '.ai-docs/knowledge/conventions.json',
        ),
      );

      const persisted = JSON.parse(fs.readFileSync(conventionsPath, 'utf-8')) as {
        conventions: ConventionKnowledge[];
      };
      assert.equal(persisted.conventions.length, 1);
      assert.equal(persisted.conventions[0]?.name, 'Root README');

      const withoutConventions = createKnowledge(tempRoot, { includeTree: true });
      persistProjectKnowledge(withoutConventions);

      assert.equal(fs.existsSync(conventionsPath), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('writes navigation-map.json when a navigation map exists and removes stale file when cleared', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-writer-navigation-'));

    try {
      const withNavigationMap = createKnowledge(tempRoot, {
        includeTree: true,
        includeNavigationMap: true,
      });
      const persistenceWithNavigationMap = persistProjectKnowledge(withNavigationMap);

      const navigationMapPath = resolveKnowledgeFilePath(
        tempRoot,
        '.ai-docs',
        KNOWLEDGE_FILE_NAMES.navigationMap,
      );

      assert.equal(fs.existsSync(navigationMapPath), true);
      assert.ok(
        persistenceWithNavigationMap.persistedRelativePaths.includes(
          '.ai-docs/knowledge/navigation-map.json',
        ),
      );

      const persisted = JSON.parse(fs.readFileSync(navigationMapPath, 'utf-8')) as {
        navigationMap: NavigationMapKnowledge;
      };
      assert.equal(persisted.navigationMap.entries.length, 1);
      assert.equal(persisted.navigationMap.entries[0]?.taskType, 'bug-fix');

      const withoutNavigationMap = createKnowledge(tempRoot, { includeTree: true });
      persistProjectKnowledge(withoutNavigationMap);

      assert.equal(fs.existsSync(navigationMapPath), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
