import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { RuntimeConfig } from '../config';
import { ANALYSIS_PIPELINE } from '../domain';
import { handleAnalyzeAiInsights, handleDetectChanges, handleExportAgentContext, handleValidateDocumentation } from './pipeline-handlers';
import { createEmptyPipelineMetrics } from './pipeline-metrics';
import { ProjectKnowledge } from '../knowledge';
import { DocumentationWriteResult } from '../docs/documentation-writer';

function buildWriteResult(
  overrides: Partial<DocumentationWriteResult> = {},
): DocumentationWriteResult {
  return {
    writtenCount: 0,
    skippedCount: 0,
    skippedUnchangedCount: 0,
    skippedProtectedCount: 0,
    pkmPoweredCount: 0,
    genericCount: 0,
    docsDirectoryPath: '.ai-docs',
    writtenPaths: [],
    skippedPaths: [],
    skippedUnchangedPaths: [],
    skippedProtectedPaths: [],
    ...overrides,
  };
}

function buildContext(writeResult: DocumentationWriteResult): {
  config: RuntimeConfig;
  metrics: ReturnType<typeof createEmptyPipelineMetrics>;
  projectKnowledge: ProjectKnowledge;
} {
  return {
    config: {
      targetProjectPath: '/tmp/sample-project',
      docsDir: '.ai-docs',
      enableAiAnalysis: false,
      enableAgentExports: false,
      exportTargets: ['generic'],
      aiModel: 'openai/gpt-4.1-mini',
    },
    metrics: {
      ...createEmptyPipelineMetrics(),
      documentationWrite: writeResult,
    },
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
        detectedFiles: [],
        ignoredPaths: [],
      },
      technologies: {
        languages: [],
        frameworks: [],
        packageManagers: [],
        tooling: [],
        confidence: 'low',
      },
      documentation: {
        plan: {
          docsDir: '.ai-docs',
          documents: [
            {
              title: 'README.md',
              relativePath: 'README.md',
              purpose: 'Overview',
              priority: 'required',
              source: 'core',
            },
          ],
          generatedAt: '2026-01-01T00:00:00.000Z',
          strategy: 'standard',
        },
      },
      analysis: {
        status: 'partial',
      },
    },
  };
}

describe('handleValidateDocumentation', () => {
  it('returns failed when validation reports errors', async () => {
    const context = buildContext(buildWriteResult());
    const step = ANALYSIS_PIPELINE.find((item) => item.name === 'Validate Documentation');
    assert.ok(step);

    const result = await handleValidateDocumentation(context, step);

    assert.equal(result.status, 'failed');
    assert.match(result.message, /failed \(1 error/);
    assert.equal(context.metrics.validation?.status, 'failed');
  });
});

describe('handleAnalyzeAiInsights', () => {
  function buildAiContext(configOverrides: Partial<RuntimeConfig> = {}): {
    config: RuntimeConfig;
    metrics: ReturnType<typeof createEmptyPipelineMetrics>;
    projectKnowledge: ProjectKnowledge;
  } {
    return {
      config: {
        targetProjectPath: '/tmp/sample-project',
        docsDir: '.ai-docs',
        enableAiAnalysis: false,
        enableAgentExports: false,
        exportTargets: ['generic'],
        aiModel: 'openai/gpt-4.1-mini',
        ...configOverrides,
      },
      metrics: createEmptyPipelineMetrics(),
      projectKnowledge: buildContext(buildWriteResult()).projectKnowledge,
    };
  }

  it('skips when --ai is not provided', async () => {
    const context = buildAiContext();
    const step = ANALYSIS_PIPELINE.find((item) => item.name === 'Analyze AI Insights');
    assert.ok(step);

    const result = await handleAnalyzeAiInsights(context, step);

    assert.equal(result.status, 'skipped');
    assert.match(result.message, /--ai not provided/);
  });

  it('skips when --ai is provided without an API key', async () => {
    const context = buildAiContext({ enableAiAnalysis: true });
    const step = ANALYSIS_PIPELINE.find((item) => item.name === 'Analyze AI Insights');
    assert.ok(step);

    const result = await handleAnalyzeAiInsights(context, step);

    assert.equal(result.status, 'skipped');
    assert.match(result.message, /API key missing/);
    assert.equal(context.metrics.aiInsightsAttempted, true);
  });
});

describe('handleDetectChanges', () => {
  it('attaches changeSummary and documentImpact to project knowledge', async () => {
    const context = buildContext(
      buildWriteResult({
        writtenCount: 1,
        pkmPoweredCount: 1,
        writtenPaths: ['README.md'],
      }),
    );
    const step = ANALYSIS_PIPELINE.find((item) => item.name === 'Detect Changes');
    assert.ok(step);

    const result = await handleDetectChanges(context, step);

    assert.equal(result.status, 'completed');
    assert.ok(context.projectKnowledge?.analysis.changeSummary);
    assert.equal(context.projectKnowledge.analysis.changeSummary?.baselineStatus, 'none');
    assert.equal(context.projectKnowledge.analysis.changeSummary?.isInitialRun, true);
    assert.ok(context.projectKnowledge.analysis.documentImpact);
    assert.equal(
      context.projectKnowledge.analysis.documentImpact?.impactedDocuments.length,
      context.projectKnowledge.documentation.plan.documents.length,
    );
  });
});

describe('handleExportAgentContext', () => {
  it('skips when --export-agents is not provided', async () => {
    const context = buildContext(buildWriteResult());
    const step = ANALYSIS_PIPELINE.find((item) => item.name === 'Export Agent Context');
    assert.ok(step);

    const result = await handleExportAgentContext(context, step);

    assert.equal(result.status, 'skipped');
    assert.match(result.message, /--export-agents not provided/);
    assert.equal(context.metrics.agentExports, undefined);
  });

  it('exports the generic agent pack when --export-agents is enabled', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-export-agent-'));
    const context = buildContext(buildWriteResult());
    context.config.targetProjectPath = tempRoot;
    context.config.enableAgentExports = true;
    context.projectKnowledge!.repository.rootPath = tempRoot;
    const step = ANALYSIS_PIPELINE.find((item) => item.name === 'Export Agent Context');
    assert.ok(step);

    try {
      const result = await handleExportAgentContext(context, step);

      assert.equal(result.status, 'completed');
      assert.match(result.message, /exported 1 file/);
      assert.equal(context.metrics.agentExports?.filesWritten, 1);
      assert.ok(context.projectKnowledge?.analysis.agentExports);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('exports the Cursor rule when --target cursor is enabled', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-export-cursor-'));
    const context = buildContext(buildWriteResult());
    context.config.targetProjectPath = tempRoot;
    context.config.enableAgentExports = true;
    context.config.exportTargets = ['cursor'];
    context.projectKnowledge!.repository.rootPath = tempRoot;
    const step = ANALYSIS_PIPELINE.find((item) => item.name === 'Export Agent Context');
    assert.ok(step);

    try {
      const result = await handleExportAgentContext(context, step);

      assert.equal(result.status, 'completed');
      assert.equal(context.metrics.agentExports?.filesWritten, 1);
      assert.equal(context.metrics.agentExports?.enabledTargets[0], 'cursor');
      assert.equal(
        fs.existsSync(path.join(tempRoot, '.cursor', 'rules', 'ai-project-docs.mdc')),
        true,
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
