import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { RuntimeConfig } from '../config';
import { ProjectKnowledge } from '../knowledge';
import { PipelineExecutionResult } from './pipeline-orchestrator';
import { formatRunSummary } from './run-summary';

const config: RuntimeConfig = {
  targetProjectPath: '/tmp/my-project',
  docsDir: '.ai-docs',
};

function buildKnowledge(): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'my-project',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'my-project',
      rootPath: '/tmp/my-project',
      detectedFiles: [],
      ignoredPaths: [],
      repositoryTree: {
        name: 'my-project',
        path: '/tmp/my-project',
        relativePath: '',
        type: 'directory',
        children: [],
      },
    },
    technologies: {
      languages: ['TypeScript'],
      frameworks: [],
      packageManagers: ['npm'],
      tooling: ['tsc'],
      confidence: 'high',
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
      folderContexts: new Array(24).fill(null).map((_, i) => ({
        path: `/tmp/my-project/f${i}`,
        relativePath: `f${i}`,
        name: `f${i}`,
        depth: 1,
        classification: 'source' as const,
        responsibility: 'test',
        importantFiles: [],
        childFolders: [],
        signals: [],
        confidence: 'high' as const,
      })),
      modules: [],
      dependencyGraph: {
        nodes: [],
        edges: [
          {
            from: 'a',
            to: 'b',
            type: 'imports',
            evidence: [],
            confidence: 'high',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      conventions: [],
      navigationMap: { entries: [], generatedAt: '2026-01-01T00:00:00.000Z' },
    },
  };
}

function buildSuccessResult(): PipelineExecutionResult {
  return {
    success: true,
    steps: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    errors: [],
    projectKnowledge: buildKnowledge(),
    scanStats: {
      filesScanned: 132,
      directoriesScanned: 20,
      maxDepthReached: false,
      limitReached: false,
      permissionDenied: false,
      symlinksSkipped: 0,
    },
    documentationWriteResult: {
      writtenCount: 10,
      skippedCount: 1,
      pkmPoweredCount: 7,
      genericCount: 3,
      docsDirectoryPath: '.ai-docs',
      writtenPaths: [],
      skippedPaths: ['README.md'],
    },
    validationResult: {
      status: 'passed',
      documentsChecked: 11,
      errors: [],
      warnings: [{ documentPath: 'README.md', message: 'user-managed document' }],
    },
  };
}

test('formatRunSummary reports all MVP summary sections on success', () => {
  const summary = formatRunSummary(config, buildSuccessResult());

  assert.ok(summary.startsWith('AI Project Docs completed'));
  assert.ok(summary.includes('Project: my-project'));
  assert.ok(summary.includes('Target: /tmp/my-project'));
  assert.ok(summary.includes('Docs: .ai-docs'));
  assert.ok(summary.includes('Technologies: TypeScript, npm, tsc'));
  assert.ok(summary.includes('- Repository tree: generated'));
  assert.ok(summary.includes('- Files scanned: 132'));
  assert.ok(summary.includes('- Folders analyzed: 24'));
  assert.ok(summary.includes('- Modules discovered: 0'));
  assert.ok(summary.includes('- Dependency edges: 1'));
  assert.ok(summary.includes('- Conventions detected: 0'));
  assert.ok(summary.includes('- Navigation entries: 0'));
  assert.ok(summary.includes('- Written: 10'));
  assert.ok(summary.includes('- Skipped: 1'));
  assert.ok(summary.includes('- Errors: 0'));
  assert.ok(summary.includes('- Warnings: 1'));
  assert.ok(summary.includes('- Status: passed'));
  assert.ok(summary.includes('Next steps:'));
  assert.ok(summary.includes('- Review .ai-docs/README.md'));
  assert.ok(summary.includes('- Share .ai-docs/agent-navigation.md with your AI coding agent'));
});

test('formatRunSummary reports failures and omits next steps', () => {
  const result: PipelineExecutionResult = {
    success: false,
    steps: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    errors: [{ stepName: 'Scan Repository Structure', message: 'boom' }],
  };

  const summary = formatRunSummary(config, result);

  assert.ok(summary.startsWith('AI Project Docs completed with errors'));
  assert.ok(summary.includes('Project: my-project'));
  assert.ok(summary.includes('- Repository tree: missing'));
  assert.ok(summary.includes('- Status: not run'));
  assert.ok(summary.includes('Errors:'));
  assert.ok(summary.includes('- Scan Repository Structure: boom'));
  assert.ok(!summary.includes('Next steps:'));
});
