import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeDocumentation } from '../docs/documentation-writer';
import { GENERATED_FILE_MARKER } from '../docs/document-template';
import { persistProjectKnowledge } from '../knowledge/knowledge-writer';
import {
  FolderKnowledge,
  ModuleKnowledge,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { validateDocumentation } from './documentation-validator';
import { validateKnowledge } from './knowledge-validator';
import { buildValidationResult } from './validation-result';
import { validateGeneratedOutputs } from './index';

const PLANNED_PATHS = [
  'README.md',
  'architecture.md',
  'folder-structure.md',
  'dependency-map.md',
  'conventions.md',
  'agent-navigation.md',
  'ai-context.md',
  'implementation-guide.md',
  'AGENTS.md',
  'change-log.md',
];

function createFolderContext(relativePath: string): FolderKnowledge {
  return {
    path: relativePath,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
    depth: relativePath.split('/').length,
    classification: 'source',
    responsibility: 'test folder',
    importantFiles: [],
    childFolders: [],
    signals: [],
    confidence: 'high',
  };
}

function createModule(relativePath: string): ModuleKnowledge {
  return {
    path: relativePath,
    relativePath,
    name: relativePath.split('/').pop() ?? relativePath,
    type: 'core',
    responsibility: 'test module',
    importantFiles: [],
    relatedFolders: [relativePath],
    signals: [],
    confidence: 'high',
  };
}

function buildKnowledge(rootPath: string): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'validation-fixture',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'validation-fixture',
      rootPath,
      detectedFiles: ['package.json'],
      ignoredPaths: ['node_modules'],
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
        documents: PLANNED_PATHS.map((relativePath) => ({
          title: `Test ${relativePath}`,
          relativePath,
          purpose: 'Test purpose',
          priority: 'required',
          source: 'core',
        })),
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'partial',
      folderContexts: [
        createFolderContext('src'),
        createFolderContext('src/core'),
        createFolderContext('src/knowledge'),
      ],
      modules: [createModule('src/core'), createModule('src/knowledge')],
      dependencyGraph: {
        nodes: [
          { id: 'src/core', name: 'core', type: 'core', relativePath: 'src/core' },
          { id: 'src/knowledge', name: 'knowledge', type: 'core', relativePath: 'src/knowledge' },
        ],
        edges: [
          {
            from: 'src/core',
            to: 'src/knowledge',
            type: 'imports',
            evidence: [{ sourceFile: 'src/core/index.ts', importPath: '../knowledge' }],
            confidence: 'high',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      conventions: [
        {
          category: 'language',
          name: 'TypeScript strict mode',
          description: 'Strict TypeScript settings.',
          evidence: [{ type: 'config', source: 'tsconfig.json', detail: 'strict enabled' }],
          confidence: 'high',
        },
      ],
      navigationMap: {
        entries: [
          {
            taskType: 'architecture-change',
            description: 'test entry',
            recommendedKnowledge: ['modules'],
            recommendedDocuments: ['architecture.md'],
            relatedModules: ['src/core'],
            relatedFolders: ['src'],
            warnings: [],
            confidence: 'high',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  };
}

function createGeneratedProject(): ProjectKnowledge {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-test-'));
  const knowledge = buildKnowledge(rootPath);
  writeDocumentation(knowledge);
  persistProjectKnowledge(knowledge);
  return knowledge;
}

function issueCodes(issues: ReadonlyArray<{ code: string }>): string[] {
  return issues.map((issue) => issue.code);
}

describe('validation-result', () => {
  it('fails only when error issues exist', () => {
    const warningOnly = buildValidationResult([
      { severity: 'warning', code: 'w', message: 'warning' },
      { severity: 'info', code: 'i', message: 'info' },
    ]);
    assert.equal(warningOnly.success, true);
    assert.equal(warningOnly.summary.warnings, 1);
    assert.equal(warningOnly.summary.info, 1);
    assert.equal(warningOnly.summary.errors, 0);
    assert.equal(warningOnly.summary.totalIssues, 2);

    const withError = buildValidationResult([
      { severity: 'error', code: 'e', message: 'error' },
    ]);
    assert.equal(withError.success, false);
    assert.equal(withError.summary.errors, 1);
  });
});

describe('knowledge-validator', () => {
  it('passes on a fully generated project', () => {
    const knowledge = createGeneratedProject();
    const issues = validateKnowledge(knowledge);

    assert.equal(issues.filter((issue) => issue.severity === 'error').length, 0);
    assert.equal(issues.filter((issue) => issue.severity === 'warning').length, 0);
    assert.ok(issueCodes(issues).includes('analysis-status-incomplete'));
  });

  it('reports missing persisted knowledge files as errors', () => {
    const knowledge = createGeneratedProject();
    fs.unlinkSync(path.join(knowledge.repository.rootPath, '.ai-docs/knowledge/analysis.json'));

    const issues = validateKnowledge(knowledge);
    const missing = issues.filter((issue) => issue.code === 'knowledge-file-missing');
    assert.equal(missing.length, 1);
    assert.equal(missing[0].severity, 'error');
    assert.equal(missing[0].path, '.ai-docs/knowledge/analysis.json');
  });

  it('reports an unparseable snapshot as an error', () => {
    const knowledge = createGeneratedProject();
    fs.writeFileSync(
      path.join(knowledge.repository.rootPath, '.ai-docs/knowledge/project-knowledge.json'),
      'not json',
      'utf-8',
    );

    const issues = validateKnowledge(knowledge);
    assert.ok(issueCodes(issues).includes('knowledge-snapshot-unparseable'));
  });

  it('warns when analysis sections are missing', () => {
    const knowledge = createGeneratedProject();
    const withoutAnalysis: ProjectKnowledge = {
      ...knowledge,
      analysis: { status: 'pending' },
    };

    const issues = validateKnowledge(withoutAnalysis);
    const missingSections = issues.filter((issue) => issue.code === 'analysis-section-missing');
    assert.equal(missingSections.length, 5);
    assert.ok(missingSections.every((issue) => issue.severity === 'warning'));
  });

  it('warns when dependency graph nodes do not match modules', () => {
    const knowledge = createGeneratedProject();
    const withUnknownNode: ProjectKnowledge = {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        dependencyGraph: {
          nodes: [{ id: 'src/ghost', name: 'ghost', type: 'core', relativePath: 'src/ghost' }],
          edges: [],
          generatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    };

    const issues = validateKnowledge(withUnknownNode);
    assert.ok(issueCodes(issues).includes('dependency-node-unknown-module'));
  });

  it('rejects folder contexts with invalid relative paths', () => {
    const knowledge = createGeneratedProject();
    const withInvalidFolder: ProjectKnowledge = {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        folderContexts: [
          ...(knowledge.analysis.folderContexts ?? []),
          createFolderContext('../outside'),
        ],
      },
    };

    const issues = validateKnowledge(withInvalidFolder);
    const invalid = issues.filter((issue) => issue.code === 'folder-path-invalid');
    assert.equal(invalid.length, 1);
    assert.equal(invalid[0].severity, 'error');
  });

  it('warns when module paths are unknown to folder knowledge and tree', () => {
    const knowledge = createGeneratedProject();
    const withUnknownModule: ProjectKnowledge = {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        modules: [...(knowledge.analysis.modules ?? []), createModule('src/phantom')],
      },
    };

    const issues = validateKnowledge(withUnknownModule);
    assert.ok(issueCodes(issues).includes('module-path-unknown'));
  });
});

describe('documentation-validator', () => {
  it('passes on a fully generated project', () => {
    const knowledge = createGeneratedProject();
    const issues = validateDocumentation(knowledge);

    assert.equal(issues.filter((issue) => issue.severity === 'error').length, 0);
    assert.equal(issues.filter((issue) => issue.severity === 'warning').length, 0);
  });

  it('reports a missing docs directory as an error', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-test-'));
    const knowledge = buildKnowledge(rootPath);

    const issues = validateDocumentation(knowledge);
    assert.deepEqual(issueCodes(issues), ['docs-directory-missing']);
    assert.equal(issues[0].severity, 'error');
  });

  it('reports a missing required document as an error', () => {
    const knowledge = createGeneratedProject();
    fs.unlinkSync(path.join(knowledge.repository.rootPath, '.ai-docs/architecture.md'));

    const issues = validateDocumentation(knowledge);
    const missing = issues.filter((issue) => issue.code === 'required-document-missing');
    assert.equal(missing.length, 1);
    assert.equal(missing[0].severity, 'error');
  });

  it('reports an empty key document as an error and an empty generic document as a warning', () => {
    const knowledge = createGeneratedProject();
    const docsPath = path.join(knowledge.repository.rootPath, '.ai-docs');
    fs.writeFileSync(path.join(docsPath, 'conventions.md'), `${GENERATED_FILE_MARKER}\n\n`, 'utf-8');
    fs.writeFileSync(path.join(docsPath, 'change-log.md'), `${GENERATED_FILE_MARKER}\n\n`, 'utf-8');

    const issues = validateDocumentation(knowledge);
    const empty = issues.filter((issue) => issue.code === 'document-empty');
    assert.equal(empty.length, 2);
    assert.equal(empty.find((issue) => issue.path?.endsWith('conventions.md'))?.severity, 'error');
    assert.equal(empty.find((issue) => issue.path?.endsWith('change-log.md'))?.severity, 'warning');
  });

  it('treats unmarked documents as user-managed info, not errors', () => {
    const knowledge = createGeneratedProject();
    fs.writeFileSync(
      path.join(knowledge.repository.rootPath, '.ai-docs/change-log.md'),
      '# Hand-written notes\n',
      'utf-8',
    );

    const issues = validateDocumentation(knowledge, { skippedDocumentPaths: ['change-log.md'] });
    const userManaged = issues.filter((issue) => issue.code === 'document-user-managed');
    assert.equal(userManaged.length, 1);
    assert.equal(userManaged[0].severity, 'info');
    assert.ok(userManaged[0].message.includes('intentionally skipped'));
  });

  it('warns when the navigation map recommends unplanned documents', () => {
    const knowledge = createGeneratedProject();
    const withUnplannedReference: ProjectKnowledge = {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        navigationMap: {
          entries: [
            {
              taskType: 'bug-fix',
              description: 'test entry',
              recommendedKnowledge: ['modules'],
              recommendedDocuments: ['ghost-document.md'],
              relatedModules: [],
              relatedFolders: [],
              warnings: [],
              confidence: 'high',
            },
          ],
          generatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    };

    const issues = validateDocumentation(withUnplannedReference);
    const unplanned = issues.filter((issue) => issue.code === 'navigation-document-unplanned');
    assert.equal(unplanned.length, 1);
    assert.equal(unplanned[0].severity, 'warning');
    assert.ok(unplanned[0].message.includes('ghost-document.md'));
  });
});

describe('validateGeneratedOutputs', () => {
  it('combines knowledge and documentation issues into one result', () => {
    const knowledge = createGeneratedProject();
    const result = validateGeneratedOutputs(knowledge);

    assert.equal(result.success, true);
    assert.equal(result.summary.errors, 0);
    assert.equal(result.summary.warnings, 0);
    assert.ok(result.summary.info >= 1);
    assert.ok(result.summary.checkedAt.length > 0);
  });

  it('fails when any error issue exists', () => {
    const knowledge = createGeneratedProject();
    fs.unlinkSync(path.join(knowledge.repository.rootPath, '.ai-docs/knowledge/repository.json'));

    const result = validateGeneratedOutputs(knowledge);
    assert.equal(result.success, false);
    assert.equal(result.summary.errors, 1);
  });
});
