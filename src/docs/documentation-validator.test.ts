import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { ProjectKnowledge } from '../knowledge';
import { PlannedDocument } from '../domain/documentation-plan';
import { GENERATED_FILE_MARKER } from './document-template';
import { validateDocumentation } from './documentation-validator';
import { DocumentationWriteResult } from './documentation-writer';

function buildPlannedDocument(relativePath: string): PlannedDocument {
  return {
    title: relativePath,
    relativePath,
    purpose: 'Test purpose',
    priority: 'required',
    source: 'core',
  };
}

function buildKnowledge(rootPath: string, documents: PlannedDocument[]): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'sample-project',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'sample-project',
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
        documents,
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'partial',
    },
  };
}

function buildWriteResult(
  writtenPaths: string[],
  skippedProtectedPaths: string[] = [],
  skippedUnchangedPaths: string[] = [],
): DocumentationWriteResult {
  const skippedPaths = [...skippedUnchangedPaths, ...skippedProtectedPaths];

  return {
    writtenCount: writtenPaths.length,
    skippedCount: skippedPaths.length,
    skippedUnchangedCount: skippedUnchangedPaths.length,
    skippedProtectedCount: skippedProtectedPaths.length,
    pkmPoweredCount: writtenPaths.length,
    genericCount: 0,
    docsDirectoryPath: '.ai-docs',
    writtenPaths,
    skippedPaths,
    skippedUnchangedPaths,
    skippedProtectedPaths,
  };
}

describe('validateDocumentation', () => {
  it('passes when written documents are present and marked', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });
    fs.writeFileSync(
      path.join(docsPath, 'README.md'),
      `${GENERATED_FILE_MARKER}\n\n# Sample`,
      'utf-8',
    );

    const knowledge = buildKnowledge(rootPath, [buildPlannedDocument('README.md')]);
    const result = validateDocumentation(knowledge, buildWriteResult(['README.md']));

    assert.equal(result.status, 'passed');
    assert.equal(result.errorCount, 0);
    assert.equal(result.warningCount, 0);
  });

  it('reports a consolidated warning for preserved user files', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });
    fs.writeFileSync(
      path.join(docsPath, 'README.md'),
      `${GENERATED_FILE_MARKER}\n\n# Sample`,
      'utf-8',
    );

    const knowledge = buildKnowledge(rootPath, [
      buildPlannedDocument('README.md'),
      buildPlannedDocument('AGENTS.md'),
    ]);

    const result = validateDocumentation(
      knowledge,
      buildWriteResult(['README.md'], ['AGENTS.md']),
    );

    assert.equal(result.status, 'passed');
    assert.equal(result.warningCount, 1);
    assert.match(result.issues[0].message, /1 user-managed document preserved/);
  });

  it('fails when a planned document was not written', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const knowledge = buildKnowledge(rootPath, [buildPlannedDocument('README.md')]);

    const result = validateDocumentation(knowledge, buildWriteResult([]));

    assert.equal(result.status, 'failed');
    assert.equal(result.errorCount, 1);
    assert.equal(result.issues[0].relativePath, 'README.md');
  });

  it('fails when the generated marker is missing', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });
    fs.writeFileSync(path.join(docsPath, 'README.md'), '# Manual README', 'utf-8');

    const knowledge = buildKnowledge(rootPath, [buildPlannedDocument('README.md')]);
    const result = validateDocumentation(knowledge, buildWriteResult(['README.md']));

    assert.equal(result.status, 'failed');
    assert.match(result.issues[0].message, /generated-file marker/);
  });

  it('warns on empty generated document bodies', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });
    fs.writeFileSync(path.join(docsPath, 'README.md'), `${GENERATED_FILE_MARKER}\n`, 'utf-8');

    const knowledge = buildKnowledge(rootPath, [buildPlannedDocument('README.md')]);
    const result = validateDocumentation(knowledge, buildWriteResult(['README.md']));

    assert.equal(result.status, 'passed');
    assert.equal(result.warningCount, 1);
    assert.match(result.issues[0].message, /empty/);
  });

  it('validates unchanged generated documents during selective regeneration', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });
    fs.writeFileSync(
      path.join(docsPath, 'README.md'),
      `${GENERATED_FILE_MARKER}\n\n# Sample`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(docsPath, 'architecture.md'),
      `${GENERATED_FILE_MARKER}\n\n# Architecture`,
      'utf-8',
    );

    const knowledge = buildKnowledge(rootPath, [
      buildPlannedDocument('README.md'),
      buildPlannedDocument('architecture.md'),
    ]);

    const result = validateDocumentation(
      knowledge,
      buildWriteResult(['README.md'], [], ['architecture.md']),
    );

    assert.equal(result.status, 'passed');
    assert.equal(result.warningCount, 0);
  });

  it('fails when write result counts disagree with path lists', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const knowledge = buildKnowledge(rootPath, [buildPlannedDocument('README.md')]);
    const writeResult = buildWriteResult(['README.md']);
    writeResult.writtenCount = 2;

    const result = validateDocumentation(knowledge, writeResult);

    assert.equal(result.status, 'failed');
    assert.match(result.issues[0].message, /inconsistent/);
  });

  it('reports missing playbook coverage when staged module plan is present', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });
    fs.writeFileSync(
      path.join(docsPath, 'README.md'),
      `${GENERATED_FILE_MARKER}\n\n# Sample`,
      'utf-8',
    );

    const knowledge = buildKnowledge(rootPath, [buildPlannedDocument('README.md')]);
    knowledge.analysis.modules = [
      {
        path: 'src/core',
        relativePath: 'src/core',
        name: 'core',
        type: 'core',
        responsibility: 'orchestration',
        importantFiles: [],
        relatedFolders: [],
        signals: [],
        confidence: 'high',
      },
    ];
    knowledge.analysis.stagedDocumentation = {
      modulePlan: {
        status: 'completed',
        entries: [
          {
            moduleId: 'src/core',
            moduleName: 'core',
            moduleRelativePath: 'src/core',
            documentPath: 'code/components/src-core.md',
            order: 1,
            status: 'pending',
          },
        ],
        warnings: [],
      },
      execution: [],
    };

    const result = validateDocumentation(knowledge, buildWriteResult(['README.md']));

    assert.equal(result.status, 'failed');
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.severity === 'error' &&
          issue.relativePath === 'module-documentation-plan.md' &&
          /missing from documentation plan/.test(issue.message),
      ),
    );
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.severity === 'error' &&
          issue.relativePath === 'code/components/src-core.md' &&
          /missing from the documentation plan/.test(issue.message),
      ),
    );
  });

  it('warns when moduleResults report AI failures', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-validator-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });

    const playbookPaths = [
      'AI_START_HERE.md',
      'CONTEXT_ROUTER.md',
      'DOCUMENTATION_MAINTENANCE.md',
      'DOCUMENTATION_STATUS.md',
      'PROJECT_MAP.md',
      'module-documentation-plan.md',
      'code/components/src-core.md',
    ];

    for (const relativePath of playbookPaths) {
      const absolutePath = path.join(docsPath, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `${GENERATED_FILE_MARKER}\n\n# ${relativePath}`, 'utf-8');
    }

    const knowledge = buildKnowledge(
      rootPath,
      playbookPaths.map((relativePath) => buildPlannedDocument(relativePath)),
    );
    knowledge.analysis.modules = [
      {
        path: 'src/core',
        relativePath: 'src/core',
        name: 'core',
        type: 'core',
        responsibility: 'orchestration',
        importantFiles: [],
        relatedFolders: [],
        signals: [],
        confidence: 'high',
      },
    ];
    knowledge.analysis.stagedDocumentation = {
      modulePlan: {
        status: 'completed',
        entries: [
          {
            moduleId: 'src/core',
            moduleName: 'core',
            moduleRelativePath: 'src/core',
            documentPath: 'code/components/src-core.md',
            order: 1,
            status: 'failed',
          },
        ],
        warnings: [],
      },
      moduleResults: {
        status: 'partial',
        results: [
          {
            moduleId: 'src/core',
            moduleName: 'core',
            moduleRelativePath: 'src/core',
            documentPath: 'code/components/src-core.md',
            status: 'failed',
            warnings: [],
            error: 'provider timeout',
          },
        ],
        warnings: [],
      },
      execution: [],
    };

    const result = validateDocumentation(knowledge, buildWriteResult(playbookPaths));

    assert.equal(result.status, 'passed');
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.severity === 'warning' &&
          /module documentation AI failed: provider timeout/.test(issue.message),
      ),
    );
  });
});
