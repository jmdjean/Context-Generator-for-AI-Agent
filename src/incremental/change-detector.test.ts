import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectChanges } from './change-detector';
import {
  formatRunSummaryChangeDetectionLines,
  formatChangeDetectionSummaryLine,
} from './change-summary-formatter';
import { loadPreviousKnowledgeBaseline } from './state-loader';
import { persistProjectKnowledge } from '../knowledge/knowledge-writer';
import { KNOWLEDGE_FILE_NAMES, resolveKnowledgeFilePath } from '../knowledge/knowledge-paths';
import {
  ChangeSummaryKnowledge,
  ConventionKnowledge,
  DependencyGraphKnowledge,
  ModuleKnowledge,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';

function createModule(relativePath: string, responsibility = 'test module'): ModuleKnowledge {
  return {
    path: relativePath,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
    type: 'core',
    responsibility,
    importantFiles: [],
    relatedFolders: [],
    signals: [],
    confidence: 'high',
  };
}

function createConvention(name: string, evidenceDetail: string): ConventionKnowledge {
  return {
    category: 'documentation',
    name,
    description: 'test convention',
    evidence: [{ type: 'file', source: 'README.md', detail: evidenceDetail }],
    confidence: 'high',
  };
}

function createKnowledge(
  rootPath: string,
  options: {
    modules?: ModuleKnowledge[];
    detectedFiles?: string[];
    dependencyGraph?: DependencyGraphKnowledge;
    aiInsights?: ProjectKnowledge['analysis']['aiInsights'];
    stagedDocumentation?: ProjectKnowledge['analysis']['stagedDocumentation'];
    conventions?: ConventionKnowledge[];
    technologyConfidence?: ProjectKnowledge['technologies']['confidence'];
  } = {},
): ProjectKnowledge {
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
      detectedFiles: options.detectedFiles ?? ['README.md'],
      ignoredPaths: [],
      repositoryTree: {
        name: path.basename(rootPath),
        path: rootPath,
        relativePath: '',
        type: 'directory',
        children: [
          {
            name: 'README.md',
            path: path.join(rootPath, 'README.md'),
            relativePath: 'README.md',
            type: 'file',
          },
        ],
      },
    },
    technologies: {
      languages: ['TypeScript'],
      frameworks: [],
      packageManagers: ['npm'],
      tooling: [],
      confidence: options.technologyConfidence ?? 'medium',
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
      modules: options.modules,
      dependencyGraph: options.dependencyGraph,
      aiInsights: options.aiInsights,
      stagedDocumentation: options.stagedDocumentation,
      conventions: options.conventions,
    },
  };
}

describe('change-detector', () => {
  it('treats missing previous PKM as an initial run', () => {
    const current = createKnowledge('/tmp/project');
    const summary = detectChanges({ status: 'none' }, current);

    assert.equal(summary.isInitialRun, true);
    assert.equal(summary.baselineStatus, 'none');
    assert.deepEqual(summary.changedSections, []);
  });

  it('reports unreadable snapshots without claiming an initial run', () => {
    const current = createKnowledge('/tmp/project');
    const summary = detectChanges({ status: 'unreadable' }, current);

    assert.equal(summary.isInitialRun, false);
    assert.equal(summary.baselineStatus, 'unreadable');
    assert.ok(summary.warnings.length > 0);
  });

  it('ignores snapshots from a different repository root', () => {
    const previous = createKnowledge('/tmp/other-project');
    const current = createKnowledge('/tmp/project');
    const summary = detectChanges({ status: 'loaded', knowledge: previous }, current);

    assert.equal(summary.isInitialRun, true);
    assert.equal(summary.baselineStatus, 'repository-mismatch');
    assert.ok(summary.warnings.some((warning) => warning.includes('different repository root')));
  });

  it('reports no changed sections when PKM content is unchanged', () => {
    const previous = createKnowledge('/tmp/project', {
      modules: [createModule('src/core')],
    });
    const current = createKnowledge('/tmp/project', {
      modules: [createModule('src/core')],
    });

    const summary = detectChanges({ status: 'loaded', knowledge: previous }, current);

    assert.equal(summary.isInitialRun, false);
    assert.deepEqual(summary.changedSections, []);
  });

  it('detects added modules between runs', () => {
    const previous = createKnowledge('/tmp/project', {
      modules: [createModule('src/core')],
    });
    const current = createKnowledge('/tmp/project', {
      modules: [createModule('src/core'), createModule('src/incremental')],
    });

    const summary = detectChanges({ status: 'loaded', knowledge: previous }, current);

    assert.ok(summary.changedSections.includes('modules'));
    assert.deepEqual(summary.addedModules, ['src/incremental']);
  });

  it('detects documentation plan changes', () => {
    const previous = createKnowledge('/tmp/project');
    const current = createKnowledge('/tmp/project');
    current.documentation.plan.documents = [
      {
        title: 'README',
        relativePath: 'README.md',
        purpose: 'Overview',
        priority: 'required',
        source: 'core',
      },
    ];

    const summary = detectChanges({ status: 'loaded', knowledge: previous }, current);

    assert.ok(summary.changedSections.includes('documentation'));
  });

  it('detects generator version changes', () => {
    const previous = createKnowledge('/tmp/project');
    const current = createKnowledge('/tmp/project');
    current.metadata.generatorVersion = '0.2.0';

    const summary = detectChanges({ status: 'loaded', knowledge: previous }, current);

    assert.ok(summary.changedSections.includes('documentation'));
  });

  it('detects technology confidence-only changes', () => {
    const previous = createKnowledge('/tmp/project', { technologyConfidence: 'medium' });
    const current = createKnowledge('/tmp/project', { technologyConfidence: 'high' });

    const summary = detectChanges({ status: 'loaded', knowledge: previous }, current);

    assert.ok(summary.changedSections.includes('technologies'));
    assert.deepEqual(summary.changedTechnologies, []);
    assert.equal(summary.technologyConfidenceChanged, true);
  });

  it('detects dependency edge evidence changes without edge key changes', () => {
    const graphWithEvidence = (importPath: string): DependencyGraphKnowledge => ({
      nodes: [
        { id: 'src/core', name: 'core', type: 'core', relativePath: 'src/core' },
        { id: 'src/domain', name: 'domain', type: 'core', relativePath: 'src/domain' },
      ],
      edges: [
        {
          from: 'src/core',
          to: 'src/domain',
          type: 'imports',
          confidence: 'high',
          evidence: [{ sourceFile: 'src/core/index.ts', importPath }],
        },
      ],
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const previous = createKnowledge('/tmp/project', {
      dependencyGraph: graphWithEvidence('../domain'),
    });
    const current = createKnowledge('/tmp/project', {
      dependencyGraph: graphWithEvidence('../domain/index'),
    });

    const summary = detectChanges({ status: 'loaded', knowledge: previous }, current);

    assert.ok(summary.changedSections.includes('dependencyGraph'));
    assert.deepEqual(summary.dependencyEdgeChanges, []);
  });

  it('detects convention evidence changes', () => {
    const previous = createKnowledge('/tmp/project', {
      conventions: [createConvention('Root README', 'old evidence')],
    });
    const current = createKnowledge('/tmp/project', {
      conventions: [createConvention('Root README', 'new evidence')],
    });

    const summary = detectChanges({ status: 'loaded', knowledge: previous }, current);

    assert.ok(summary.changedSections.includes('conventions'));
  });

  it('detects staged documentation content changes and ignores timestamps', () => {
    const previous = createKnowledge('/tmp/project', {
      stagedDocumentation: {
        architecture: {
          status: 'completed',
          summary: 'Old architecture',
          content: 'Old content',
          documentPaths: ['architecture.md'],
          generatedAt: '2026-01-01T00:00:00.000Z',
          warnings: [],
        },
        execution: [
          {
            stageId: 'architecture',
            status: 'completed',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: '2026-01-01T00:00:01.000Z',
            warnings: [],
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    const sameContentNewerTimestamp = createKnowledge('/tmp/project', {
      stagedDocumentation: {
        architecture: {
          status: 'completed',
          summary: 'Old architecture',
          content: 'Old content',
          documentPaths: ['architecture.md'],
          generatedAt: '2026-01-02T00:00:00.000Z',
          warnings: [],
        },
        execution: [
          {
            stageId: 'architecture',
            status: 'completed',
            startedAt: '2026-01-02T00:00:00.000Z',
            completedAt: '2026-01-02T00:00:01.000Z',
            warnings: [],
          },
        ],
        generatedAt: '2026-01-02T00:00:00.000Z',
      },
    });
    const changedContent = createKnowledge('/tmp/project', {
      stagedDocumentation: {
        architecture: {
          status: 'completed',
          summary: 'New architecture',
          content: 'New content',
          documentPaths: ['architecture.md'],
          generatedAt: '2026-01-02T00:00:00.000Z',
          warnings: [],
        },
        execution: [
          {
            stageId: 'architecture',
            status: 'completed',
            startedAt: '2026-01-02T00:00:00.000Z',
            completedAt: '2026-01-02T00:00:01.000Z',
            warnings: [],
          },
        ],
        generatedAt: '2026-01-02T00:00:00.000Z',
      },
    });

    const unchanged = detectChanges(
      { status: 'loaded', knowledge: previous },
      sameContentNewerTimestamp,
    );
    assert.equal(unchanged.changedSections.includes('stagedDocumentation'), false);

    const changed = detectChanges({ status: 'loaded', knowledge: previous }, changedContent);
    assert.ok(changed.changedSections.includes('stagedDocumentation'));
  });
});

describe('change-summary-formatter', () => {
  it('formats module and dependency counts for changed sections', () => {
    const summary: ChangeSummaryKnowledge = {
      isInitialRun: false,
      baselineStatus: 'loaded',
      warnings: [],
      changedSections: ['modules', 'dependencyGraph'],
      addedModules: ['src/incremental', 'src/utils'],
      removedModules: [],
      changedTechnologies: [],
      technologyConfidenceChanged: false,
      addedFolders: [],
      removedFolders: [],
      dependencyEdgeChanges: [
        { from: 'src/core', to: 'src/domain', type: 'imports', change: 'added' },
      ],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    const output = formatRunSummaryChangeDetectionLines(summary).join('\n');

    assert.match(output, /Initial run: no/);
    assert.match(output, /Added modules: 2/);
    assert.match(output, /Added dependency edges: 1/);
  });

  it('reports technology confidence changes in CLI output', () => {
    const summary: ChangeSummaryKnowledge = {
      isInitialRun: false,
      baselineStatus: 'loaded',
      warnings: [],
      changedSections: ['technologies'],
      addedModules: [],
      removedModules: [],
      changedTechnologies: [],
      technologyConfidenceChanged: true,
      addedFolders: [],
      removedFolders: [],
      dependencyEdgeChanges: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    const output = formatRunSummaryChangeDetectionLines(summary).join('\n');
    assert.match(output, /Technology confidence changed/);
  });
});

describe('state-loader', () => {
  it('loads a previously persisted PKM snapshot', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'incremental-state-'));

    try {
      const knowledge = createKnowledge(tempRoot);
      persistProjectKnowledge(knowledge);

      const loaded = loadPreviousKnowledgeBaseline(tempRoot, '.ai-docs', tempRoot);
      assert.equal(loaded.status, 'loaded');
      assert.equal(loaded.knowledge?.repository.rootPath, tempRoot);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('strips changeSummary, documentImpact, and agentExports from the loaded baseline', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'incremental-state-strip-'));

    try {
      const knowledge = createKnowledge(tempRoot);
      const withRunMetadata = {
        ...knowledge,
        analysis: {
          ...knowledge.analysis,
          changeSummary: {
            isInitialRun: false,
            baselineStatus: 'loaded' as const,
            warnings: [],
            changedSections: ['modules' as const],
            addedModules: ['src/old'],
            removedModules: [],
            changedTechnologies: [],
            technologyConfidenceChanged: false,
            addedFolders: [],
            removedFolders: [],
            dependencyEdgeChanges: [],
            generatedAt: '2026-01-01T00:00:00.000Z',
          },
          documentImpact: {
            impactedDocuments: [
              {
                documentPath: 'architecture.md',
                reason: 'Modules changed',
                impactedBy: ['modules' as const],
                shouldRegenerate: true,
              },
            ],
            unchangedDocuments: ['README.md'],
            generatedAt: '2026-01-01T00:00:00.000Z',
          },
          agentExports: {
            enabled: true,
            enabledTargets: ['generic' as const],
            results: [],
            generatedAt: '2026-01-01T00:00:00.000Z',
            warnings: [],
          },
        },
      };

      persistProjectKnowledge(withRunMetadata);

      const loaded = loadPreviousKnowledgeBaseline(tempRoot, '.ai-docs', tempRoot);
      assert.equal(loaded.knowledge?.analysis.changeSummary, undefined);
      assert.equal(loaded.knowledge?.analysis.documentImpact, undefined);
      assert.equal(loaded.knowledge?.analysis.agentExports, undefined);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns none when no previous snapshot exists', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'incremental-state-missing-'));

    try {
      const loaded = loadPreviousKnowledgeBaseline(tempRoot, '.ai-docs', tempRoot);
      assert.equal(loaded.status, 'none');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns unreadable for invalid JSON snapshots', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'incremental-state-invalid-'));

    try {
      const filePath = resolveKnowledgeFilePath(tempRoot, '.ai-docs', KNOWLEDGE_FILE_NAMES.projectKnowledge);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, '{ invalid json', 'utf-8');

      const loaded = loadPreviousKnowledgeBaseline(tempRoot, '.ai-docs', tempRoot);
      assert.equal(loaded.status, 'unreadable');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns repository-mismatch when snapshot root path differs', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'incremental-state-mismatch-'));

    try {
      const mismatchedKnowledge = createKnowledge('/tmp/other-project');
      const filePath = resolveKnowledgeFilePath(
        tempRoot,
        '.ai-docs',
        KNOWLEDGE_FILE_NAMES.projectKnowledge,
      );
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(mismatchedKnowledge, null, 2)}\n`, 'utf-8');

      const loaded = loadPreviousKnowledgeBaseline(tempRoot, '.ai-docs', tempRoot);
      assert.equal(loaded.status, 'repository-mismatch');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
