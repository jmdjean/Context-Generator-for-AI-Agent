import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FolderKnowledge,
  ModuleKnowledge,
  NavigationTaskType,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { PlannedDocument } from '../docs/documentation-plan';
import {
  buildNavigationMap,
  enrichProjectKnowledgeWithNavigationMap,
} from './navigation-map-analyzer';
import { NAVIGATION_RULES } from './navigation-map-builder';

const ALL_TASK_TYPES: NavigationTaskType[] = [
  'architecture-change',
  'new-feature',
  'bug-fix',
  'test-change',
  'documentation-change',
  'config-change',
  'dependency-change',
  'ai-agent-integration',
];

const PLANNED_DOCUMENT_PATHS = [
  'README.md',
  'architecture.md',
  'folder-structure.md',
  'agent-navigation.md',
  'conventions.md',
  'dependency-map.md',
  'change-log.md',
  'AGENTS.md',
  'ai-context.md',
  'implementation-guide.md',
];

function createPlannedDocument(relativePath: string): PlannedDocument {
  return {
    title: relativePath,
    relativePath,
    purpose: 'test',
    priority: 'required',
    source: 'core',
  };
}

function createModule(
  relativePath: string,
  type: ModuleKnowledge['type'] = 'core',
): ModuleKnowledge {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    path: relativePath,
    relativePath,
    type,
    responsibility: 'test responsibility',
    importantFiles: [],
    relatedFolders: [],
    signals: [],
    confidence: 'high',
  };
}

function createFolder(
  relativePath: string,
  classification: FolderKnowledge['classification'] = 'source',
): FolderKnowledge {
  return {
    path: relativePath,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
    depth: relativePath.split('/').length,
    classification,
    responsibility: 'test',
    importantFiles: [],
    childFolders: [],
    signals: [],
    confidence: 'high',
  };
}

function createKnowledge(options: {
  modules?: ModuleKnowledge[];
  folderContexts?: FolderKnowledge[];
  plannedDocuments?: string[];
  includeDependencyGraph?: boolean;
  includeConventions?: boolean;
} = {}): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'fixture',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'fixture',
      rootPath: '/fixture',
      detectedFiles: [],
      ignoredPaths: [],
    },
    technologies: {
      languages: ['TypeScript'],
      frameworks: [],
      packageManagers: ['npm'],
      tooling: [],
      confidence: 'high',
    },
    documentation: {
      plan: {
        docsDir: '.ai-docs',
        documents: (options.plannedDocuments ?? PLANNED_DOCUMENT_PATHS).map(createPlannedDocument),
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'partial',
      modules: options.modules,
      folderContexts: options.folderContexts,
      dependencyGraph:
        (options.includeDependencyGraph ?? true)
          ? { nodes: [], edges: [], generatedAt: '2026-01-01T00:00:00.000Z' }
          : undefined,
      conventions:
        (options.includeConventions ?? true)
          ? [
              {
                category: 'language',
                name: 'TypeScript project',
                description: 'test',
                evidence: [{ type: 'file', source: 'tsconfig.json', detail: 'test' }],
                confidence: 'high',
              },
            ]
          : undefined,
    },
  };
}

function createFullyPopulatedKnowledge(): ProjectKnowledge {
  return createKnowledge({
    modules: [
      createModule('src/core'),
      createModule('src/domain'),
      createModule('src/knowledge'),
      createModule('src/analyzers'),
      createModule('src/docs'),
      createModule('src/config', 'configuration'),
      createModule('docs', 'documentation'),
    ],
    folderContexts: [
      createFolder('src'),
      createFolder('src/core'),
      createFolder('src/domain'),
      createFolder('docs', 'documentation'),
    ],
  });
}

describe('navigation-map-analyzer', () => {
  it('builds one entry per task type with all fields populated', () => {
    const result = buildNavigationMap(createFullyPopulatedKnowledge());

    assert.equal(result.totalEntries, NAVIGATION_RULES.length);
    assert.deepEqual(
      result.navigationMap.entries.map((entry) => entry.taskType),
      ALL_TASK_TYPES,
    );

    for (const entry of result.navigationMap.entries) {
      assert.ok(entry.description.length > 0, `${entry.taskType} has no description`);
      assert.ok(entry.recommendedKnowledge.length > 0);
      assert.ok(entry.recommendedDocuments.length > 0);
      assert.ok(entry.warnings.length > 0);
    }

    assert.equal(result.navigationMap.generatedAt, '2026-01-01T00:00:00.000Z');
  });

  it('reports high confidence when all knowledge and planned documents are available', () => {
    const result = buildNavigationMap(createFullyPopulatedKnowledge());

    assert.equal(result.highConfidenceEntries, NAVIGATION_RULES.length);
    assert.equal(result.mediumConfidenceEntries, 0);
    assert.equal(result.lowConfidenceEntries, 0);
  });

  it('lowers confidence when recommended knowledge sections are missing', () => {
    const result = buildNavigationMap(
      createKnowledge({ includeDependencyGraph: false, includeConventions: false }),
    );

    const architectureEntry = result.navigationMap.entries.find(
      (entry) => entry.taskType === 'architecture-change',
    );
    assert.ok(architectureEntry);
    assert.notEqual(architectureEntry.confidence, 'high');
    assert.ok(result.highConfidenceEntries < NAVIGATION_RULES.length);
  });

  it('lowers confidence when recommended documents are not planned', () => {
    const result = buildNavigationMap(createKnowledge({ plannedDocuments: ['README.md'] }));

    const architectureEntry = result.navigationMap.entries.find(
      (entry) => entry.taskType === 'architecture-change',
    );
    assert.ok(architectureEntry);
    assert.equal(architectureEntry.confidence, 'low');
  });

  it('resolves related modules from PKM data without inventing paths', () => {
    const result = buildNavigationMap(createFullyPopulatedKnowledge());
    const entries = new Map(result.navigationMap.entries.map((entry) => [entry.taskType, entry]));

    assert.deepEqual(entries.get('architecture-change')?.relatedModules, [
      'src/analyzers',
      'src/core',
      'src/docs',
      'src/domain',
      'src/knowledge',
    ]);
    assert.deepEqual(entries.get('config-change')?.relatedModules, ['src/config']);
    assert.deepEqual(entries.get('documentation-change')?.relatedModules, [
      'docs',
      'src/docs',
      'src/knowledge',
    ]);
    assert.deepEqual(entries.get('documentation-change')?.relatedFolders, ['docs']);
  });

  it('returns empty related arrays when no PKM matches exist', () => {
    const result = buildNavigationMap(createKnowledge());

    for (const entry of result.navigationMap.entries) {
      assert.deepEqual(entry.relatedModules, []);
      assert.deepEqual(entry.relatedFolders, []);
    }
  });

  it('matches folders by classification for test-change entries', () => {
    const result = buildNavigationMap(
      createKnowledge({
        folderContexts: [createFolder('src'), createFolder('src/feature/__tests__', 'test')],
      }),
    );

    const testEntry = result.navigationMap.entries.find(
      (entry) => entry.taskType === 'test-change',
    );
    assert.ok(testEntry);
    assert.deepEqual(testEntry.relatedFolders, ['src/feature/__tests__']);
  });

  it('enrichProjectKnowledgeWithNavigationMap returns a new object and preserves the input', () => {
    const knowledge = createFullyPopulatedKnowledge();
    const { knowledge: enriched, result } = enrichProjectKnowledgeWithNavigationMap(knowledge);

    assert.notEqual(enriched, knowledge);
    assert.equal(knowledge.analysis.navigationMap, undefined);
    assert.ok(enriched.analysis.navigationMap);
    assert.equal(enriched.analysis.navigationMap.entries.length, result.totalEntries);
    assert.equal(enriched.analysis.status, 'partial');
  });
});
