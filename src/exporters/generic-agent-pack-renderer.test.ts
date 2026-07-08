import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GENERATED_FILE_MARKER } from '../docs/document-template';
import { NavigationMapKnowledge, ProjectKnowledge } from '../knowledge';
import { renderGenericAgentPack } from './generic-agent-pack-renderer';

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
            title: 'agent-navigation.md',
            relativePath: 'agent-navigation.md',
            purpose: 'Navigation',
            priority: 'required',
            source: 'core',
          },
          {
            title: 'dependency-map.md',
            relativePath: 'dependency-map.md',
            purpose: 'Dependencies',
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
      modules: [
        {
          name: 'core',
          path: 'src/core',
          relativePath: 'src/core',
          type: 'core',
          responsibility: 'Pipeline orchestration',
          importantFiles: [],
          relatedFolders: ['src/core'],
          signals: [],
          confidence: 'high',
        },
      ],
      conventions: [
        {
          category: 'language',
          name: 'Strict TypeScript',
          description: 'The project compiles with strict mode enabled.',
          evidence: [],
          confidence: 'high',
        },
      ],
      dependencyGraph: {
        nodes: [{ id: 'core', name: 'core', type: 'core', relativePath: 'src/core' }],
        edges: [
          {
            from: 'src/docs',
            to: 'src/core',
            type: 'imports',
            evidence: [{ sourceFile: 'src/docs/writer.ts', importPath: '../core' }],
            confidence: 'high',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      navigationMap: createNavigationMap(),
    },
  };
}

describe('renderGenericAgentPack', () => {
  it('emits the generated marker and PKM-backed sections', () => {
    const markdown = renderGenericAgentPack(createKnowledge(), EXPORTED_AT);

    assert.ok(markdown.startsWith(GENERATED_FILE_MARKER));
    assert.match(markdown, /# Generic agent context pack/);
    assert.match(markdown, /- Exported: 2026-07-08T12:00:00.000Z/);
    assert.match(markdown, /- PKM assembled: 2026-01-01T00:00:00.000Z/);
    assert.match(markdown, /## Project summary/);
    assert.match(markdown, /Languages: TypeScript/);
    assert.match(markdown, /## Where to read first/);
    assert.match(markdown, /\.ai-docs\/AGENTS\.md/);
    assert.match(markdown, /agent-navigation\.md/);
    assert.match(markdown, /## Recommended task navigation/);
    assert.match(markdown, /### Bug fix/);
    assert.match(markdown, /Avoid changing unrelated modules/);
    assert.match(markdown, /## Key modules/);
    assert.match(markdown, /src\/core/);
    assert.match(markdown, /## Conventions/);
    assert.match(markdown, /Strict TypeScript/);
    assert.match(markdown, /## Dependency graph summary/);
    assert.match(markdown, /src\/docs.*src\/core/);
    assert.match(markdown, /dependency-map\.md/);
    assert.match(markdown, /## Safety rules for agents/);
    assert.match(markdown, /## PKM is the source of truth/);
    assert.match(markdown, /project-knowledge\.json/);
  });

  it('does not recommend agent-navigation.md when it is not in the documentation plan', () => {
    const knowledge = createKnowledge();
    knowledge.documentation.plan.documents = knowledge.documentation.plan.documents.filter(
      (document) => document.relativePath !== 'agent-navigation.md',
    );

    const markdown = renderGenericAgentPack(knowledge, EXPORTED_AT);

    assert.doesNotMatch(markdown, /Then load.*agent-navigation\.md/);
    assert.match(markdown, /task navigation section below/);
  });

  it('degrades gracefully when analysis sections are missing', () => {
    const knowledge = createKnowledge();
    knowledge.analysis = { status: 'pending' };

    const markdown = renderGenericAgentPack(knowledge, EXPORTED_AT);

    assert.match(markdown, /navigation map has not been built/);
    assert.match(markdown, /No modules are known yet/);
    assert.match(markdown, /No conventions are known yet/);
    assert.match(markdown, /dependency graph has not been built/);
  });
});
