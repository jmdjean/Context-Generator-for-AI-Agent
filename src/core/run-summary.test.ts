import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuntimeConfig } from '../config';
import { createEmptyPipelineMetrics } from './pipeline-metrics';
import { PipelineExecutionResult } from './pipeline-orchestrator';
import { formatRunSummary, isPipelineSuccessful } from './run-summary';

function buildConfig(): RuntimeConfig {
  return {
    targetProjectPath: '/tmp/sample-project',
    docsDir: '.ai-docs',
    enableAiAnalysis: false,
    enableAgentExports: false,
    exportTargets: ['generic'],
    aiModel: 'openai/gpt-4.1-mini',
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

describe('formatRunSummary', () => {
  it('includes project, metrics, validation details, and next steps', () => {
    const output = formatRunSummary({
      config: buildConfig(),
      result: buildResult(),
    }).join('\n');

    assert.match(output, /AI Project Docs completed\n/);
    assert.match(output, /Project: sample-project/);
    assert.match(output, /Target: \/tmp\/sample-project/);
    assert.match(output, /Technologies: TypeScript, Node.js, npm/);
    assert.match(output, /- Files scanned: 42/);
    assert.match(output, /- Knowledge files persisted: 6/);
    assert.match(output, /Change detection:/);
    assert.match(output, /- Changed sections: modules/);
    assert.match(output, /Document impact:/);
    assert.match(output, /- Impacted documents: 1/);
    assert.match(output, /- Skipped protected: 1/);
    assert.match(output, /change-summary\.json for PKM diffs/);
    assert.match(output, /document-impact\.json for selective regeneration decisions/);
    assert.match(output, /- Planned: 11/);
    assert.match(output, /- Status: passed/);
    assert.match(output, /warning: 1 user-managed document preserved/);
    assert.match(output, /Review \.ai-docs\/README\.md/);
    assert.match(output, /project-knowledge\.json/);
  });

  it('omits AI Analysis and Agent exporters sections when those features are disabled', () => {
    const output = formatRunSummary({
      config: buildConfig(),
      result: buildResult(),
    }).join('\n');

    assert.doesNotMatch(output, /AI Analysis:/);
    assert.doesNotMatch(output, /Agent exporters:/);
  });

  it('collapses change detection and hides document impact on the initial run', () => {
    const base = buildResult();
    const result = buildResult({
      projectKnowledge: {
        ...base.projectKnowledge!,
        analysis: {
          ...base.projectKnowledge!.analysis,
          changeSummary: {
            ...base.projectKnowledge!.analysis.changeSummary!,
            isInitialRun: true,
            baselineStatus: 'none',
            changedSections: [],
            addedModules: [],
          },
        },
      },
    });

    const output = formatRunSummary({ config: buildConfig(), result }).join('\n');

    assert.match(output, /- Initial run: yes \(baseline created\)/);
    assert.doesNotMatch(output, /Changed sections/);
    assert.doesNotMatch(output, /Document impact:/);
  });

  it('reports validation failures in the headline', () => {
    const result = buildResult({
      success: false,
      errors: [
        {
          stepName: 'Validate Documentation',
          message: 'failed (1 error(s), 0 warning(s))',
        },
      ],
      metrics: {
        ...buildResult().metrics,
        validation: {
          errorCount: 1,
          warningCount: 0,
          status: 'failed',
          issues: [
            {
              severity: 'error',
              message: 'planned document was not written',
              relativePath: 'README.md',
            },
          ],
        },
      },
      steps: [
        ...buildResult().steps.filter((step) => step.name !== 'Validate Documentation'),
        { name: 'Validate Documentation', description: '', status: 'failed' },
      ],
    });

    const output = formatRunSummary({ config: buildConfig(), result }).join('\n');

    assert.match(output, /completed with validation errors/);
    assert.match(output, /1 failed/);
    assert.doesNotMatch(output, /Next steps:/);
  });

  it('reports AI analysis details when enabled and insights are generated', () => {
    const result = buildResult({
      metrics: {
        ...buildResult().metrics,
        aiInsightsGenerated: true,
        aiInsightsAttempted: true,
      },
      steps: [
        ...buildResult().steps,
        { name: 'Analyze AI Insights', description: '', status: 'completed' },
      ],
    });

    const output = formatRunSummary({
      config: { ...buildConfig(), enableAiAnalysis: true },
      result,
    }).join('\n');

    assert.match(output, /AI Analysis:/);
    assert.match(output, /- Model: openai\/gpt-4.1-mini/);
    assert.match(output, /- Insights generated: yes/);
  });

  it('reports failed AI analysis with warning hint', () => {
    const output = formatRunSummary({
      config: { ...buildConfig(), enableAiAnalysis: true },
      result: buildResult({
        metrics: {
          ...buildResult().metrics,
          aiInsightsGenerated: false,
          aiInsightsAttempted: true,
        },
      }),
    }).join('\n');

    assert.match(output, /AI Analysis:/);
    assert.match(output, /- Model: openai\/gpt-4.1-mini/);
    assert.match(output, /- Insights generated: no \(see warnings\)/);
  });

  it('reports agent export details when --export-agents is enabled', () => {
    const result = buildResult({
      metrics: {
        ...buildResult().metrics,
        agentExports: {
          enabled: true,
          enabledTargets: ['generic'],
          filesWritten: 1,
          filesSkipped: 0,
          warnings: [],
        },
      },
      steps: [
        ...buildResult().steps,
        { name: 'Export Agent Context', description: '', status: 'completed' },
      ],
    });

    const output = formatRunSummary({
      config: { ...buildConfig(), enableAgentExports: true },
      result,
    }).join('\n');

    assert.match(output, /Agent exporters:/);
    assert.match(output, /- Targets: generic/);
    assert.match(output, /- Files written: 1/);
    assert.match(output, /- Files skipped: 0/);
  });

  it('reports agent export warnings in the run summary', () => {
    const result = buildResult({
      metrics: {
        ...buildResult().metrics,
        agentExports: {
          enabled: true,
          enabledTargets: ['generic'],
          filesWritten: 0,
          filesSkipped: 1,
          warnings: ['skipped agent-pack/AGENTS.generated.md: user-managed file without generated marker'],
        },
      },
    });

    const output = formatRunSummary({
      config: { ...buildConfig(), enableAgentExports: true },
      result,
    }).join('\n');

    assert.match(output, /- Files written: 0/);
    assert.match(output, /- Files skipped: 1/);
    assert.match(output, /- Warning: skipped agent-pack/);
  });

  it('prefers the persisted PKM model when insights were generated', () => {
    const result = buildResult({
      metrics: {
        ...buildResult().metrics,
        aiInsightsGenerated: true,
        aiInsightsAttempted: true,
      },
      projectKnowledge: {
        ...buildResult().projectKnowledge!,
        analysis: {
          ...buildResult().projectKnowledge!.analysis,
          aiInsights: {
            generatedAt: '2026-01-02T00:00:00.000Z',
            model: 'anthropic/claude-3.5-sonnet',
            architectureSummary: 'Layered CLI.',
          },
        },
      },
      steps: [
        ...buildResult().steps,
        { name: 'Analyze AI Insights', description: '', status: 'completed' },
      ],
    });

    const output = formatRunSummary({
      config: { ...buildConfig(), enableAiAnalysis: true, aiModel: 'openai/gpt-4.1-mini' },
      result,
    }).join('\n');

    assert.match(output, /- Model: anthropic\/claude-3.5-sonnet/);
  });

  it('uses configured model when insights were not generated even if PKM has stale aiInsights', () => {
    const result = buildResult({
      projectKnowledge: {
        ...buildResult().projectKnowledge!,
        analysis: {
          ...buildResult().projectKnowledge!.analysis,
          aiInsights: {
            generatedAt: '2026-01-02T00:00:00.000Z',
            model: 'anthropic/claude-3.5-sonnet',
            architectureSummary: 'Stale insights.',
          },
        },
      },
    });

    const output = formatRunSummary({
      config: { ...buildConfig(), enableAiAnalysis: true },
      result,
    }).join('\n');

    assert.match(output, /- Model: openai\/gpt-4.1-mini/);
    assert.match(output, /- Insights generated: no/);
  });
});

describe('isPipelineSuccessful', () => {
  it('returns false when pipeline errors exist', () => {
    const result = buildResult({
      success: false,
      errors: [{ stepName: 'Write Documentation', message: 'disk full' }],
    });

    assert.equal(isPipelineSuccessful(result), false);
  });

  it('returns false when validation failed', () => {
    const result = buildResult({
      success: false,
      errors: [{ stepName: 'Validate Documentation', message: 'failed (1 error(s), 0 warning(s))' }],
      metrics: {
        ...buildResult().metrics,
        validation: {
          errorCount: 1,
          warningCount: 0,
          status: 'failed',
          issues: [],
        },
      },
    });

    assert.equal(isPipelineSuccessful(result), false);
  });

  it('returns true for a clean successful run', () => {
    assert.equal(isPipelineSuccessful(buildResult()), true);
  });
});
