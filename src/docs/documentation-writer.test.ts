import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { ProjectKnowledge } from '../knowledge';
import { PlannedDocument } from '../domain/documentation-plan';
import { GENERATED_FILE_MARKER } from './document-template';
import { writeDocumentation } from './documentation-writer';

function buildPlannedDocument(relativePath: string): PlannedDocument {
  return {
    title: relativePath,
    relativePath,
    purpose: 'Test purpose',
    priority: 'required',
    source: 'core',
  };
}

function buildKnowledge(rootPath: string, documents: PlannedDocument[]): ProjectKnowledge {
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
      rootPath,
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
    },
  };
}

describe('writeDocumentation', () => {
  it('skips unchanged generated documents when document impact is provided', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-writer-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });

    const originalArchitecture = `${GENERATED_FILE_MARKER}\n\n# Architecture v1`;
    const originalReadme = `${GENERATED_FILE_MARKER}\n\n# README v1`;
    fs.writeFileSync(path.join(docsPath, 'architecture.md'), originalArchitecture, 'utf-8');
    fs.writeFileSync(path.join(docsPath, 'README.md'), originalReadme, 'utf-8');

    const knowledge = buildKnowledge(rootPath, [
      buildPlannedDocument('README.md'),
      buildPlannedDocument('architecture.md'),
    ]);

    const result = writeDocumentation(knowledge, {
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
    });

    assert.equal(result.writtenCount, 1);
    assert.equal(result.skippedUnchangedCount, 1);
    assert.deepEqual(result.writtenPaths, ['architecture.md']);
    assert.deepEqual(result.skippedUnchangedPaths, ['README.md']);
    assert.equal(fs.readFileSync(path.join(docsPath, 'README.md'), 'utf-8'), originalReadme);
    assert.notEqual(fs.readFileSync(path.join(docsPath, 'architecture.md'), 'utf-8'), originalArchitecture);
  });

  it('treats BOM-prefixed generated files as tool-managed during selective regeneration', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-writer-bom-'));
    const docsPath = path.join(rootPath, '.ai-docs');
    fs.mkdirSync(docsPath, { recursive: true });

    const originalReadme = `\uFEFF${GENERATED_FILE_MARKER}\n\n# README v1`;
    fs.writeFileSync(path.join(docsPath, 'README.md'), originalReadme, 'utf-8');

    const knowledge = buildKnowledge(rootPath, [buildPlannedDocument('README.md')]);
    const result = writeDocumentation(knowledge, {
      impactedDocuments: [
        {
          documentPath: 'README.md',
          reason: 'Detected files changed',
          impactedBy: ['detectedFiles'],
          shouldRegenerate: true,
        },
      ],
      unchangedDocuments: [],
      generatedAt: '2026-01-02T00:00:00.000Z',
    });

    assert.equal(result.writtenCount, 1);
    assert.equal(result.skippedProtectedCount, 0);
    assert.notEqual(fs.readFileSync(path.join(docsPath, 'README.md'), 'utf-8'), originalReadme);
  });

  it('creates missing documents even when they are not in the impact summary', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-docs-writer-'));
    const knowledge = buildKnowledge(rootPath, [buildPlannedDocument('README.md')]);

    const result = writeDocumentation(knowledge, {
      impactedDocuments: [],
      unchangedDocuments: [],
      generatedAt: '2026-01-02T00:00:00.000Z',
    });

    assert.equal(result.writtenCount, 1);
    assert.equal(result.skippedUnchangedCount, 0);
    assert.match(
      fs.readFileSync(path.join(rootPath, '.ai-docs', 'README.md'), 'utf-8'),
      new RegExp(`^${GENERATED_FILE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
  });
});
