import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProjectKnowledge } from '../knowledge';
import { PlannedDocument } from '../domain/documentation-plan';
import { GENERATED_FILE_MARKER } from './document-template';
import {
  hasPkmRenderer,
  PKM_RENDERED_DOCUMENT_PATHS,
  renderPlannedDocument,
} from './markdown-renderers';

function buildPlannedDocument(relativePath: string): PlannedDocument {
  return {
    title: `Test ${relativePath}`,
    relativePath,
    purpose: 'Test purpose',
    priority: 'required',
    source: 'core',
  };
}

function buildEnrichedKnowledge(): ProjectKnowledge {
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
      detectedFiles: ['package.json', 'tsconfig.json'],
      ignoredPaths: ['node_modules', 'dist'],
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
        documents: [
          buildPlannedDocument('AGENTS.md'),
          buildPlannedDocument('architecture.md'),
          buildPlannedDocument('conventions.md'),
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
          signals: ['name:src'],
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
          signals: ['path:src/core'],
          confidence: 'high',
        },
        {
          name: 'knowledge',
          path: '/tmp/sample-project/src/knowledge',
          relativePath: 'src/knowledge',
          type: 'core',
          responsibility: 'Project Knowledge Model',
          importantFiles: ['index.ts'],
          relatedFolders: ['src/knowledge'],
          signals: ['path:src/knowledge'],
          confidence: 'high',
        },
      ],
      dependencyGraph: {
        nodes: [
          { id: 'src/core', name: 'core', type: 'core', relativePath: 'src/core' },
          { id: 'src/knowledge', name: 'knowledge', type: 'core', relativePath: 'src/knowledge' },
        ],
        edges: [
          {
            from: 'src/core',
            to: 'src/knowledge',
            type: 'imports',
            evidence: [{ sourceFile: 'src/core/index.ts', importPath: '../knowledge' }],
            confidence: 'high',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
      conventions: [
        {
          category: 'language',
          name: 'TypeScript strict mode',
          description: 'The project compiles with strict TypeScript settings.',
          evidence: [
            { type: 'config', source: 'tsconfig.json', detail: 'compilerOptions.strict is enabled' },
          ],
          confidence: 'high',
        },
      ],
      navigationMap: {
        entries: [
          {
            taskType: 'architecture-change',
            description: 'Structural changes across modules.',
            recommendedKnowledge: ['modules', 'dependencyGraph'],
            recommendedDocuments: ['architecture.md'],
            relatedModules: ['src/core'],
            relatedFolders: ['src'],
            warnings: ['Check dependent modules before moving code.'],
            confidence: 'high',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  };
}

function buildPendingKnowledge(): ProjectKnowledge {
  const knowledge = buildEnrichedKnowledge();
  return { ...knowledge, analysis: { status: 'pending' } };
}

test('every key document has a PKM renderer', () => {
  const expectedPaths = [
    'architecture.md',
    'folder-structure.md',
    'dependency-map.md',
    'conventions.md',
    'agent-navigation.md',
    'ai-context.md',
    'implementation-guide.md',
  ];

  assert.deepEqual([...PKM_RENDERED_DOCUMENT_PATHS].sort(), [...expectedPaths].sort());
  for (const relativePath of expectedPaths) {
    assert.equal(hasPkmRenderer(relativePath), true);
  }
});

test('PKM renderers emit the generated marker and real PKM data', () => {
  const knowledge = buildEnrichedKnowledge();

  for (const relativePath of PKM_RENDERED_DOCUMENT_PATHS) {
    const rendered = renderPlannedDocument(buildPlannedDocument(relativePath), knowledge);
    assert.equal(rendered.rendererKind, 'pkm');
    assert.ok(rendered.markdown.startsWith(GENERATED_FILE_MARKER), `${relativePath} must start with the marker`);
    assert.ok(rendered.markdown.includes('sample-project'), `${relativePath} must include the project name`);
  }
});

test('architecture renderer includes technologies, modules, and dependency summary', () => {
  const rendered = renderPlannedDocument(
    buildPlannedDocument('architecture.md'),
    buildEnrichedKnowledge(),
  );

  assert.ok(rendered.markdown.includes('TypeScript'));
  assert.ok(rendered.markdown.includes('`src/core`'));
  assert.ok(rendered.markdown.includes('Pipeline orchestration'));
  assert.ok(rendered.markdown.includes('Nodes (modules): 2'));
  assert.ok(rendered.markdown.includes('Check dependent modules before moving code.'));
});

test('dependency map renderer includes edges, evidence, and the lightweight warning', () => {
  const rendered = renderPlannedDocument(
    buildPlannedDocument('dependency-map.md'),
    buildEnrichedKnowledge(),
  );

  assert.ok(rendered.markdown.includes('`src/core` → `src/knowledge`'));
  assert.ok(rendered.markdown.includes('`src/core/index.ts` imports `../knowledge`'));
  assert.ok(rendered.markdown.includes('deterministic and intentionally lightweight'));
});

test('conventions renderer includes category, confidence, and evidence', () => {
  const rendered = renderPlannedDocument(
    buildPlannedDocument('conventions.md'),
    buildEnrichedKnowledge(),
  );

  assert.ok(rendered.markdown.includes('TypeScript strict mode'));
  assert.ok(rendered.markdown.includes('- Category: language'));
  assert.ok(rendered.markdown.includes('- Confidence: high'));
  assert.ok(rendered.markdown.includes('compilerOptions.strict is enabled'));
});

test('agent navigation renderer includes task types, recommendations, and warnings', () => {
  const rendered = renderPlannedDocument(
    buildPlannedDocument('agent-navigation.md'),
    buildEnrichedKnowledge(),
  );

  assert.ok(rendered.markdown.includes('## Architecture change'));
  assert.ok(rendered.markdown.includes('`modules`, `dependencyGraph`'));
  assert.ok(rendered.markdown.includes('`architecture.md`'));
  assert.ok(rendered.markdown.includes('Check dependent modules before moving code.'));
});

test('unknown documents fall back to the generic template', () => {
  const rendered = renderPlannedDocument(
    buildPlannedDocument('change-log.md'),
    buildEnrichedKnowledge(),
  );

  assert.equal(rendered.rendererKind, 'generic');
  assert.ok(rendered.markdown.startsWith(GENERATED_FILE_MARKER));
});

test('PKM renderers degrade gracefully when analysis sections are missing', () => {
  const knowledge = buildPendingKnowledge();

  for (const relativePath of PKM_RENDERED_DOCUMENT_PATHS) {
    const rendered = renderPlannedDocument(buildPlannedDocument(relativePath), knowledge);
    assert.ok(rendered.markdown.startsWith(GENERATED_FILE_MARKER));
    assert.ok(rendered.markdown.length > 0);
  }
});
