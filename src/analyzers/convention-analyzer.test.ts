import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RepositoryNode } from '../domain';
import { ModuleKnowledge, ProjectKnowledge } from '../knowledge/project-knowledge';
import { analyzeConventions, enrichProjectKnowledgeWithConventions } from './convention-analyzer';

function fileNode(rootPath: string, relativePath: string): RepositoryNode {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    path: path.join(rootPath, relativePath),
    relativePath,
    type: 'file',
  };
}

function directoryNode(
  rootPath: string,
  relativePath: string,
  children: RepositoryNode[] = [],
): RepositoryNode {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    path: path.join(rootPath, relativePath),
    relativePath,
    type: 'directory',
    children,
  };
}

function createModule(relativePath: string, confidence: ModuleKnowledge['confidence'] = 'high'): ModuleKnowledge {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    path: relativePath,
    relativePath,
    type: 'core',
    responsibility: 'test responsibility',
    importantFiles: [],
    relatedFolders: [],
    signals: [],
    confidence,
  };
}

function createKnowledge(rootPath: string, tree: RepositoryNode | undefined, options: {
  packageManagers?: string[];
  languages?: string[];
  modules?: ModuleKnowledge[];
  detectedFiles?: string[];
} = {}): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: path.basename(rootPath),
      docsDir: '.ai-docs',
    },
    repository: {
      name: path.basename(rootPath),
      rootPath,
      detectedFiles: options.detectedFiles ?? [],
      ignoredPaths: [],
      repositoryTree: tree,
    },
    technologies: {
      languages: options.languages ?? ['TypeScript'],
      frameworks: [],
      packageManagers: options.packageManagers ?? ['npm'],
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
      modules: options.modules,
    },
  };
}

function createProjectFixture(): { rootPath: string; tree: RepositoryNode } {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-analyzer-'));

  fs.writeFileSync(
    path.join(rootPath, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true } }),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(rootPath, 'package.json'),
    JSON.stringify({ name: 'fixture', scripts: { test: 'node --test' } }),
    'utf-8',
  );

  const tree = directoryNode(rootPath, '', [
    fileNode(rootPath, 'README.md'),
    fileNode(rootPath, 'AGENTS.md'),
    fileNode(rootPath, 'tsconfig.json'),
    fileNode(rootPath, 'package.json'),
    directoryNode(rootPath, 'docs'),
    directoryNode(rootPath, 'src', [
      directoryNode(rootPath, 'src/domain'),
      directoryNode(rootPath, 'src/core'),
      directoryNode(rootPath, 'src/analyzers', [
        fileNode(rootPath, 'src/analyzers/convention-analyzer.test.ts'),
      ]),
      directoryNode(rootPath, 'src/knowledge'),
    ]),
  ]);
  tree.name = path.basename(rootPath);

  return { rootPath, tree };
}

describe('convention-analyzer', () => {
  it('detects documentation, structure, language, testing, and package manager conventions', () => {
    const { rootPath, tree } = createProjectFixture();

    try {
      const knowledge = createKnowledge(rootPath, tree);
      const result = analyzeConventions(knowledge);
      const names = result.conventions.map((convention) => convention.name);

      assert.ok(names.includes('Root README'));
      assert.ok(names.includes('Agent instructions file'));
      assert.ok(names.includes('Human documentation folder'));
      assert.ok(names.includes('Source code under src/'));
      assert.ok(names.includes('Domain types under src/domain'));
      assert.ok(names.includes('PKM under src/knowledge'));
      assert.ok(names.includes('TypeScript project'));
      assert.ok(names.includes('TypeScript strict mode'));
      assert.ok(names.includes('Dependencies managed with npm'));
      assert.ok(names.includes('Co-located test files'));
      assert.ok(names.includes('Package test script'));

      assert.equal(result.totalConventions, result.conventions.length);
      assert.equal(
        result.totalConventions,
        result.highConfidenceConventions +
          result.mediumConfidenceConventions +
          result.lowConfidenceConventions,
      );
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('attaches evidence to every convention', () => {
    const { rootPath, tree } = createProjectFixture();

    try {
      const result = analyzeConventions(createKnowledge(rootPath, tree));

      for (const convention of result.conventions) {
        assert.ok(convention.evidence.length > 0, `${convention.name} has no evidence`);
        for (const evidence of convention.evidence) {
          assert.ok(evidence.type.length > 0);
          assert.ok(evidence.source.length > 0);
          assert.ok(evidence.detail.length > 0);
        }
      }
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('detects strict mode from tsconfig.json via safe read', () => {
    const { rootPath, tree } = createProjectFixture();

    try {
      const result = analyzeConventions(createKnowledge(rootPath, tree));
      const strict = result.conventions.find(
        (convention) => convention.name === 'TypeScript strict mode',
      );

      assert.ok(strict);
      assert.equal(strict.confidence, 'high');
      assert.deepEqual(strict.evidence, [
        {
          type: 'config',
          source: 'tsconfig.json',
          detail: 'compilerOptions.strict is enabled',
        },
      ]);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('skips the strict mode convention when strict is disabled', () => {
    const { rootPath, tree } = createProjectFixture();

    try {
      fs.writeFileSync(
        path.join(rootPath, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { strict: false } }),
        'utf-8',
      );

      const result = analyzeConventions(createKnowledge(rootPath, tree));
      const names = result.conventions.map((convention) => convention.name);

      assert.ok(names.includes('TypeScript project'));
      assert.ok(!names.includes('TypeScript strict mode'));
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('reports an unknown package manager with low confidence', () => {
    const { rootPath, tree } = createProjectFixture();

    try {
      const result = analyzeConventions(
        createKnowledge(rootPath, tree, { packageManagers: [] }),
      );
      const unknown = result.conventions.find(
        (convention) => convention.name === 'Unknown package manager',
      );

      assert.ok(unknown);
      assert.equal(unknown.confidence, 'low');
      assert.equal(unknown.category, 'package-management');
      assert.ok(result.lowConfidenceConventions >= 1);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('derives architecture conventions from module knowledge', () => {
    const { rootPath, tree } = createProjectFixture();

    try {
      const result = analyzeConventions(
        createKnowledge(rootPath, tree, {
          modules: [createModule('src/core'), createModule('src/domain', 'medium')],
        }),
      );

      const core = result.conventions.find(
        (convention) => convention.name === 'src/core orchestrates the pipeline',
      );
      const domain = result.conventions.find(
        (convention) => convention.name === 'src/domain remains pure',
      );

      assert.ok(core);
      assert.equal(core.confidence, 'high');
      assert.equal(core.evidence[0]?.type, 'module');
      assert.equal(core.evidence[0]?.source, 'src/core');

      assert.ok(domain);
      assert.equal(domain.confidence, 'medium');
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('always reports generated-context conventions from the PKM', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-analyzer-empty-'));

    try {
      const result = analyzeConventions(createKnowledge(rootPath, undefined));
      const generatedContext = result.conventions.filter(
        (convention) => convention.category === 'generated-context',
      );

      assert.equal(generatedContext.length, 4);
      for (const convention of generatedContext) {
        assert.equal(convention.confidence, 'high');
        assert.equal(convention.evidence[0]?.type, 'knowledge');
      }
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('enrichProjectKnowledgeWithConventions returns a new object and preserves the input', () => {
    const { rootPath, tree } = createProjectFixture();

    try {
      const knowledge = createKnowledge(rootPath, tree);
      const { knowledge: enriched, result } = enrichProjectKnowledgeWithConventions(knowledge);

      assert.notEqual(enriched, knowledge);
      assert.equal(knowledge.analysis.conventions, undefined);
      assert.ok(enriched.analysis.conventions);
      assert.equal(enriched.analysis.conventions.length, result.totalConventions);
      assert.equal(enriched.analysis.status, 'partial');
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });
});
