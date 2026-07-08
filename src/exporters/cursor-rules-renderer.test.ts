import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GENERATED_FILE_MARKER } from '../docs/document-template';
import { NavigationMapKnowledge, ProjectKnowledge } from '../knowledge';
import { renderCursorRules } from './cursor-rules-renderer';

const EXPORTED_AT = '2026-07-08T12:00:00.000Z';

function createNavigationMap(): NavigationMapKnowledge {
  return {
    entries: [
      {
        taskType: 'bug-fix',
        description: 'Fix the root cause before patching generated output.',
        recommendedKnowledge: ['modules', 'dependencyGraph'],
        recommendedDocuments: ['implementation-guide.md'],
        relatedModules: ['src/core'],
        relatedFolders: ['src'],
        warnings: ['Avoid changing unrelated modules.'],
        confidence: 'high',
      },
    ],
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createKnowledge(): ProjectKnowledge {
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
      tooling: ['TypeScript'],
      confidence: 'high',
    },
    documentation: {
      plan: {
        docsDir: '.ai-docs',
        documents: [
          {
            title: 'AGENTS.md',
            relativePath: 'AGENTS.md',
            purpose: 'Agent entry',
            priority: 'required',
            source: 'agent',
          },
          {
            title: 'architecture.md',
            relativePath: 'architecture.md',
            purpose: 'Architecture',
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
      folderContexts: [
        {
          path: '/tmp/sample-project/src',
          relativePath: 'src',
          name: 'src',
          depth: 1,
          classification: 'source',
          responsibility: 'Application source code',
          importantFiles: ['index.ts'],
          childFolders: ['core'],
          signals: ['typescript'],
          confidence: 'high',
        },
      ],
      modules: [
        {
          name: 'core',
          path: '/tmp/sample-project/src/core',
          relativePath: 'src/core',
          type: 'core',
          responsibility: 'Pipeline orchestration',
          importantFiles: ['index.ts'],
          relatedFolders: ['src/core'],
          signals: ['orchestrator'],
          confidence: 'high',
        },
      ],
      conventions: [
        {
          name: 'Strict TypeScript',
          category: 'architecture',
          description: 'Use strict mode and explicit types.',
          evidence: [{ type: 'config', source: 'tsconfig.json', detail: 'strict: true' }],
          confidence: 'high',
        },
      ],
      navigationMap: createNavigationMap(),
      dependencyGraph: {
        nodes: [{ id: 'src/core', name: 'core', type: 'core', relativePath: 'src/core' }],
        edges: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  };
}

describe('renderCursorRules', () => {
  it('includes frontmatter, generated marker, and required sections', () => {
    const content = renderCursorRules(createKnowledge(), EXPORTED_AT);

    assert.match(content, /^---\n/);
    assert.match(content, /alwaysApply: true/);
    assert.ok(content.includes(GENERATED_FILE_MARKER));
    assert.match(content, /## Project summary/);
    assert.match(content, /- Exported: 2026-07-08T12:00:00.000Z/);
    assert.match(content, /- PKM schema: 1\.0\.0/);
    assert.match(content, /## Mandatory reading order/);
    assert.match(content, /## Architecture boundaries/);
    assert.match(content, /## Module map/);
    assert.match(content, /## Convention summary/);
    assert.match(content, /## Navigation map by task type/);
    assert.match(content, /## Dependency graph summary/);
    assert.match(content, /## Safety rules/);
    assert.match(content, /## PKM is the source of truth/);
    assert.match(content, /Bug fix/);
    assert.match(content, /src\/core/);
    assert.match(content, /tool-managed agent export paths/);
  });

  it('quotes YAML frontmatter when the project name contains special characters', () => {
    const knowledge = createKnowledge();
    knowledge.metadata.projectName = 'Acme: Platform "Core"';

    const content = renderCursorRules(knowledge, EXPORTED_AT);

    assert.match(content, /description: "Project context for Acme: Platform \\"Core\\"/);
  });
});
