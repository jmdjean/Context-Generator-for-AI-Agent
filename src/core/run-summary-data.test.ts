import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuntimeConfig } from '../config';
import { createEmptyPipelineMetrics } from './pipeline-metrics';
import { PipelineExecutionResult } from './pipeline-orchestrator';
import { buildRunSummaryData, formatRunSummary } from './run-summary';

function buildConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    targetProjectPath: '/tmp/sample-project',
    docsDir: '.ai-docs',
    enableAiAnalysis: false,
    enableModuleDocumentation: true,
    aiProvider: 'openrouter',
    enableAgentExports: false,
    exportTargets: ['generic'],
    aiModel: 'openai/gpt-4.1-mini',
    ...overrides,
  };
}

function buildResult(overrides: Partial<PipelineExecutionResult> = {}): PipelineExecutionResult {
  return {
    success: true,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.500Z',
    errors: [],
    metrics: {
      ...createEmptyPipelineMetrics(),
      filesScanned: 42,
      foldersAnalyzed: 5,
      modulesDiscovered: 3,
      dependencyEdges: 7,
      conventionsDetected: 4,
      navigationEntries: 8,
      repositoryTreeGenerated: true,
      knowledgeFilesPersisted: 6,
      documentationWrite: {
        writtenCount: 10,
        skippedCount: 1,
        skippedUnchangedCount: 0,
        skippedProtectedCount: 1,
        pkmPoweredCount: 8,
        genericCount: 2,
        docsDirectoryPath: '.ai-docs',
        writtenPaths: ['README.md'],
        skippedPaths: ['AGENTS.md'],
        skippedUnchangedPaths: [],
        skippedProtectedPaths: ['AGENTS.md'],
      },
      validation: {
        errorCount: 0,
        warningCount: 1,
        status: 'passed',
        issues: [{ severity: 'warning', message: '1 user-managed document preserved' }],
      },
    },
    steps: [
      { name: 'Scan Repository Structure', description: '', status: 'completed' },
      { name: 'Analyze Folder Knowledge', description: '', status: 'completed' },
      { name: 'Analyze Modules', description: '', status: 'completed' },
      { name: 'Analyze Dependency Graph', description: '', status: 'completed' },
      { name: 'Analyze Conventions', description: '', status: 'completed' },
      { name: 'Build AI Navigation Map', description: '', status: 'completed' },
      { name: 'Detect Changes', description: '', status: 'completed' },
      { name: 'Write Documentation', description: '', status: 'completed' },
      { name: 'Validate Documentation', description: '', status: 'completed' },
      { name: 'Persist Project Knowledge', description: '', status: 'completed' },
      { name: 'Build Repository Model', description: '', status: 'skipped' },
    ],
    projectKnowledge: {
      metadata: {
        schemaVersion: '1.0.0',
        generatedAt: '2026-01-01T00:00:00.000Z',
        generatorVersion: '0.1.0',
        projectName: 'sample-project',
        docsDir: '.ai-docs',
      },
      repository: {
        name: 'sample-project',
        rootPath: '/tmp/sample-project',
        detectedFiles: ['package.json'],
        ignoredPaths: ['node_modules'],
        repositoryTree: {
          name: 'sample-project',
          path: '/tmp/sample-project',
          relativePath: '.',
          type: 'directory',
          children: [],
        },
      },
      technologies: {
        languages: ['TypeScript'],
        frameworks: ['Node.js'],
        packageManagers: ['npm'],
        tooling: [],
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
        status: 'complete',
        changeSummary: {
          isInitialRun: false,
          baselineStatus: 'loaded',
          warnings: [],
          changedSections: ['modules'],
          addedModules: ['src/incremental'],
          removedModules: [],
          changedTechnologies: [],
          technologyConfidenceChanged: false,
          addedFolders: [],
          removedFolders: [],
          dependencyEdgeChanges: [],
          generatedAt: '2026-01-02T00:00:00.000Z',
        },
        documentImpact: {
          impactedDocuments: [
            {
              documentPath: 'architecture.md',
              reason: 'Modules changed',
              impactedBy: ['modules'],
              shouldRegenerate: true,
            },
          ],
          unchangedDocuments: ['README.md'],
          generatedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    },
    ...overrides,
  };
}

describe('buildRunSummaryData', () => {
  it('produces JSON-serializable data without secrets', () => {
    const config = buildConfig({ openRouterApiKey: 'sk-secret-should-not-appear' });
    const data = buildRunSummaryData({
      config,
      result: buildResult(),
    });

    const serialized = JSON.stringify(data);
    assert.ok(serialized.length > 0);
    assert.doesNotMatch(serialized, /sk-secret-should-not-appear/);
    assert.doesNotMatch(serialized, /openRouterApiKey/);

    const roundTripped = JSON.parse(serialized) as typeof data;
    assert.equal(roundTripped.headline, 'AI Project Docs completed');
    assert.equal(roundTripped.projectName, 'sample-project');
    assert.equal(roundTripped.knowledge.filesScanned, 42);
    assert.equal(roundTripped.success, true);
    assert.ok(Array.isArray(roundTripped.nextSteps));
  });

  it('omits AI and agent export sections when disabled', () => {
    const data = buildRunSummaryData({
      config: buildConfig(),
      result: buildResult(),
    });

    assert.equal(data.aiAnalysis, null);
    assert.equal(data.agentExports, null);
  });

  it('includes AI analysis fields when enabled', () => {
    const data = buildRunSummaryData({
      config: buildConfig({ enableAiAnalysis: true }),
      result: buildResult({
        metrics: {
          ...buildResult().metrics,
          aiInsightsGenerated: true,
          aiInsightsAttempted: true,
        },
        steps: [
          ...buildResult().steps,
          { name: 'Generate Architecture Context', description: '', status: 'completed' },
        ],
      }),
    });

    assert.ok(data.aiAnalysis);
    assert.equal(data.aiAnalysis.provider, 'openrouter');
    assert.equal(data.aiAnalysis.insightsGenerated, 'yes');
    assert.equal(data.aiAnalysis.architectureGenerated, 'yes');
    assert.equal(data.aiAnalysis.moduleDocumentation, 'not run');
  });

  it('matches formatRunSummary output when formatted', () => {
    const input = {
      config: buildConfig(),
      result: buildResult(),
    };

    const fromFormat = formatRunSummary(input).join('\n');
    const fromData = formatRunSummary(input).join('\n');

    assert.equal(fromFormat, fromData);
    assert.match(fromData, /Project: sample-project/);
    assert.match(fromData, /- Files scanned: 42/);
  });
});
