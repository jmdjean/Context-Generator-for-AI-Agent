import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ProjectKnowledge } from '../knowledge/project-knowledge';
import { createRepositoryBoundary } from '../scanner/repository-boundary';
import {
  analyzeOperationalContext,
  enrichProjectKnowledgeWithOperationalContext,
  extractDescriptionFromPackageJson,
  extractEnvKeysFromTemplate,
  extractPurposeFromReadme,
  extractRunCommandsFromPackageJson,
} from './operational-context-analyzer';

function createKnowledge(rootPath: string): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'sample',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'sample',
      rootPath,
      detectedFiles: [],
      ignoredPaths: [],
      repositoryTree: {
        name: 'sample',
        path: rootPath,
        relativePath: '',
        type: 'directory',
        children: [],
      },
    },
    technologies: {
      languages: [],
      frameworks: [],
      packageManagers: [],
      tooling: [],
      confidence: 'low',
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
      status: 'pending',
      modules: [
        {
          name: 'sample',
          path: rootPath,
          relativePath: '.',
          type: 'application',
          responsibility: 'Root app',
          importantFiles: ['package.json'],
          relatedFolders: [],
          signals: [],
          confidence: 'high',
        },
        {
          name: '.ai-docs',
          path: path.join(rootPath, '.ai-docs'),
          relativePath: '.ai-docs',
          type: 'documentation',
          responsibility: 'Generated docs',
          importantFiles: [],
          relatedFolders: [],
          signals: [],
          confidence: 'high',
        },
      ],
    },
  };
}

describe('operational-context extractors', () => {
  it('extracts the first meaningful README paragraph and skips headings/badges', () => {
    const purpose = extractPurposeFromReadme(`# Title

[![ci](https://example.com/badge.svg)](https://example.com)

Bridge server for desktop clients.

## More

Ignored second section.
`);
    assert.equal(purpose, 'Bridge server for desktop clients.');
  });

  it('extracts package.json description and scripts without inventing commands', () => {
    assert.equal(
      extractDescriptionFromPackageJson('{"description":"  Useful tool  "}'),
      'Useful tool',
    );
    assert.deepEqual(
      extractRunCommandsFromPackageJson(
        '{"scripts":{"test":"node --test","start":"node src/index.js"}}',
        'package.json',
        '.',
      ),
      [
        {
          name: 'start',
          command: 'node src/index.js',
          source: 'package.json',
          moduleRelativePath: '.',
        },
        {
          name: 'test',
          command: 'node --test',
          source: 'package.json',
          moduleRelativePath: '.',
        },
      ],
    );
    assert.deepEqual(extractRunCommandsFromPackageJson('{"name":"x"}', 'package.json'), []);
  });

  it('extracts env keys only from dotenv templates', () => {
    const vars = extractEnvKeysFromTemplate(
      `# comment
PORT=3000
export DATABASE_URL=secret-should-not-leak
INVALID
EMPTY=
`,
      '.env.example',
    );
    assert.deepEqual(vars, [
      { key: 'DATABASE_URL', source: '.env.example' },
      { key: 'EMPTY', source: '.env.example' },
      { key: 'PORT', source: '.env.example' },
    ]);
    assert.equal(vars.every((entry) => !JSON.stringify(entry).includes('secret')), true);
  });
});

describe('operational-context-analyzer', () => {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'operational-context-'));

  after(() => {
    fs.rmSync(rootPath, { recursive: true, force: true });
  });

  it('returns undefined operationalContext when allowlisted signals are absent', () => {
    const knowledge = createKnowledge(rootPath);
    const result = analyzeOperationalContext(knowledge, {
      boundary: createRepositoryBoundary(rootPath),
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    assert.equal(result.operationalContext, undefined);
    assert.equal(result.purposeFound, false);
    assert.equal(result.runCommandCount, 0);
    assert.equal(result.envVarCount, 0);
  });

  it('builds operationalContext from README, package scripts, and env template keys', () => {
    fs.writeFileSync(
      path.join(rootPath, 'README.md'),
      '# Sample\n\nOperates the sample bridge.\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(rootPath, 'package.json'),
      JSON.stringify({
        name: 'sample',
        description: 'Fallback description',
        scripts: { start: 'node src/index.js', test: 'node --test' },
      }),
      'utf-8',
    );
    fs.writeFileSync(path.join(rootPath, '.env.example'), 'API_KEY=\nPORT=3000\n', 'utf-8');

    const knowledge = createKnowledge(rootPath);
    knowledge.repository.detectedFiles = ['README.md', 'package.json', '.env.example'];
    knowledge.repository.repositoryTree = {
      name: 'sample',
      path: rootPath,
      relativePath: '',
      type: 'directory',
      children: [
        {
          name: 'README.md',
          path: path.join(rootPath, 'README.md'),
          relativePath: 'README.md',
          type: 'file',
        },
        {
          name: 'package.json',
          path: path.join(rootPath, 'package.json'),
          relativePath: 'package.json',
          type: 'file',
        },
        {
          name: '.env.example',
          path: path.join(rootPath, '.env.example'),
          relativePath: '.env.example',
          type: 'file',
        },
        {
          name: 'apps',
          path: path.join(rootPath, 'apps'),
          relativePath: 'apps',
          type: 'directory',
          children: [
            {
              name: 'api',
              path: path.join(rootPath, 'apps', 'api'),
              relativePath: 'apps/api',
              type: 'directory',
              children: [
                {
                  name: 'package.json',
                  path: path.join(rootPath, 'apps', 'api', 'package.json'),
                  relativePath: 'apps/api/package.json',
                  type: 'file',
                },
              ],
            },
          ],
        },
      ],
    };

    fs.mkdirSync(path.join(rootPath, 'apps', 'api'), { recursive: true });
    fs.writeFileSync(
      path.join(rootPath, 'apps', 'api', 'package.json'),
      JSON.stringify({ scripts: { serve: 'node server.js' } }),
      'utf-8',
    );

    knowledge.analysis.modules = [
      ...(knowledge.analysis.modules ?? []),
      {
        name: 'api',
        path: path.join(rootPath, 'apps', 'api'),
        relativePath: 'apps/api',
        type: 'application',
        responsibility: 'API',
        importantFiles: ['apps/api/package.json'],
        relatedFolders: [],
        signals: [],
        confidence: 'high',
      },
    ];

    const { knowledge: enriched, result } = enrichProjectKnowledgeWithOperationalContext(knowledge, {
      boundary: createRepositoryBoundary(rootPath),
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    assert.ok(result.operationalContext);
    assert.equal(result.operationalContext.purpose, 'Operates the sample bridge.');
    assert.equal(result.runCommandCount, 3);
    assert.ok(result.operationalContext.runCommands?.some((command) => command.name === 'start'));
    assert.ok(
      result.operationalContext.runCommands?.some(
        (command) => command.name === 'serve' && command.moduleRelativePath === 'apps/api',
      ),
    );
    assert.deepEqual(
      result.operationalContext.envVars?.map((entry) => entry.key),
      ['API_KEY', 'PORT'],
    );
    assert.equal(enriched.analysis.operationalContext?.confidence, 'high');
    assert.equal(enriched.analysis.status, 'partial');
  });

  it('falls back to package.json description when README has no prose', () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'operational-context-desc-'));
    try {
      fs.writeFileSync(path.join(emptyRoot, 'README.md'), '# Only Title\n', 'utf-8');
      fs.writeFileSync(
        path.join(emptyRoot, 'package.json'),
        JSON.stringify({ description: 'From package manifest' }),
        'utf-8',
      );

      const knowledge = createKnowledge(emptyRoot);
      knowledge.repository.detectedFiles = ['README.md', 'package.json'];
      knowledge.repository.repositoryTree = {
        name: 'sample',
        path: emptyRoot,
        relativePath: '',
        type: 'directory',
        children: [
          {
            name: 'README.md',
            path: path.join(emptyRoot, 'README.md'),
            relativePath: 'README.md',
            type: 'file',
          },
          {
            name: 'package.json',
            path: path.join(emptyRoot, 'package.json'),
            relativePath: 'package.json',
            type: 'file',
          },
        ],
      };

      const result = analyzeOperationalContext(knowledge, {
        boundary: createRepositoryBoundary(emptyRoot),
        generatedAt: '2026-01-01T00:00:00.000Z',
      });

      assert.equal(result.operationalContext?.purpose, 'From package manifest');
      assert.ok(result.operationalContext?.signals.includes('purpose:package.json#description'));
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
