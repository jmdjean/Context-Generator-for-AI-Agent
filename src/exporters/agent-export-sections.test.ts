import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatYamlScalar,
  renderConventionSummarySection,
  renderReadingOrderSection,
} from './agent-export-sections';
import { ProjectKnowledge } from '../knowledge';

function createKnowledge(overrides: {
  projectName?: string;
  documents?: ProjectKnowledge['documentation']['plan']['documents'];
  conventions?: NonNullable<ProjectKnowledge['analysis']['conventions']>;
} = {}): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: overrides.projectName ?? 'sample-project',
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
        documents: overrides.documents ?? [
          {
            title: 'AGENTS.md',
            relativePath: 'AGENTS.md',
            purpose: 'Agent entry',
            priority: 'required',
            source: 'agent',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'partial',
      conventions: overrides.conventions,
    },
  };
}

describe('formatYamlScalar', () => {
  it('quotes values that contain YAML special characters', () => {
    assert.equal(formatYamlScalar('simple-name'), 'simple-name');
    assert.equal(formatYamlScalar('My: Project'), '"My: Project"');
    assert.equal(formatYamlScalar('quote "test"'), '"quote \\"test\\""');
  });

  it('escapes control characters inside quoted YAML scalars', () => {
    assert.equal(formatYamlScalar('line1\nline2'), '"line1\\nline2"');
    assert.equal(formatYamlScalar('tab\there'), '"tab\\there"');
  });
});

describe('renderReadingOrderSection', () => {
  it('does not recommend agent-navigation when it is not planned', () => {
    const lines = renderReadingOrderSection(createKnowledge(), { title: 'Mandatory reading order' });
    const content = lines.join('\n');

    assert.doesNotMatch(content, /agent-navigation\.md/);
    assert.match(content, /task navigation section below/);
  });
});

describe('renderConventionSummarySection', () => {
  it('limits convention output and points to conventions.md when truncated', () => {
    const conventions = Array.from({ length: 15 }, (_, index) => ({
      category: 'language' as const,
      name: `Convention ${index + 1}`,
      description: `Rule ${index + 1}`,
      evidence: [],
      confidence: 'high' as const,
    }));

    const knowledge = createKnowledge({
      documents: [
        {
          title: 'conventions.md',
          relativePath: 'conventions.md',
          purpose: 'Conventions',
          priority: 'required',
          source: 'core',
        },
      ],
      conventions,
    });

    const lines = renderConventionSummarySection(
      knowledge.analysis.conventions,
      knowledge.metadata.docsDir,
      new Set(['conventions.md']),
      { limit: 5 },
    );
    const content = lines.join('\n');

    assert.match(content, /Convention 5/);
    assert.doesNotMatch(content, /Convention 6/);
    assert.match(content, /…and 10 more in/);
  });
});
