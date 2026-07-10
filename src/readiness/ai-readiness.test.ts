import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { RepositoryNode } from '../domain';
import { PlannedDocument } from '../domain/documentation-plan';
import { DocumentationValidationResult } from '../docs/documentation-validator';
import { validateAiReadiness } from '../docs/documentation-validator';
import { ProjectKnowledge } from '../knowledge';
import {
  AIReadinessFinding,
  AIReadinessKnowledge,
  clampReadinessScore,
  resolveReadinessLevel,
  roundReadinessScore,
} from './ai-readiness-model';
import {
  calculateAiReadiness,
  enrichProjectKnowledgeWithAiReadiness,
} from './ai-readiness-calculator';
import {
  READINESS_CATEGORY_RULES,
  deriveRepositorySignals,
  totalCategoryWeight,
} from './ai-readiness-rules';

const GENERATED_AT = '2026-01-01T00:00:00.000Z';

function fileNode(relativePath: string): RepositoryNode {
  return {
    name: path.posix.basename(relativePath),
    path: `/repo/${relativePath}`,
    relativePath,
    type: 'file',
    extension: path.posix.extname(relativePath),
  };
}

function directoryNode(relativePath: string, children: RepositoryNode[]): RepositoryNode {
  return {
    name: relativePath === '' ? 'repo' : path.posix.basename(relativePath),
    path: relativePath === '' ? '/repo' : `/repo/${relativePath}`,
    relativePath,
    type: 'directory',
    children,
  };
}

function plannedDocument(relativePath: string): PlannedDocument {
  return {
    title: relativePath,
    relativePath,
    purpose: 'Test purpose',
    priority: 'required',
    source: 'core',
  };
}

const REQUIRED_DOCUMENT_PATHS = [
  'README.md',
  'architecture.md',
  'folder-structure.md',
  'dependency-map.md',
  'conventions.md',
  'agent-navigation.md',
  'ai-context.md',
  'implementation-guide.md',
  'ai-readiness.md',
];

function passedValidation(): DocumentationValidationResult {
  return { errorCount: 0, warningCount: 0, status: 'passed', issues: [] };
}

function buildRichTree(): RepositoryNode {
  const sourceFiles = Array.from({ length: 12 }, (_, index) =>
    fileNode(`src/features/feature-${index}.ts`),
  );
  return directoryNode('', [
    fileNode('package.json'),
    fileNode('tsconfig.json'),
    directoryNode('src', [
      directoryNode('src/features', sourceFiles),
      directoryNode('src/core', [
        fileNode('src/core/engine.ts'),
        fileNode('src/core/engine.test.ts'),
      ]),
    ]),
  ]);
}

function buildRichKnowledge(rootPath = '/repo'): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: GENERATED_AT,
      generatorVersion: '0.1.0',
      projectName: 'rich-project',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'rich-project',
      rootPath,
      packageManager: 'npm',
      detectedFiles: ['package.json', 'tsconfig.json'],
      ignoredPaths: ['node_modules', 'dist'],
      repositoryTree: buildRichTree(),
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
        documents: REQUIRED_DOCUMENT_PATHS.map(plannedDocument),
        generatedAt: GENERATED_AT,
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'complete',
      folderContexts: [
        {
          path: `${rootPath}/src`,
          relativePath: 'src',
          name: 'src',
          depth: 1,
          classification: 'source',
          responsibility: 'Application source code',
          importantFiles: [],
          childFolders: ['src/features', 'src/core'],
          signals: [],
          confidence: 'high',
        },
        {
          path: `${rootPath}/src/features`,
          relativePath: 'src/features',
          name: 'features',
          depth: 2,
          classification: 'source',
          responsibility: 'Feature modules',
          importantFiles: [],
          childFolders: [],
          signals: [],
          confidence: 'high',
        },
        {
          path: `${rootPath}/src/core`,
          relativePath: 'src/core',
          name: 'core',
          depth: 2,
          classification: 'source',
          responsibility: 'Core engine',
          importantFiles: [],
          childFolders: [],
          signals: [],
          confidence: 'high',
        },
      ],
      modules: [
        {
          name: 'features',
          path: `${rootPath}/src/features`,
          relativePath: 'src/features',
          type: 'feature',
          responsibility: 'Feature modules',
          importantFiles: [],
          relatedFolders: ['src/features'],
          signals: [],
          confidence: 'high',
        },
        {
          name: 'core',
          path: `${rootPath}/src/core`,
          relativePath: 'src/core',
          type: 'core',
          responsibility: 'Core engine',
          importantFiles: [],
          relatedFolders: ['src/core'],
          signals: [],
          confidence: 'high',
        },
      ],
      dependencyGraph: {
        nodes: [
          { id: 'features', name: 'features', type: 'feature', relativePath: 'src/features' },
          { id: 'core', name: 'core', type: 'core', relativePath: 'src/core' },
        ],
        edges: [
          {
            from: 'features',
            to: 'core',
            type: 'imports',
            evidence: [{ sourceFile: 'src/features/feature-0.ts', importPath: '../core/engine' }],
            confidence: 'high',
          },
        ],
        generatedAt: GENERATED_AT,
      },
      conventions: [
        {
          category: 'architecture',
          name: 'src/core orchestrates the pipeline',
          description: 'Core owns orchestration.',
          evidence: [{ type: 'folder', source: 'src/core', detail: 'core folder present' }],
          confidence: 'high',
        },
        {
          category: 'language',
          name: 'TypeScript strict mode',
          description: 'strict mode enabled.',
          evidence: [{ type: 'config', source: 'tsconfig.json', detail: 'strict true' }],
          confidence: 'high',
        },
        {
          category: 'testing',
          name: 'Co-located node:test suites',
          description: 'Tests live next to sources.',
          evidence: [{ type: 'file', source: 'src/core/engine.test.ts', detail: 'test file' }],
          confidence: 'high',
        },
        {
          category: 'package-management',
          name: 'npm with package-lock',
          description: 'npm is the package manager.',
          evidence: [{ type: 'file', source: 'package.json', detail: 'package.json present' }],
          confidence: 'high',
        },
        {
          category: 'generated-context',
          name: 'Generated docs under .ai-docs',
          description: 'Generated context lives in .ai-docs.',
          evidence: [{ type: 'folder', source: '.ai-docs', detail: 'docs dir' }],
          confidence: 'high',
        },
      ],
      navigationMap: {
        entries: [
          'new-feature',
          'bug-fix',
          'architecture-change',
          'test-change',
          'config-change',
          'dependency-change',
        ].map((taskType) => ({
          taskType: taskType as never,
          description: `${taskType} guidance`,
          recommendedKnowledge: ['modules' as const],
          recommendedDocuments: ['architecture.md'],
          relatedModules: ['core'],
          relatedFolders: ['src/core'],
          warnings: ['Respect module boundaries'],
          confidence: 'high' as const,
        })),
        generatedAt: GENERATED_AT,
      },
      changeSummary: {
        isInitialRun: false,
        baselineStatus: 'loaded',
        warnings: [],
        changedSections: [],
        addedModules: [],
        removedModules: [],
        changedTechnologies: [],
        technologyConfidenceChanged: false,
        addedFolders: [],
        removedFolders: [],
        dependencyEdgeChanges: [],
        generatedAt: GENERATED_AT,
      },
      documentImpact: {
        impactedDocuments: [],
        unchangedDocuments: REQUIRED_DOCUMENT_PATHS,
        generatedAt: GENERATED_AT,
      },
    },
  };
}

function buildTinyKnowledge(): ProjectKnowledge {
  const knowledge = buildRichKnowledge();
  return {
    ...knowledge,
    repository: {
      ...knowledge.repository,
      ignoredPaths: [],
      repositoryTree: directoryNode('', [
        fileNode('package.json'),
        directoryNode('src', [fileNode('src/index.ts')]),
      ]),
    },
    analysis: {
      status: 'partial',
      folderContexts: [
        {
          path: '/repo/src',
          relativePath: 'src',
          name: 'src',
          depth: 1,
          classification: 'source',
          responsibility: 'Application source code',
          importantFiles: [],
          childFolders: [],
          signals: [],
          confidence: 'medium',
        },
      ],
      changeSummary: {
        isInitialRun: true,
        baselineStatus: 'none',
        warnings: [],
        changedSections: [],
        addedModules: [],
        removedModules: [],
        changedTechnologies: [],
        technologyConfidenceChanged: false,
        addedFolders: [],
        removedFolders: [],
        dependencyEdgeChanges: [],
        generatedAt: GENERATED_AT,
      },
      documentImpact: {
        impactedDocuments: [],
        unchangedDocuments: [],
        generatedAt: GENERATED_AT,
      },
    },
  };
}

function findFinding(readiness: AIReadinessKnowledge, findingId: string): AIReadinessFinding {
  for (const category of readiness.categories) {
    const finding = category.findings.find((entry) => entry.id === findingId);
    if (finding) {
      return finding;
    }
  }
  throw new Error(`finding ${findingId} not found`);
}

describe('readiness level boundaries', () => {
  it('maps scores to levels exactly at the documented boundaries', () => {
    assert.equal(resolveReadinessLevel(0), 'critical');
    assert.equal(resolveReadinessLevel(29), 'critical');
    assert.equal(resolveReadinessLevel(30), 'low');
    assert.equal(resolveReadinessLevel(49), 'low');
    assert.equal(resolveReadinessLevel(50), 'moderate');
    assert.equal(resolveReadinessLevel(69), 'moderate');
    assert.equal(resolveReadinessLevel(70), 'good');
    assert.equal(resolveReadinessLevel(84), 'good');
    assert.equal(resolveReadinessLevel(85), 'excellent');
    assert.equal(resolveReadinessLevel(100), 'excellent');
  });
});

describe('score clamping', () => {
  it('clamps out-of-range and non-finite values into 0-100', () => {
    assert.equal(clampReadinessScore(-5), 0);
    assert.equal(clampReadinessScore(150), 100);
    assert.equal(clampReadinessScore(Number.NaN), 0);
    assert.equal(roundReadinessScore(84.5), 85);
    assert.equal(roundReadinessScore(101), 100);
    assert.equal(roundReadinessScore(-1), 0);
  });
});

describe('category weights', () => {
  it('total exactly 100 percent', () => {
    assert.equal(totalCategoryWeight(), 100);
  });

  it('cover the six required categories', () => {
    assert.deepEqual(
      READINESS_CATEGORY_RULES.map((rule) => rule.id),
      [
        'repository-structure',
        'architecture-knowledge',
        'documentation-coverage',
        'agent-navigation',
        'project-conventions',
        'context-maintainability',
      ],
    );
  });
});

describe('calculateAiReadiness', () => {
  it('computes the overall score as the weighted average of category scores', () => {
    const readiness = calculateAiReadiness({
      knowledge: buildRichKnowledge(),
      validation: passedValidation(),
    });

    const weightTotal = readiness.categories.reduce((sum, c) => sum + c.weight, 0);
    const expected = Math.round(
      readiness.categories.reduce((sum, c) => sum + c.score * c.weight, 0) / weightTotal,
    );

    assert.equal(weightTotal, 100);
    assert.equal(readiness.overallScore, expected);
    assert.equal(readiness.level, resolveReadinessLevel(readiness.overallScore));
  });

  it('scores a fully analyzed repository as excellent with no gaps', () => {
    const readiness = calculateAiReadiness({
      knowledge: buildRichKnowledge(),
      validation: passedValidation(),
    });

    assert.equal(readiness.overallScore, 100);
    assert.equal(readiness.level, 'excellent');
    assert.equal(readiness.gaps.length, 0);
    assert.equal(readiness.recommendations.length, 0);
    assert.ok(readiness.strengths.length > 0);
  });

  it('excludes not-applicable findings from category scores', () => {
    const readiness = calculateAiReadiness({
      knowledge: buildTinyKnowledge(),
      validation: passedValidation(),
    });

    const modulesFinding = findFinding(readiness, 'modules-discovered');
    assert.equal(modulesFinding.status, 'not-applicable');
    assert.equal(modulesFinding.points, 0);

    const structure = readiness.categories.find((c) => c.id === 'repository-structure');
    assert.ok(structure);
    // Applicable structure findings all pass in the tiny fixture, so the
    // not-applicable module finding must not drag the score below 100.
    assert.equal(structure.score, 100);
  });

  it('does not unfairly penalize tiny repositories for missing modules and edges', () => {
    const knowledge = buildTinyKnowledge();
    const signals = deriveRepositorySignals(knowledge);
    assert.equal(signals.isTinyRepository, true);

    const readiness = calculateAiReadiness({ knowledge, validation: passedValidation() });

    assert.equal(findFinding(readiness, 'modules-defined').status, 'not-applicable');
    assert.equal(findFinding(readiness, 'dependency-graph-generated').status, 'not-applicable');
    assert.equal(
      findFinding(readiness, 'dependency-edges-evidence-backed').status,
      'not-applicable',
    );
    assert.ok(readiness.overallScore >= 50);
  });

  it('does not penalize the initial run for having no previous incremental state', () => {
    const readiness = calculateAiReadiness({
      knowledge: buildTinyKnowledge(),
      validation: passedValidation(),
    });

    const persistence = findFinding(readiness, 'pkm-persisted');
    assert.equal(persistence.status, 'passed');
    assert.equal(persistence.points, persistence.maxPoints);
  });

  it('derives recommendations only from partial or failed findings', () => {
    const knowledge = buildRichKnowledge();
    // Remove the strict-mode convention and dependency evidence to open gaps.
    knowledge.analysis.conventions = (knowledge.analysis.conventions ?? []).filter(
      (convention) => convention.name !== 'TypeScript strict mode',
    );
    knowledge.analysis.dependencyGraph = {
      ...(knowledge.analysis.dependencyGraph ?? { nodes: [], edges: [], generatedAt: GENERATED_AT }),
      edges: [
        {
          from: 'features',
          to: 'core',
          type: 'imports',
          evidence: [],
          confidence: 'low',
        },
      ],
    };

    const readiness = calculateAiReadiness({ knowledge, validation: passedValidation() });

    assert.ok(readiness.gaps.length > 0);
    assert.ok(readiness.recommendations.length > 0);

    const actionableIds = new Set(
      readiness.categories
        .flatMap((category) => category.findings)
        .filter((finding) => finding.status === 'failed' || finding.status === 'partial')
        .map((finding) => finding.id),
    );
    for (const recommendation of readiness.recommendations) {
      assert.ok(actionableIds.has(recommendation.findingId));
    }

    assert.ok(
      readiness.recommendations.some((recommendation) =>
        recommendation.action.includes('TypeScript strict mode'),
      ),
    );
    // Recommendations are ordered by impact, highest first.
    for (let i = 1; i < readiness.recommendations.length; i++) {
      assert.ok(readiness.recommendations[i - 1].impact >= readiness.recommendations[i].impact);
    }
  });

  it('reduces documentation and maintainability scores on validation errors', () => {
    const knowledge = buildRichKnowledge();
    const failedValidation: DocumentationValidationResult = {
      errorCount: 2,
      warningCount: 0,
      status: 'failed',
      issues: [
        { severity: 'error', message: 'planned document was not written', relativePath: 'conventions.md' },
        { severity: 'error', message: 'document is missing the generated-file marker', relativePath: 'ai-context.md' },
      ],
    };

    const clean = calculateAiReadiness({ knowledge, validation: passedValidation() });
    const dirty = calculateAiReadiness({ knowledge, validation: failedValidation });

    const cleanDocs = clean.categories.find((c) => c.id === 'documentation-coverage');
    const dirtyDocs = dirty.categories.find((c) => c.id === 'documentation-coverage');
    const cleanMaintainability = clean.categories.find((c) => c.id === 'context-maintainability');
    const dirtyMaintainability = dirty.categories.find((c) => c.id === 'context-maintainability');

    assert.ok(cleanDocs && dirtyDocs && cleanMaintainability && dirtyMaintainability);
    assert.ok(dirtyDocs.score < cleanDocs.score);
    assert.ok(dirtyMaintainability.score < cleanMaintainability.score);
  });

  it('produces deterministic output for identical PKM input', () => {
    const first = calculateAiReadiness({
      knowledge: buildRichKnowledge(),
      validation: passedValidation(),
    });
    const second = calculateAiReadiness({
      knowledge: buildRichKnowledge(),
      validation: passedValidation(),
    });

    assert.deepEqual(first, second);
    assert.equal(first.calculatedAt, GENERATED_AT);
    assert.equal(first.scoringVersion, second.scoringVersion);
  });

  it('keeps every score inside the 0-100 range', () => {
    for (const knowledge of [buildRichKnowledge(), buildTinyKnowledge()]) {
      const readiness = calculateAiReadiness({ knowledge });
      assert.ok(readiness.overallScore >= 0 && readiness.overallScore <= 100);
      for (const category of readiness.categories) {
        assert.ok(category.score >= 0 && category.score <= 100);
      }
    }
  });
});

describe('validateAiReadiness', () => {
  function withReadinessOnDisk(knowledge: ProjectKnowledge): ProjectKnowledge {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-readiness-validate-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(path.join(docsPath, 'knowledge'), { recursive: true });
    fs.writeFileSync(path.join(docsPath, 'knowledge', 'ai-readiness.json'), '{}', 'utf-8');
    fs.writeFileSync(path.join(docsPath, 'ai-readiness.md'), '# AI Readiness', 'utf-8');

    return {
      ...knowledge,
      repository: { ...knowledge.repository, rootPath },
    };
  }

  it('accepts a valid low-score result without errors', () => {
    const base = withReadinessOnDisk(buildTinyKnowledge());
    const { knowledge, readiness } = enrichProjectKnowledgeWithAiReadiness(base);

    assert.ok(readiness.overallScore <= 100);
    const issues = validateAiReadiness(knowledge);
    assert.deepEqual(issues, []);
  });

  it('reports errors for invalid score structures', () => {
    const base = withReadinessOnDisk(buildRichKnowledge());
    const { knowledge } = enrichProjectKnowledgeWithAiReadiness(base, passedValidation());
    const readiness = knowledge.analysis.aiReadiness;
    assert.ok(readiness);

    readiness.overallScore = 140;
    readiness.categories[0].score = -3;
    readiness.categories[1].weight += 10;
    readiness.recommendations.push({
      action: 'Unsupported generic advice',
      findingId: 'nonexistent-finding',
      categoryId: 'repository-structure',
      impact: 1,
    });

    const messages = validateAiReadiness(knowledge).map((issue) => issue.message);
    assert.ok(messages.some((message) => message.includes('outside the 0-100 range')));
    assert.ok(messages.some((message) => message.includes('invalid score')));
    assert.ok(messages.some((message) => message.includes('weights total')));
    assert.ok(messages.some((message) => message.includes('does not correspond')));
  });

  it('reports missing aiReadiness knowledge and missing persisted files', () => {
    const knowledge = buildRichKnowledge(
      fs.mkdtempSync(path.join(os.tmpdir(), 'ai-readiness-missing-')),
    );

    const missingKnowledgeIssues = validateAiReadiness(knowledge);
    assert.equal(missingKnowledgeIssues.length, 1);
    assert.ok(missingKnowledgeIssues[0].message.includes('aiReadiness is missing'));

    const { knowledge: enriched } = enrichProjectKnowledgeWithAiReadiness(
      knowledge,
      passedValidation(),
    );
    const messages = validateAiReadiness(enriched).map((issue) => issue.message);
    assert.ok(messages.some((message) => message.includes('ai-readiness.json is missing')));
    assert.ok(messages.some((message) => message.includes('ai-readiness.md is planned but missing')));
  });
});
