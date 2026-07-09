import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ProjectKnowledge } from '../knowledge';
import { PlannedDocument } from '../domain/documentation-plan';
import { GENERATED_FILE_MARKER } from './document-template';
import { validateDocumentation } from './documentation-validator';

function buildPlannedDocument(relativePath: string): PlannedDocument {
  return {
    title: `Test ${relativePath}`,
    relativePath,
    purpose: 'Test purpose',
    priority: 'required',
    source: 'core',
  };
}

function buildKnowledge(rootPath: string, documentPaths: string[]): ProjectKnowledge {
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
        documents: documentPaths.map(buildPlannedDocument),
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'partial',
    },
  };
}

function createTempProject(): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-validator-test-'));
  fs.mkdirSync(path.join(rootPath, '.ai-docs'), { recursive: true });
  return rootPath;
}

function writeDoc(rootPath: string, relativePath: string, content: string): void {
  fs.writeFileSync(path.join(rootPath, '.ai-docs', relativePath), content, 'utf-8');
}

test('validateDocumentation passes when all planned documents are written with markers', () => {
  const rootPath = createTempProject();
  try {
    const knowledge = buildKnowledge(rootPath, ['README.md', 'architecture.md']);
    writeDoc(rootPath, 'README.md', `${GENERATED_FILE_MARKER}\n\n# README\n\nContent.\n`);
    writeDoc(rootPath, 'architecture.md', `${GENERATED_FILE_MARKER}\n\n# Architecture\n\nContent.\n`);

    const result = validateDocumentation(knowledge);

    assert.equal(result.status, 'passed');
    assert.equal(result.documentsChecked, 2);
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 0);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test('validateDocumentation fails when a planned document is missing', () => {
  const rootPath = createTempProject();
  try {
    const knowledge = buildKnowledge(rootPath, ['README.md', 'missing.md']);
    writeDoc(rootPath, 'README.md', `${GENERATED_FILE_MARKER}\n\n# README\n`);

    const result = validateDocumentation(knowledge);

    assert.equal(result.status, 'failed');
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].documentPath, 'missing.md');
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test('validateDocumentation fails when a document exists but is empty', () => {
  const rootPath = createTempProject();
  try {
    const knowledge = buildKnowledge(rootPath, ['README.md']);
    writeDoc(rootPath, 'README.md', '   \n');

    const result = validateDocumentation(knowledge);

    assert.equal(result.status, 'failed');
    assert.equal(result.errors.length, 1);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test('validateDocumentation warns for user-managed documents without failing', () => {
  const rootPath = createTempProject();
  try {
    const knowledge = buildKnowledge(rootPath, ['README.md']);
    writeDoc(rootPath, 'README.md', '# My own README\n\nHand-written content.\n');

    const result = validateDocumentation(knowledge);

    assert.equal(result.status, 'passed');
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].documentPath, 'README.md');
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test('validateDocumentation warns when a generated document has no heading', () => {
  const rootPath = createTempProject();
  try {
    const knowledge = buildKnowledge(rootPath, ['README.md']);
    writeDoc(rootPath, 'README.md', `${GENERATED_FILE_MARKER}\n\nContent without a title.\n`);

    const result = validateDocumentation(knowledge);

    assert.equal(result.status, 'passed');
    assert.equal(result.warnings.length, 1);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});
