import * as fs from 'node:fs';
import * as path from 'node:path';
import { RepositoryBoundary } from './repository-boundary';

export const ALWAYS_IGNORED_NAMES = new Set(['.git', 'node_modules']);

export const DEFAULT_IGNORED_PATHS: readonly string[] = [
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
  '*.log',
  '*.tsbuildinfo',
];

export interface IgnoreRules {
  patterns: string[];
}

export function createIgnoreRules(ignoredPaths: readonly string[] = DEFAULT_IGNORED_PATHS): IgnoreRules {
  return {
    patterns: [...ignoredPaths],
  };
}

export function mergeIgnoredPaths(customPaths?: readonly string[]): string[] {
  if (customPaths === undefined || customPaths.length === 0) {
    return [...DEFAULT_IGNORED_PATHS];
  }

  return [...new Set([...DEFAULT_IGNORED_PATHS, ...customPaths])];
}

export function isUnsafeEntryName(name: string): boolean {
  return name === '.' || name === '..' || name.includes('/') || name.includes('\\');
}

export function loadGitignorePatternsFromDirectory(absoluteDirectoryPath: string): string[] {
  const gitignorePath = path.join(absoluteDirectoryPath, '.gitignore');

  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return parseGitignoreContent(content);
  } catch {
    return [];
  }
}

export function loadGitignorePatterns(boundary: RepositoryBoundary): string[] {
  return loadGitignorePatternsFromDirectory(boundary.rootPath);
}

export function scopeGitignorePatternsToDirectory(
  patterns: readonly string[],
  directoryRelativePath: string,
): string[] {
  const directoryPrefix = toPosixPath(directoryRelativePath);

  return patterns.map((pattern) => {
    const isAnchored = pattern.startsWith('/');
    const normalizedPattern = toPosixPath(
      (isAnchored ? pattern.slice(1) : pattern).replace(/\/$/, ''),
    );

    if (isAnchored) {
      return directoryPrefix.length === 0
        ? `/${normalizedPattern}`
        : `/${directoryPrefix}/${normalizedPattern}`;
    }

    return directoryPrefix.length === 0
      ? normalizedPattern
      : `${directoryPrefix}/${normalizedPattern}`;
  });
}

export function buildEffectiveIgnorePatterns(
  ignoredPaths: readonly string[],
  boundary: RepositoryBoundary,
  outputDocsDir?: string,
): string[] {
  const gitignorePatterns = loadGitignorePatterns(boundary);
  const patterns = [...ignoredPaths, ...gitignorePatterns];

  if (outputDocsDir !== undefined) {
    patterns.push(toPosixPath(outputDocsDir));
  }

  return [...new Set(patterns)];
}

export function createDirectoryIgnoreRules(
  parentRules: IgnoreRules,
  directoryRelativePath: string,
  directoryAbsolutePath: string,
): IgnoreRules {
  const localPatterns = loadGitignorePatternsFromDirectory(directoryAbsolutePath);

  if (localPatterns.length === 0) {
    return parentRules;
  }

  const scopedPatterns = scopeGitignorePatternsToDirectory(localPatterns, directoryRelativePath);

  return createIgnoreRules([...parentRules.patterns, ...scopedPatterns]);
}

export function shouldIgnoreEntry(
  name: string,
  relativePath: string,
  rules: IgnoreRules,
  includeHidden: boolean,
): boolean {
  if (isUnsafeEntryName(name)) {
    return true;
  }

  if (ALWAYS_IGNORED_NAMES.has(name)) {
    return true;
  }

  if (!includeHidden && name.startsWith('.') && name !== '.') {
    return true;
  }

  const normalizedRelative = toPosixPath(relativePath);

  for (const pattern of rules.patterns) {
    if (matchesIgnorePattern(name, normalizedRelative, pattern)) {
      return true;
    }
  }

  return false;
}

export function parseGitignoreContent(content: string): string[] {
  const patterns: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      continue;
    }

    let pattern = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;

    if (pattern.length > 0) {
      patterns.push(toPosixPath(pattern));
    }
  }

  return patterns;
}

function matchesIgnorePattern(name: string, relativePath: string, pattern: string): boolean {
  const normalizedPattern = toPosixPath(pattern.replace(/\/$/, ''));
  const isAnchored = normalizedPattern.startsWith('/');

  if (isAnchored) {
    const anchoredPattern = normalizedPattern.slice(1);
    return (
      matchesPatternValue(relativePath, anchoredPattern) ||
      relativePath.startsWith(`${anchoredPattern}/`)
    );
  }

  if (normalizedPattern.includes('**')) {
    const regex = gitignorePatternToRegex(normalizedPattern);
    return regex.test(name) || regex.test(relativePath);
  }

  if (normalizedPattern.includes('*')) {
    return matchesWildcard(name, normalizedPattern) || matchesWildcard(relativePath, normalizedPattern);
  }

  if (name === normalizedPattern || relativePath === normalizedPattern) {
    return true;
  }

  if (relativePath.startsWith(`${normalizedPattern}/`)) {
    return true;
  }

  const segments = relativePath.split('/');
  return segments.includes(normalizedPattern);
}

function matchesPatternValue(value: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    return matchesWildcard(value, pattern);
  }

  return value === pattern;
}

function gitignorePatternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

function matchesWildcard(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

export function directoryHasOmittedEntries(
  absolutePath: string,
  relativePath: string,
  rules: IgnoreRules,
  includeHidden: boolean,
): boolean {
  try {
    const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

    for (const entry of entries) {
      if (isUnsafeEntryName(entry.name)) {
        continue;
      }

      const entryRelativePath =
        relativePath.length === 0 ? entry.name : `${toPosixPath(relativePath)}/${entry.name}`;

      if (shouldIgnoreEntry(entry.name, entryRelativePath, rules, includeHidden)) {
        continue;
      }

      return true;
    }
  } catch {
    return true;
  }

  return false;
}
