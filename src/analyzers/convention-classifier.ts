import {
  ConventionCategory,
  ConventionConfidence,
  ConventionEvidence,
  ConventionKnowledge,
  ModuleKnowledge,
} from '../knowledge/project-knowledge';
import { TEST_FILE_PATTERN, TEST_FOLDER_NAMES, normalizeFolderName } from './folder-constants';

export interface ConventionDetectionInput {
  docsDir: string;
  filePaths: ReadonlySet<string>;
  folderPaths: ReadonlySet<string>;
  detectedFiles: readonly string[];
  languages: readonly string[];
  packageManagers: readonly string[];
  modules: readonly ModuleKnowledge[];
  tsconfigText?: string;
  packageJsonText?: string;
}

export const CONVENTION_CATEGORY_ORDER: readonly ConventionCategory[] = [
  'language',
  'package-management',
  'repository-structure',
  'architecture',
  'testing',
  'documentation',
  'generated-context',
  'tooling',
  'unknown',
];

export interface StructureConventionRule {
  path: string;
  name: string;
  description: string;
}

export const STRUCTURE_CONVENTION_RULES: readonly StructureConventionRule[] = [
  {
    path: 'src',
    name: 'Source code under src/',
    description: 'Application source code lives under the src/ directory.',
  },
  {
    path: 'src/domain',
    name: 'Domain types under src/domain',
    description: 'Pure domain types and the declarative pipeline live under src/domain.',
  },
  {
    path: 'src/core',
    name: 'Pipeline orchestration under src/core',
    description: 'Pipeline orchestration and step handlers live under src/core.',
  },
  {
    path: 'src/analyzers',
    name: 'Deterministic analyzers under src/analyzers',
    description: 'Deterministic PKM enrichment analyzers live under src/analyzers.',
  },
  {
    path: 'src/knowledge',
    name: 'PKM under src/knowledge',
    description: 'The Project Knowledge Model types, builder, and persistence live under src/knowledge.',
  },
  {
    path: 'src/docs',
    name: 'Documentation generation under src/docs',
    description: 'Documentation planning and writing live under src/docs.',
  },
  {
    path: 'src/detectors',
    name: 'Technology detection under src/detectors',
    description: 'Technology detection lives under src/detectors.',
  },
  {
    path: 'src/scanner',
    name: 'Repository scanning under src/scanner',
    description: 'Repository loading and scanning live under src/scanner.',
  },
];

export interface ArchitectureConventionRule {
  name: string;
  description: string;
}

export const ARCHITECTURE_CONVENTION_RULES: Readonly<Record<string, ArchitectureConventionRule>> = {
  'src/core': {
    name: 'src/core orchestrates the pipeline',
    description: 'The core module drives pipeline execution and coordinates every stage.',
  },
  'src/domain': {
    name: 'src/domain remains pure',
    description: 'The domain module contains only types and declarative data — no runtime behavior.',
  },
  'src/knowledge': {
    name: 'src/knowledge owns the PKM',
    description: 'The knowledge module defines, assembles, and persists the Project Knowledge Model.',
  },
  'src/analyzers': {
    name: 'src/analyzers consume the PKM',
    description: 'Analyzers enrich the PKM deterministically without re-scanning the repository.',
  },
  'src/docs': {
    name: 'src/docs writes derived output',
    description: 'The docs module plans and renders documentation generated from the PKM.',
  },
  'src/scanner': {
    name: 'src/scanner feeds upstream knowledge',
    description: 'The scanner reads the repository from disk and supplies the structural baseline.',
  },
  'src/detectors': {
    name: 'src/detectors feed upstream knowledge',
    description: 'Detectors identify the technology stack that informs downstream analysis.',
  },
};

export const KNOWN_PACKAGE_MANAGERS: readonly string[] = ['pnpm', 'yarn', 'bun', 'npm'];

const MAX_TEST_FILE_EVIDENCE = 3;
const MAX_TEST_FOLDER_EVIDENCE = 3;

function createConvention(
  category: ConventionCategory,
  name: string,
  description: string,
  evidence: ConventionEvidence[],
  confidence: ConventionConfidence,
): ConventionKnowledge {
  return { category, name, description, evidence, confidence };
}

function stripJsonComments(text: string): string {
  let result = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === '\\' && next !== undefined) {
        result += next;
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function parseJsonConfig(text: string): Record<string, unknown> | undefined {
  try {
    const withoutComments = stripJsonComments(text);
    const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, '$1');
    const parsed: unknown = JSON.parse(withoutTrailingCommas);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export interface TsconfigConventionSignals {
  parsed: boolean;
  strict: boolean;
}

export function parseTsconfigSignals(tsconfigText: string | undefined): TsconfigConventionSignals {
  if (tsconfigText === undefined) {
    return { parsed: false, strict: false };
  }

  const config = parseJsonConfig(tsconfigText);
  if (config === undefined) {
    return { parsed: false, strict: false };
  }

  const compilerOptions = config['compilerOptions'];
  const strict =
    typeof compilerOptions === 'object' &&
    compilerOptions !== null &&
    (compilerOptions as Record<string, unknown>)['strict'] === true;

  return { parsed: true, strict };
}

export function parsePackageJsonTestScript(packageJsonText: string | undefined): string | undefined {
  if (packageJsonText === undefined) {
    return undefined;
  }

  const config = parseJsonConfig(packageJsonText);
  if (config === undefined) {
    return undefined;
  }

  const scripts = config['scripts'];
  if (typeof scripts !== 'object' || scripts === null) {
    return undefined;
  }

  const testScript = (scripts as Record<string, unknown>)['test'];
  return typeof testScript === 'string' && testScript.trim().length > 0 ? testScript : undefined;
}

export function detectDocumentationConventions(
  input: ConventionDetectionInput,
): ConventionKnowledge[] {
  const conventions: ConventionKnowledge[] = [];

  if (input.filePaths.has('README.md')) {
    conventions.push(
      createConvention(
        'documentation',
        'Root README',
        'The repository documents itself with a root README.md.',
        [{ type: 'file', source: 'README.md', detail: 'Repository contains a root README.md' }],
        'high',
      ),
    );
  }

  if (input.filePaths.has('AGENTS.md')) {
    conventions.push(
      createConvention(
        'documentation',
        'Agent instructions file',
        'AGENTS.md provides mandatory entry-point context for AI coding agents.',
        [{ type: 'file', source: 'AGENTS.md', detail: 'Repository contains a root AGENTS.md' }],
        'high',
      ),
    );
  }

  if (input.folderPaths.has('docs')) {
    conventions.push(
      createConvention(
        'documentation',
        'Human documentation folder',
        'Project-level documentation for humans and agents lives under docs/.',
        [{ type: 'folder', source: 'docs', detail: 'Repository tree contains a docs/ folder' }],
        'high',
      ),
    );
  }

  const docsDir = input.docsDir;
  const docsDirInTree = input.folderPaths.has(docsDir);
  const docsDirDetected = input.detectedFiles.includes(docsDir);

  if (docsDirInTree || docsDirDetected) {
    conventions.push(
      createConvention(
        'documentation',
        'Generated context folder present',
        `The repository contains the ${docsDir}/ generated context folder.`,
        [
          docsDirInTree
            ? {
                type: 'folder',
                source: docsDir,
                detail: `Repository tree contains ${docsDir}/`,
              }
            : {
                type: 'folder',
                source: docsDir,
                detail: `Top-level entry ${docsDir} detected in repository metadata`,
              },
        ],
        'high',
      ),
    );
  } else {
    conventions.push(
      createConvention(
        'documentation',
        'Generated context folder expected',
        `The documentation plan creates the ${docsDir}/ generated context folder on write.`,
        [
          {
            type: 'knowledge',
            source: 'documentation.plan.docsDir',
            detail: `Documentation plan targets ${docsDir}`,
          },
        ],
        'medium',
      ),
    );
  }

  const knowledgeDir = `${docsDir}/knowledge`;
  const knowledgeDirInTree = input.folderPaths.has(knowledgeDir);
  conventions.push(
    createConvention(
      'documentation',
      knowledgeDirInTree ? 'Knowledge folder present' : 'Knowledge folder expected',
      `Machine-readable project knowledge lives under ${knowledgeDir}/.`,
      [
        knowledgeDirInTree
          ? {
              type: 'folder',
              source: knowledgeDir,
              detail: `Repository tree contains ${knowledgeDir}/`,
            }
          : {
              type: 'knowledge',
              source: knowledgeDir,
              detail: `PKM persistence writes knowledge JSON into ${knowledgeDir}/`,
            },
      ],
      knowledgeDirInTree ? 'high' : 'medium',
    ),
  );

  const knowledgeSnapshot = `${knowledgeDir}/project-knowledge.json`;
  const snapshotInTree = input.filePaths.has(knowledgeSnapshot);
  conventions.push(
    createConvention(
      'documentation',
      snapshotInTree ? 'Knowledge JSON present' : 'Knowledge JSON expected',
      `The full PKM snapshot is persisted as ${knowledgeSnapshot}.`,
      [
        snapshotInTree
          ? {
              type: 'file',
              source: knowledgeSnapshot,
              detail: `Repository tree contains ${knowledgeSnapshot}`,
            }
          : {
              type: 'knowledge',
              source: knowledgeSnapshot,
              detail: 'The Persist Project Knowledge step writes this file on every run',
            },
      ],
      snapshotInTree ? 'high' : 'medium',
    ),
  );

  return conventions;
}

export function detectRepositoryStructureConventions(
  input: ConventionDetectionInput,
): ConventionKnowledge[] {
  return STRUCTURE_CONVENTION_RULES.filter((rule) => input.folderPaths.has(rule.path)).map(
    (rule) =>
      createConvention(
        'repository-structure',
        rule.name,
        rule.description,
        [
          {
            type: 'folder',
            source: rule.path,
            detail: `Repository tree contains ${rule.path}/`,
          },
        ],
        'high',
      ),
  );
}

export function detectTypeScriptConventions(
  input: ConventionDetectionInput,
): ConventionKnowledge[] {
  if (!input.filePaths.has('tsconfig.json')) {
    return [];
  }

  const conventions: ConventionKnowledge[] = [];
  const usageEvidence: ConventionEvidence[] = [
    {
      type: 'file',
      source: 'tsconfig.json',
      detail: 'Repository contains a root tsconfig.json',
    },
  ];

  const detectedTypeScript = input.languages.some(
    (language) => language.toLowerCase() === 'typescript',
  );
  if (detectedTypeScript) {
    usageEvidence.push({
      type: 'technology',
      source: 'technologies.languages',
      detail: 'Technology detection identified TypeScript',
    });
  }

  conventions.push(
    createConvention(
      'language',
      'TypeScript project',
      'The project is written in TypeScript with a root tsconfig.json.',
      usageEvidence,
      detectedTypeScript ? 'high' : 'medium',
    ),
  );

  const signals = parseTsconfigSignals(input.tsconfigText);
  if (signals.parsed && signals.strict) {
    conventions.push(
      createConvention(
        'language',
        'TypeScript strict mode',
        'The TypeScript compiler runs with strict mode enabled; all code must satisfy strict checks.',
        [
          {
            type: 'config',
            source: 'tsconfig.json',
            detail: 'compilerOptions.strict is enabled',
          },
        ],
        'high',
      ),
    );
  }

  return conventions;
}

export function detectPackageManagerConventions(
  input: ConventionDetectionInput,
): ConventionKnowledge[] {
  const normalized = input.packageManagers.map((manager) => manager.toLowerCase());
  const packageManager = KNOWN_PACKAGE_MANAGERS.find((known) => normalized.includes(known));

  if (packageManager === undefined) {
    return [
      createConvention(
        'package-management',
        'Unknown package manager',
        'No known package manager was identified from repository metadata.',
        [
          {
            type: 'knowledge',
            source: 'technologies.packageManagers',
            detail: 'Technology detection found no known package manager',
          },
        ],
        'low',
      ),
    ];
  }

  return [
    createConvention(
      'package-management',
      `Dependencies managed with ${packageManager}`,
      `Dependencies are installed and scripts are run with ${packageManager}.`,
      [
        {
          type: 'technology',
          source: 'technologies.packageManagers',
          detail: `Technology detection identified ${packageManager}`,
        },
      ],
      'high',
    ),
  ];
}

function collectTestFileEvidence(filePaths: ReadonlySet<string>): ConventionEvidence[] {
  const matches = [...filePaths].filter((filePath) => TEST_FILE_PATTERN.test(filePath)).sort();
  return matches.slice(0, MAX_TEST_FILE_EVIDENCE).map((filePath) => ({
    type: 'file' as const,
    source: filePath,
    detail: 'Matches the co-located test file pattern (*.test.* / *.spec.*)',
  }));
}

function collectTestFolderEvidence(folderPaths: ReadonlySet<string>): ConventionEvidence[] {
  const matches = [...folderPaths]
    .filter((folderPath) => {
      const name = folderPath.split('/').pop() ?? '';
      return TEST_FOLDER_NAMES.has(normalizeFolderName(name));
    })
    .sort();
  return matches.slice(0, MAX_TEST_FOLDER_EVIDENCE).map((folderPath) => ({
    type: 'folder' as const,
    source: folderPath,
    detail: 'Folder name marks a dedicated test folder',
  }));
}

export function detectTestingConventions(input: ConventionDetectionInput): ConventionKnowledge[] {
  const conventions: ConventionKnowledge[] = [];

  const testFileEvidence = collectTestFileEvidence(input.filePaths);
  if (testFileEvidence.length > 0) {
    conventions.push(
      createConvention(
        'testing',
        'Co-located test files',
        'Tests are co-located with source files using *.test.* and *.spec.* naming.',
        testFileEvidence,
        'high',
      ),
    );
  }

  const testFolderEvidence = collectTestFolderEvidence(input.folderPaths);
  if (testFolderEvidence.length > 0) {
    conventions.push(
      createConvention(
        'testing',
        'Dedicated test folders',
        'Tests live in dedicated test folders (test, tests, __tests__, spec).',
        testFolderEvidence,
        'high',
      ),
    );
  }

  const testScript = parsePackageJsonTestScript(input.packageJsonText);
  if (testScript !== undefined) {
    conventions.push(
      createConvention(
        'testing',
        'Package test script',
        'Tests run through the package manager test script.',
        [
          {
            type: 'config',
            source: 'package.json',
            detail: `Defines a "test" script: ${testScript}`,
          },
        ],
        'medium',
      ),
    );
  }

  return conventions;
}

export function detectGeneratedContextConventions(
  input: ConventionDetectionInput,
): ConventionKnowledge[] {
  const docsDir = input.docsDir;
  const knowledgeDir = `${docsDir}/knowledge`;

  return [
    createConvention(
      'generated-context',
      'Generated docs live in the configured docs directory',
      `All generated documentation is written under ${docsDir}/ inside the target repository.`,
      [
        {
          type: 'knowledge',
          source: 'documentation.plan.docsDir',
          detail: `Documentation plan targets ${docsDir}`,
        },
      ],
      'high',
    ),
    createConvention(
      'generated-context',
      'Machine-readable knowledge lives under the knowledge directory',
      `Machine-readable knowledge JSON files are persisted under ${knowledgeDir}/.`,
      [
        {
          type: 'knowledge',
          source: knowledgeDir,
          detail: 'PKM persistence writes the full snapshot and split section files here',
        },
      ],
      'high',
    ),
    createConvention(
      'generated-context',
      'Markdown docs are derived output',
      'Markdown files in the docs directory are rendered from the PKM — they are not the source of truth.',
      [
        {
          type: 'knowledge',
          source: 'documentation.plan',
          detail: 'The documentation writer renders Markdown from ProjectKnowledge',
        },
      ],
      'high',
    ),
    createConvention(
      'generated-context',
      'PKM JSON is the canonical machine-readable state',
      `project-knowledge.json and its split section files under ${knowledgeDir}/ are the canonical persisted project state.`,
      [
        {
          type: 'knowledge',
          source: `${knowledgeDir}/project-knowledge.json`,
          detail: 'The knowledge writer persists the full PKM snapshot on every run',
        },
      ],
      'high',
    ),
  ];
}

export function detectArchitectureConventions(
  input: ConventionDetectionInput,
): ConventionKnowledge[] {
  const conventions: ConventionKnowledge[] = [];

  for (const module of input.modules) {
    const rule = ARCHITECTURE_CONVENTION_RULES[module.relativePath];
    if (rule === undefined) {
      continue;
    }

    conventions.push(
      createConvention(
        'architecture',
        rule.name,
        rule.description,
        [
          {
            type: 'module',
            source: module.relativePath,
            detail: `Module classified as ${module.type}: ${module.responsibility}`,
          },
        ],
        module.confidence === 'high' ? 'high' : 'medium',
      ),
    );
  }

  return conventions;
}

export function sortConventions(conventions: ConventionKnowledge[]): ConventionKnowledge[] {
  const categoryRank = new Map<ConventionCategory, number>(
    CONVENTION_CATEGORY_ORDER.map((category, index) => [category, index]),
  );

  return [...conventions].sort((left, right) => {
    const leftRank = categoryRank.get(left.category) ?? CONVENTION_CATEGORY_ORDER.length;
    const rightRank = categoryRank.get(right.category) ?? CONVENTION_CATEGORY_ORDER.length;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.name.localeCompare(right.name);
  });
}
