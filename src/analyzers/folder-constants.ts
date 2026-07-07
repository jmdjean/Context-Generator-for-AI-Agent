import { FolderClassification } from '../knowledge/project-knowledge';

export const SOURCE_ROOT_FOLDER_NAMES = new Set([
  'src',
  'app',
  'apps',
  'lib',
  'libs',
  'packages',
]);

export const IGNORED_FOLDER_NAMES = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  '.turbo',
  '.vercel',
]);

export const IMPORTANT_EXACT_FILES = new Set([
  'README.md',
  'AGENTS.md',
  'package.json',
  'tsconfig.json',
  'angular.json',
  'docker-compose.yml',
  'Dockerfile',
]);

export const IMPORTANT_FILE_PREFIXES = [
  'vite.config.',
  'jest.config.',
  'vitest.config.',
  'eslint.config.',
] as const;

export const KNOWN_SOURCE_MODULE_RESPONSIBILITIES: Readonly<Record<string, string>> = {
  scanner: 'Builds the repository tree used by analyzers.',
  detectors: 'Detects technologies and tooling from repository metadata.',
  knowledge: 'Represents and persists the Project Knowledge Model used as the source of truth.',
  docs: 'Plans and writes documentation outputs derived from project knowledge.',
  core: 'Contains pipeline orchestration and core application coordination logic.',
  config: 'Resolves runtime configuration from CLI flags and environment variables.',
  ai: 'Integrates with AI providers for architecture analysis.',
  analyzers: 'Derives higher-level architectural knowledge from the PKM.',
  domain: 'Defines pure domain types and the declarative analysis pipeline.',
  utils: 'Provides shared utility functions with no domain knowledge.',
};

export const NAME_CLASSIFICATIONS: ReadonlyArray<{
  names: readonly string[];
  classification: FolderClassification;
}> = [
  { names: ['src'], classification: 'source' },
  { names: ['app', 'apps'], classification: 'source' },
  { names: ['lib', 'libs', 'packages'], classification: 'source' },
  { names: ['test', 'tests', '__tests__', 'spec'], classification: 'test' },
  { names: ['docs', 'documentation'], classification: 'documentation' },
  { names: ['.ai-docs'], classification: 'documentation' },
  { names: ['config', 'configs'], classification: 'config' },
  { names: ['scripts'], classification: 'scripts' },
  { names: ['tools'], classification: 'tooling' },
  { names: ['dist', 'build', 'out', 'coverage'], classification: 'build-output' },
  { names: ['node_modules', 'vendor'], classification: 'dependency-cache' },
  { names: ['assets', 'public', 'static'], classification: 'asset' },
];

export const TEST_FILE_PATTERN = /\.(test|spec)\.[a-z0-9]+$/i;
export const TEST_FOLDER_NAMES = new Set(['test', 'tests', '__tests__', 'spec']);
export const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|vue|svelte)$/i;

export const CONFIG_FILE_NAMES = new Set([
  'package.json',
  'tsconfig.json',
  'angular.json',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'jest.config.ts',
  'jest.config.js',
  'vitest.config.ts',
  'vitest.config.js',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'docker-compose.yml',
  'Dockerfile',
]);

export function toPosixPath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}

export function normalizeFolderName(name: string): string {
  return name.toLowerCase();
}

export function isImportantFile(fileName: string): boolean {
  if (IMPORTANT_EXACT_FILES.has(fileName)) {
    return true;
  }

  return IMPORTANT_FILE_PREFIXES.some((prefix) => fileName.startsWith(prefix));
}

export function getKnowledgeDirectoryRelativePath(docsDir: string): string {
  return toPosixPath(`${docsDir}/knowledge`);
}

export function isUnderSourceRoot(relativePath: string): boolean {
  const posixPath = toPosixPath(relativePath);
  if (posixPath.length === 0) {
    return false;
  }

  const segments = posixPath.split('/').filter((segment) => segment.length > 0);
  const rootSegment = segments[0] ?? '';
  return SOURCE_ROOT_FOLDER_NAMES.has(normalizeFolderName(rootSegment));
}

export function isSourceModulePath(relativePath: string): boolean {
  const posixPath = toPosixPath(relativePath);
  if (!isUnderSourceRoot(posixPath)) {
    return false;
  }

  const segments = posixPath.split('/').filter((segment) => segment.length > 0);
  return segments.length > 1;
}

export function isKnownSourceModule(relativePath: string, name: string): boolean {
  if (!isSourceModulePath(relativePath)) {
    return false;
  }

  return KNOWN_SOURCE_MODULE_RESPONSIBILITIES[normalizeFolderName(name)] !== undefined;
}

export function isTestFolderSegment(segment: string): boolean {
  return TEST_FOLDER_NAMES.has(normalizeFolderName(segment));
}

export function hasNonTestSourceFiles(fileNames: readonly string[]): boolean {
  return fileNames.some(
    (fileName) => SOURCE_FILE_PATTERN.test(fileName) && !TEST_FILE_PATTERN.test(fileName),
  );
}
