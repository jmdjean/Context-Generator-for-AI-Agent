import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AIProvider } from './providers/ai-provider';
import { buildPkmSummaryPayload } from './prompt-builder';
import {
  enrichProjectKnowledgeWithAiInsights,
  extractJsonPayload,
  parseAiInsightsResponse,
  runAiAnalysis,
} from './ai-analysis-service';
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

  it('returns the original PKM when the provider response is invalid', async () => {
    const provider = buildFakeProvider('not-json');
    const knowledge = buildMinimalKnowledge();

    const result = await runAiAnalysis(knowledge, {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      provider,
    });

    assert.equal(result.insightsGenerated, false);
    assert.equal(result.attempted, true);
    assert.equal(result.knowledge, knowledge);
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
    assert.equal(result.knowledge, knowledge);
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
    assert.equal(result.knowledge, knowledge);
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
