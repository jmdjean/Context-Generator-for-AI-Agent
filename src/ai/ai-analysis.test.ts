import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AIProvider } from './providers/ai-provider';
import { buildPkmSummaryPayload } from './prompt-builder';
import {
  enrichProjectKnowledgeWithAiInsights,
  extractJsonPayload,
  parseAiInsightsResponse,
  runAiAnalysis,
  runArchitectureStage,
} from './ai-analysis-service';
import {
  parseModuleDocumentationResponse,
  runModuleDocumentationStage,
} from './module-documentation-stage';
import { ProjectKnowledge } from '../knowledge';

function buildMinimalKnowledge(): ProjectKnowledge {
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
      rootPath: '/tmp/sample-project',
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
        documents: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'partial',
      modules: [
        {
          name: 'core',
          path: '/tmp/sample-project/src/core',
          relativePath: 'src/core',
          type: 'core',
          responsibility: 'Pipeline orchestration',
          importantFiles: [],
          relatedFolders: [],
          signals: [],
          confidence: 'high',
        },
        {
          name: 'docs',
          path: '/tmp/sample-project/src/docs',
          relativePath: 'src/docs',
          type: 'documentation',
          responsibility: 'Documentation generators',
          importantFiles: [],
          relatedFolders: [],
          signals: [],
          confidence: 'low',
        },
      ],
      folderContexts: [
        {
          path: '/tmp/sample-project/src',
          relativePath: 'src',
          name: 'src',
          depth: 1,
          classification: 'source',
          responsibility: 'Application source',
          importantFiles: [],
          childFolders: ['core'],
          signals: [],
          confidence: 'high',
        },
      ],
      conventions: [
        {
          category: 'architecture',
          name: 'Layered modules',
          description: 'Code is grouped by concern',
          evidence: [],
          confidence: 'medium',
        },
      ],
      dependencyGraph: {
        nodes: [{ id: 'core', name: 'core', type: 'core', relativePath: 'src/core' }],
        edges: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      navigationMap: {
        entries: [
          {
            taskType: 'architecture-change',
            description: 'Read architecture docs first',
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

describe('buildPkmSummaryPayload', () => {
  it('summarizes PKM sections without file contents or absolute paths', () => {
    const summary = buildPkmSummaryPayload(buildMinimalKnowledge());
    const serialized = JSON.stringify(summary);

    assert.equal(summary.projectName, 'sample-project');
    assert.equal(summary.analysisStatus, 'partial');
    assert.equal(summary.modules.length, 2);
    assert.equal(summary.modules[0]?.relativePath, 'src/core');
    assert.equal(summary.truncation.modules.total, 2);
    assert.ok(!serialized.includes('/tmp/sample-project'));
    assert.ok(!serialized.includes('index.ts'));
  });

  it('prioritizes high-confidence modules before low-confidence ones', () => {
    const summary = buildPkmSummaryPayload(buildMinimalKnowledge());
    assert.equal(summary.modules[0]?.confidence, 'high');
    assert.equal(summary.modules[1]?.confidence, 'low');
  });
});

describe('extractJsonPayload', () => {
  it('unwraps markdown JSON fences', () => {
    const payload = extractJsonPayload('```json\n{"architectureSummary":"ok"}\n```');
    assert.equal(payload, '{"architectureSummary":"ok"}');
  });

  it('extracts fenced JSON from prose-wrapped model output', () => {
    const payload = extractJsonPayload(
      'Here is the analysis:\n```json\n{"architectureSummary":"ok"}\n```\nThanks.',
    );
    assert.equal(payload, '{"architectureSummary":"ok"}');
  });

  it('extracts a JSON object embedded in prose without fences', () => {
    const payload = extractJsonPayload('Analysis ready {"architectureSummary":"ok"} end.');
    assert.equal(payload, '{"architectureSummary":"ok"}');
  });
});

describe('parseAiInsightsResponse', () => {
  it('accepts valid structured JSON', () => {
    const parsed = parseAiInsightsResponse(
      JSON.stringify({
        architectureSummary: 'Layered CLI with PKM at the center.',
        risks: ['Tight coupling in orchestrator'],
        recommendations: ['Add integration tests'],
        agentGuidance: ['Read AGENTS.md first'],
      }),
    );

    assert.ok(parsed);
    assert.equal(parsed?.architectureSummary, 'Layered CLI with PKM at the center.');
    assert.equal(parsed?.risks?.length, 1);
  });

  it('accepts fenced JSON and trims oversized arrays', () => {
    const parsed = parseAiInsightsResponse(
      '```json\n' +
        JSON.stringify({
          risks: ['one', 'two', 'three', 'four', 'five', 'six'],
        }) +
        '\n```',
    );

    assert.ok(parsed);
    assert.equal(parsed?.risks?.length, 5);
  });

  it('rejects invalid JSON and empty payloads', () => {
    assert.equal(parseAiInsightsResponse('not json'), undefined);
    assert.equal(parseAiInsightsResponse('[]'), undefined);
    assert.equal(
      parseAiInsightsResponse(JSON.stringify({ architectureSummary: 42 })),
      undefined,
    );
    assert.equal(parseAiInsightsResponse(JSON.stringify({})), undefined);
  });

  it('ignores unknown fields and keeps valid content', () => {
    const parsed = parseAiInsightsResponse(
      JSON.stringify({ extraField: 'nope', risks: ['Dependency coupling'] }),
    );

    assert.deepEqual(parsed, { risks: ['Dependency coupling'] });
  });
});

function buildFakeProvider(content: string): AIProvider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    id: 'fake',
    name: 'Fake Provider',
    prompts,
    supports: (providerId: string) => providerId === 'fake',
    analyze: async (prompt: string, options) => {
      prompts.push(prompt);
      return { content, model: options.model, provider: 'fake' };
    },
  };
}

describe('runArchitectureStage', () => {
  it('writes staged architecture output and legacy aiInsights on success', async () => {
    const provider = buildFakeProvider(
      JSON.stringify({
        architectureSummary: 'CLI pipeline with PKM enrichment.',
        risks: ['Orchestrator coupling'],
        agentGuidance: ['Start from agent-navigation.md'],
      }),
    );

    const result = await runArchitectureStage(buildMinimalKnowledge(), {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.architectureGenerated, true);
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.architecture?.status,
      'completed',
    );
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.architecture?.summary,
      'CLI pipeline with PKM enrichment.',
    );
    assert.match(
      result.knowledge.analysis.stagedDocumentation?.architecture?.content ?? '',
      /Orchestrator coupling/,
    );
    assert.deepEqual(
      result.knowledge.analysis.stagedDocumentation?.architecture?.documentPaths,
      ['architecture.md', 'ai-context.md'],
    );
    assert.equal(result.knowledge.analysis.aiInsights?.architectureSummary, 'CLI pipeline with PKM enrichment.');
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.execution.some(
        (entry) => entry.stageId === 'architecture' && entry.status === 'completed',
      ),
      true,
    );
    assert.match(provider.prompts[0] ?? '', /architecture-stage documentation context/);
  });

  it('records failed architecture status without dropping the PKM on invalid JSON', async () => {
    const provider = buildFakeProvider('not-json');
    const knowledge = buildMinimalKnowledge();

    const result = await runArchitectureStage(knowledge, {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.architectureGenerated, false);
    assert.equal(result.knowledge.analysis.aiInsights, undefined);
    assert.equal(result.knowledge.analysis.modules?.length, knowledge.analysis.modules?.length);
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.architecture?.status,
      'failed',
    );
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.execution.some(
        (entry) => entry.stageId === 'architecture' && entry.status === 'failed',
      ),
      true,
    );
  });
});

describe('runAiAnalysis', () => {
  it('enriches PKM when the provider returns valid JSON', async () => {
    const provider = buildFakeProvider(
      JSON.stringify({
        architectureSummary: 'CLI pipeline with PKM enrichment.',
        agentGuidance: ['Start from agent-navigation.md'],
      }),
    );

    const result = await runAiAnalysis(buildMinimalKnowledge(), {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.insightsGenerated, true);
    assert.equal(result.attempted, true);
    assert.equal(
      result.knowledge.analysis.aiInsights?.architectureSummary,
      'CLI pipeline with PKM enrichment.',
    );
    assert.equal(result.knowledge.analysis.aiInsights?.model, 'openai/gpt-4.1-mini');
    assert.match(result.message, /via fake/);
    assert.equal(provider.prompts.length, 1);
    assert.match(provider.prompts[0] ?? '', /PKM summary \(JSON\):/);
  });

  it('returns PKM without insights when the provider response is invalid', async () => {
    const provider = buildFakeProvider('not-json');
    const knowledge = buildMinimalKnowledge();

    const result = await runAiAnalysis(knowledge, {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.insightsGenerated, false);
    assert.equal(result.attempted, true);
    assert.equal(result.knowledge.analysis.aiInsights, undefined);
    assert.equal(result.knowledge.analysis.modules?.length, knowledge.analysis.modules?.length);
    assert.equal(result.warnings.length, 1);
  });

  it('continues gracefully when the provider throws', async () => {
    const provider: AIProvider = {
      id: 'fake',
      name: 'Fake Provider',
      supports: () => true,
      analyze: async () => {
        throw new Error('provider exploded');
      },
    };
    const knowledge = buildMinimalKnowledge();

    const result = await runAiAnalysis(knowledge, {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.insightsGenerated, false);
    assert.equal(result.attempted, true);
    assert.equal(result.knowledge.analysis.aiInsights, undefined);
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.architecture?.status,
      'failed',
    );
    assert.match(result.warnings[0] ?? '', /provider exploded/);
  });

  it('fails gracefully when an unsupported provider id is configured', async () => {
    const knowledge = buildMinimalKnowledge();

    const result = await runAiAnalysis(knowledge, {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      providerId: 'does-not-exist',
    });

    assert.equal(result.insightsGenerated, false);
    assert.equal(result.attempted, true);
    assert.equal(result.knowledge.analysis.aiInsights, undefined);
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.architecture?.status,
      'failed',
    );
    assert.match(result.warnings[0] ?? '', /Unsupported AI provider: does-not-exist/);
  });
});

describe('enrichProjectKnowledgeWithAiInsights', () => {
  it('returns a new object with aiInsights attached', () => {
    const knowledge = buildMinimalKnowledge();
    const enriched = enrichProjectKnowledgeWithAiInsights(knowledge, {
      generatedAt: '2026-01-02T00:00:00.000Z',
      model: 'openai/gpt-4.1-mini',
      architectureSummary: 'Summary',
    });

    assert.notEqual(enriched, knowledge);
    assert.equal(enriched.analysis.aiInsights?.architectureSummary, 'Summary');
  });
});

function withModulePlan(knowledge: ProjectKnowledge): ProjectKnowledge {
  return {
    ...knowledge,
    analysis: {
      ...knowledge.analysis,
      stagedDocumentation: {
        architecture: {
          status: 'completed',
          summary: 'PKM-centered CLI pipeline.',
          content: 'Layers: scanner → detectors → analyzers → docs.',
          documentPaths: ['architecture.md'],
          warnings: [],
        },
        modulePlan: {
          status: 'completed',
          entries: [
            {
              moduleId: 'src/core',
              moduleName: 'core',
              moduleRelativePath: 'src/core',
              documentPath: 'code/components/src__core.md',
              order: 1,
              status: 'pending',
              rationale: 'Pipeline orchestration',
            },
            {
              moduleId: 'src/docs',
              moduleName: 'docs',
              moduleRelativePath: 'src/docs',
              documentPath: 'code/components/src__docs.md',
              order: 2,
              status: 'pending',
              rationale: 'Documentation generators',
            },
          ],
          warnings: [],
        },
        execution: [
          { stageId: 'architecture', status: 'completed', warnings: [] },
          { stageId: 'module-plan', status: 'completed', warnings: [] },
        ],
      },
    },
  };
}

describe('parseModuleDocumentationResponse', () => {
  it('accepts valid module documentation JSON', () => {
    const parsed = parseModuleDocumentationResponse(
      JSON.stringify({
        summary: 'Orchestrates the analysis pipeline.',
        purpose: 'Coordinate scan, detect, analyze, and write stages.',
        entryPoints: ['src/core/pipeline-orchestrator.ts'],
        keyBehaviors: ['Dispatches ANALYSIS_PIPELINE steps'],
        dependencies: ['src/knowledge'],
        outOfScope: ['Markdown rendering'],
        agentGuidance: ['Do not put scan logic in core'],
      }),
    );

    assert.ok(parsed);
    assert.equal(parsed?.summary, 'Orchestrates the analysis pipeline.');
    assert.equal(parsed?.entryPoints?.length, 1);
  });

  it('rejects empty or invalid payloads', () => {
    assert.equal(parseModuleDocumentationResponse('not-json'), undefined);
    assert.equal(parseModuleDocumentationResponse(JSON.stringify({})), undefined);
    assert.equal(parseModuleDocumentationResponse(JSON.stringify({ summary: 12 })), undefined);
  });
});

describe('runModuleDocumentationStage', () => {
  it('persists one result per module-plan entry on success', async () => {
    const provider = buildFakeProvider(
      JSON.stringify({
        summary: 'Module documentation summary.',
        purpose: 'Document this module for agents.',
        entryPoints: ['index.ts'],
        agentGuidance: ['Read architecture.md first'],
      }),
    );

    const result = await runModuleDocumentationStage(withModulePlan(buildMinimalKnowledge()), {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.modulesGenerated, true);
    assert.equal(result.completedCount, 2);
    assert.equal(result.failedCount, 0);
    assert.equal(result.knowledge.analysis.stagedDocumentation?.moduleResults?.status, 'completed');
    assert.equal(result.knowledge.analysis.stagedDocumentation?.moduleResults?.results.length, 2);
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.moduleResults?.results.every(
        (entry) => entry.status === 'completed' && Boolean(entry.summary),
      ),
      true,
    );
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.modulePlan?.entries.every(
        (entry) => entry.status === 'completed',
      ),
      true,
    );
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.execution.some(
        (entry) => entry.stageId === 'module-documentation' && entry.status === 'completed',
      ),
      true,
    );
    assert.equal(provider.prompts.length, 2);
    assert.match(provider.prompts[0] ?? '', /src\/core/);
    assert.match(provider.prompts[0] ?? '', /PKM-centered CLI pipeline|Layers: scanner/);
  });

  it('isolates failures so one bad module does not drop others', async () => {
    const prompts: string[] = [];
    let callCount = 0;
    const provider: AIProvider & { prompts: string[] } = {
      id: 'fake',
      name: 'Fake Provider',
      prompts,
      supports: (providerId: string) => providerId === 'fake',
      analyze: async (prompt: string, options) => {
        prompts.push(prompt);
        callCount += 1;
        if (callCount === 1) {
          return {
            content: JSON.stringify({
              summary: 'Core module docs.',
              purpose: 'Orchestration',
            }),
            model: options.model,
            provider: 'fake',
          };
        }
        return { content: 'not-json', model: options.model, provider: 'fake' };
      },
    };

    const result = await runModuleDocumentationStage(withModulePlan(buildMinimalKnowledge()), {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.modulesGenerated, true);
    assert.equal(result.completedCount, 1);
    assert.equal(result.failedCount, 1);
    assert.equal(result.knowledge.analysis.stagedDocumentation?.moduleResults?.status, 'partial');
    const results = result.knowledge.analysis.stagedDocumentation?.moduleResults?.results ?? [];
    assert.equal(results[0]?.status, 'completed');
    assert.equal(results[1]?.status, 'failed');
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.execution.some(
        (entry) => entry.stageId === 'module-documentation' && entry.status === 'partial',
      ),
      true,
    );
  });

  it('skips without calling the provider when no module-plan entries exist', async () => {
    const provider = buildFakeProvider('{}');
    const result = await runModuleDocumentationStage(buildMinimalKnowledge(), {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.attempted, false);
    assert.equal(result.modulesGenerated, false);
    assert.equal(provider.prompts.length, 0);
    assert.match(result.message, /no module-plan entries/);
    assert.equal(result.knowledge.analysis.stagedDocumentation?.moduleResults?.status, 'partial');
  });
});
