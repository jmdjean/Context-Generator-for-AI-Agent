import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PlannedDocument } from '../domain/documentation-plan';
import { ProjectKnowledge } from '../knowledge';
import { GENERATED_FILE_MARKER } from '../docs/document-template';
import { GENERIC_MARKDOWN_TEMPLATE_ID } from './markdown-template';
import {
  buildTemplateContext,
  hasRegisteredTemplate,
  REGISTERED_TEMPLATE_OUTPUT_PATHS,
  renderDocumentWithTemplate,
  renderDocumentationPlan,
} from './template-engine';

function buildPlannedDocument(relativePath: string): PlannedDocument {
  return {
    title: `Test ${relativePath}`,
    relativePath,
    purpose: 'Test purpose',
    priority: 'required',
    source: 'core',
  };
}

function buildKnowledge(documents: PlannedDocument[]): ProjectKnowledge {
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
      detectedFiles: ['package.json'],
      ignoredPaths: ['node_modules'],
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
        documents,
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
          importantFiles: ['index.ts'],
          relatedFolders: ['src/core'],
          signals: ['path:src/core'],
          confidence: 'high',
        },
      ],
    },
  };
}

describe('template engine', () => {
  it('registers templates for all key markdown documents', () => {
    const expectedPaths = [
      'architecture.md',
      'folder-structure.md',
      'dependency-map.md',
      'conventions.md',
      'agent-navigation.md',
      'ai-context.md',
      'implementation-guide.md',
    ];

    assert.deepEqual([...REGISTERED_TEMPLATE_OUTPUT_PATHS].sort(), [...expectedPaths].sort());
    for (const outputPath of expectedPaths) {
      assert.equal(hasRegisteredTemplate(outputPath), true);
    }
  });

  it('builds template context from project knowledge', () => {
    const knowledge = buildKnowledge([buildPlannedDocument('architecture.md')]);
    const context = buildTemplateContext(knowledge);

    assert.equal(context.knowledge, knowledge);
    assert.equal(context.generatedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(context.docsDir, '.ai-docs');
  });

  it('renders registered templates with PKM data and generated marker', () => {
    const knowledge = buildKnowledge(
      REGISTERED_TEMPLATE_OUTPUT_PATHS.map((relativePath) => buildPlannedDocument(relativePath)),
    );

    for (const outputPath of REGISTERED_TEMPLATE_OUTPUT_PATHS) {
      const rendered = renderDocumentWithTemplate(buildPlannedDocument(outputPath), knowledge);

      assert.equal(rendered.outputPath, outputPath);
      assert.equal(rendered.renderKind, 'template');
      assert.notEqual(rendered.templateId, GENERIC_MARKDOWN_TEMPLATE_ID);
      assert.ok(rendered.content.startsWith(GENERATED_FILE_MARKER));
      assert.ok(rendered.content.includes('sample-project'));
    }
  });

  it('falls back to the generic template for unregistered documents', () => {
    const knowledge = buildKnowledge([buildPlannedDocument('change-log.md')]);
    const rendered = renderDocumentWithTemplate(buildPlannedDocument('change-log.md'), knowledge);

    assert.equal(rendered.renderKind, 'generic');
    assert.equal(rendered.templateId, GENERIC_MARKDOWN_TEMPLATE_ID);
    assert.ok(rendered.content.startsWith(GENERATED_FILE_MARKER));
  });

  it('renders the full documentation plan without writing files', () => {
    const documents = [
      buildPlannedDocument('architecture.md'),
      buildPlannedDocument('README.md'),
    ];
    const knowledge = buildKnowledge(documents);
    const renderedDocuments = renderDocumentationPlan(knowledge);

    assert.equal(renderedDocuments.length, 2);
    assert.equal(renderedDocuments[0]?.templateId, 'markdown.architecture');
    assert.equal(renderedDocuments[1]?.templateId, GENERIC_MARKDOWN_TEMPLATE_ID);
  });

  it('uses the passed planned document metadata for registered templates', () => {
    const customDocument: PlannedDocument = {
      title: 'Custom Architecture Title',
      relativePath: 'architecture.md',
      purpose: 'Custom architecture purpose',
      priority: 'required',
      source: 'core',
    };
    const knowledge = buildKnowledge([buildPlannedDocument('README.md')]);
    const rendered = renderDocumentWithTemplate(customDocument, knowledge);

    assert.equal(rendered.renderKind, 'template');
    assert.ok(rendered.content.includes('Custom Architecture Title'));
    assert.ok(rendered.content.includes('Custom architecture purpose'));
  });

  it('renderDocumentationPlan honors custom document metadata outside the plan', () => {
    const customArchitecture: PlannedDocument = {
      title: 'Alternate Architecture',
      relativePath: 'architecture.md',
      purpose: 'Alternate architecture purpose',
      priority: 'required',
      source: 'core',
    };
    const knowledge = buildKnowledge([buildPlannedDocument('README.md')]);
    const renderedDocuments = renderDocumentationPlan(knowledge, [customArchitecture]);

    assert.equal(renderedDocuments.length, 1);
    assert.ok(renderedDocuments[0]?.content.includes('Alternate Architecture'));
    assert.ok(renderedDocuments[0]?.content.includes('Alternate architecture purpose'));
  });
});
