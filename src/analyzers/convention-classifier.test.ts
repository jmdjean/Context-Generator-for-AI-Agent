import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConventionDetectionInput,
  detectDocumentationConventions,
  detectPackageManagerConventions,
  detectRepositoryStructureConventions,
  detectTestingConventions,
  parsePackageJsonTestScript,
  parseTsconfigSignals,
  sortConventions,
} from './convention-classifier';
import { ConventionKnowledge } from '../knowledge/project-knowledge';

function createInput(overrides: Partial<ConventionDetectionInput> = {}): ConventionDetectionInput {
  return {
    docsDir: '.ai-docs',
    filePaths: new Set<string>(),
    folderPaths: new Set<string>(),
    detectedFiles: [],
    languages: [],
    packageManagers: [],
    modules: [],
    ...overrides,
  };
}

describe('parseTsconfigSignals', () => {
  it('detects strict mode from plain JSON', () => {
    const signals = parseTsconfigSignals('{"compilerOptions":{"strict":true}}');
    assert.deepEqual(signals, { parsed: true, strict: true });
  });

  it('detects strict mode from JSON with comments and trailing commas', () => {
    const text = `{
      // compiler settings
      "compilerOptions": {
        /* strict family */
        "strict": true,
      },
    }`;
    assert.deepEqual(parseTsconfigSignals(text), { parsed: true, strict: true });
  });

  it('reports strict false when the flag is absent or disabled', () => {
    assert.deepEqual(parseTsconfigSignals('{"compilerOptions":{}}'), {
      parsed: true,
      strict: false,
    });
    assert.deepEqual(parseTsconfigSignals('{"compilerOptions":{"strict":false}}'), {
      parsed: true,
      strict: false,
    });
  });

  it('degrades gracefully on unreadable input', () => {
    assert.deepEqual(parseTsconfigSignals(undefined), { parsed: false, strict: false });
    assert.deepEqual(parseTsconfigSignals('not json'), { parsed: false, strict: false });
  });
});

describe('parsePackageJsonTestScript', () => {
  it('returns the test script when defined', () => {
    const text = '{"scripts":{"test":"node --test"}}';
    assert.equal(parsePackageJsonTestScript(text), 'node --test');
  });

  it('returns undefined when missing or empty', () => {
    assert.equal(parsePackageJsonTestScript('{"scripts":{}}'), undefined);
    assert.equal(parsePackageJsonTestScript('{"scripts":{"test":"  "}}'), undefined);
    assert.equal(parsePackageJsonTestScript(undefined), undefined);
  });
});

describe('detectRepositoryStructureConventions', () => {
  it('emits one convention per known structural folder present in the tree', () => {
    const conventions = detectRepositoryStructureConventions(
      createInput({ folderPaths: new Set(['src', 'src/domain', 'src/unrelated']) }),
    );

    assert.equal(conventions.length, 2);
    for (const convention of conventions) {
      assert.equal(convention.category, 'repository-structure');
      assert.equal(convention.confidence, 'high');
      assert.equal(convention.evidence[0]?.type, 'folder');
    }
  });
});

describe('detectPackageManagerConventions', () => {
  it('prefers pnpm over npm when both are detected', () => {
    const conventions = detectPackageManagerConventions(
      createInput({ packageManagers: ['npm', 'pnpm'] }),
    );

    assert.equal(conventions.length, 1);
    assert.equal(conventions[0]?.name, 'Dependencies managed with pnpm');
    assert.equal(conventions[0]?.confidence, 'high');
  });
});

describe('detectTestingConventions', () => {
  it('detects dedicated test folders', () => {
    const conventions = detectTestingConventions(
      createInput({ folderPaths: new Set(['tests', 'src/feature/__tests__']) }),
    );

    const folders = conventions.find((convention) => convention.name === 'Dedicated test folders');
    assert.ok(folders);
    assert.equal(folders.evidence.length, 2);
  });

  it('detects co-located spec and test files', () => {
    const conventions = detectTestingConventions(
      createInput({ filePaths: new Set(['src/a.spec.ts', 'src/b.test.js', 'src/c.ts']) }),
    );

    const coLocated = conventions.find((convention) => convention.name === 'Co-located test files');
    assert.ok(coLocated);
    assert.equal(coLocated.confidence, 'high');
    assert.equal(coLocated.evidence.length, 2);
  });
});

describe('detectDocumentationConventions', () => {
  it('reports expected generated context with medium confidence when absent from the tree', () => {
    const conventions = detectDocumentationConventions(createInput());
    const expected = conventions.find(
      (convention) => convention.name === 'Generated context folder expected',
    );

    assert.ok(expected);
    assert.equal(expected.confidence, 'medium');
    assert.equal(expected.evidence[0]?.type, 'knowledge');
  });

  it('reports the generated context folder as present when detected at top level', () => {
    const conventions = detectDocumentationConventions(
      createInput({ detectedFiles: ['.ai-docs'] }),
    );
    const present = conventions.find(
      (convention) => convention.name === 'Generated context folder present',
    );

    assert.ok(present);
    assert.equal(present.confidence, 'high');
  });
});

describe('sortConventions', () => {
  it('orders by category rank then name', () => {
    const convention = (category: ConventionKnowledge['category'], name: string): ConventionKnowledge => ({
      category,
      name,
      description: '',
      evidence: [],
      confidence: 'high',
    });

    const sorted = sortConventions([
      convention('documentation', 'B doc'),
      convention('language', 'Z lang'),
      convention('documentation', 'A doc'),
    ]);

    assert.deepEqual(
      sorted.map((entry) => entry.name),
      ['Z lang', 'A doc', 'B doc'],
    );
  });
});
