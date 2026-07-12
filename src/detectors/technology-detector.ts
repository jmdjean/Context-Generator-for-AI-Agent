import * as fs from 'node:fs';
import * as path from 'node:path';
import { RepositoryInfo, TechnologyProfile, TechnologyConfidence } from '../domain';
import { detectPackageManager } from './package-manager-detector';
import {
  findAllRepositoryPaths,
  getSearchableRepositoryPaths,
  hasRepositoryPath,
  hasRepositoryPathWithExtension,
  resolveRepositoryFilePath,
} from './repository-paths';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const FRAMEWORK_DEPS: ReadonlyArray<[string, string]> = [
  ['@angular/core', 'Angular'],
  ['react', 'React'],
  ['vue', 'Vue'],
  ['svelte', 'Svelte'],
  ['next', 'Next.js'],
  ['nuxt', 'Nuxt'],
  ['@nestjs/core', 'NestJS'],
  ['express', 'Express'],
];

const TOOLING_DEPS: ReadonlyArray<[string, string]> = [
  ['vite', 'Vite'],
  ['jest', 'Jest'],
  ['vitest', 'Vitest'],
  ['cypress', 'Cypress'],
  ['@playwright/test', 'Playwright'],
  ['eslint', 'ESLint'],
  ['prettier', 'Prettier'],
];

function hasConfigFile(searchablePaths: string[], fileName: string): boolean {
  const usesTopLevelOnly =
    searchablePaths.length > 0 && searchablePaths.every((entry) => !entry.includes('/'));

  if (usesTopLevelOnly) {
    return searchablePaths.includes(fileName);
  }

  return hasRepositoryPath(searchablePaths, fileName);
}

function readPackageJson(packageJsonPath: string): PackageJson | null {
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as PackageJson;
  } catch {
    return null;
  }
}

function resolvePackageJsonAbsolutePaths(
  repositoryInfo: RepositoryInfo,
  searchablePaths: string[],
): string[] {
  const relativePaths = findAllRepositoryPaths(searchablePaths, 'package.json');

  if (relativePaths.length === 0) {
    const fallbackPath = path.join(repositoryInfo.rootPath, 'package.json');
    return fs.existsSync(fallbackPath) ? [fallbackPath] : [];
  }

  return relativePaths.map((relativePath) =>
    resolveRepositoryFilePath(repositoryInfo.rootPath, relativePath),
  );
}

function matchDeps(
  allDeps: Record<string, string>,
  depMap: ReadonlyArray<[string, string]>,
): string[] {
  return depMap
    .filter(([dep]) => dep in allDeps)
    .map(([, label]) => label);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function detectNonJsLanguages(searchablePaths: string[]): string[] {
  const languages: string[] = [];

  if (
    hasConfigFile(searchablePaths, 'pom.xml') ||
    hasConfigFile(searchablePaths, 'build.gradle') ||
    hasConfigFile(searchablePaths, 'build.gradle.kts')
  ) {
    languages.push('Java');
  }

  if (
    hasRepositoryPathWithExtension(searchablePaths, '.csproj') ||
    hasRepositoryPathWithExtension(searchablePaths, '.fsproj')
  ) {
    languages.push('C#');
  }

  if (hasConfigFile(searchablePaths, 'go.mod')) {
    languages.push('Go');
  }

  if (hasConfigFile(searchablePaths, 'Cargo.toml')) {
    languages.push('Rust');
  }

  if (
    hasConfigFile(searchablePaths, 'pyproject.toml') ||
    hasConfigFile(searchablePaths, 'setup.cfg')
  ) {
    languages.push('Python');
  }

  return languages;
}

/**
 * Detects languages, frameworks, tooling, and package managers from repository
 * metadata and nested manifests visible in the scanned tree.
 * Aggregates dependency signals across all package.json files — does not invent frameworks.
 */
export function detectTechnologies(repositoryInfo: RepositoryInfo): TechnologyProfile {
  const searchablePaths = getSearchableRepositoryPaths(repositoryInfo);

  const languages: string[] = [];
  const tooling: string[] = [];
  const frameworks: string[] = [];

  const hasTypeScript = hasConfigFile(searchablePaths, 'tsconfig.json');
  const hasPackageJson = hasConfigFile(searchablePaths, 'package.json');
  const hasDocker =
    hasConfigFile(searchablePaths, 'Dockerfile') ||
    hasConfigFile(searchablePaths, 'docker-compose.yml');

  if (hasTypeScript) {
    languages.push('TypeScript');
    tooling.push('TypeScript');
  } else if (hasPackageJson) {
    languages.push('JavaScript');
  }

  if (hasDocker) {
    languages.push('Docker');
    tooling.push('Docker');
  }

  languages.push(...detectNonJsLanguages(searchablePaths));

  if (hasPackageJson) {
    for (const packageJsonPath of resolvePackageJsonAbsolutePaths(
      repositoryInfo,
      searchablePaths,
    )) {
      const pkg = readPackageJson(packageJsonPath);
      if (pkg === null) {
        continue;
      }

      const allDeps: Record<string, string> = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
      frameworks.push(...matchDeps(allDeps, FRAMEWORK_DEPS));
      tooling.push(...matchDeps(allDeps, TOOLING_DEPS));
    }
  }

  const packageManager = detectPackageManager(repositoryInfo);
  const packageManagers = packageManager !== 'unknown' ? [packageManager] : [];

  const uniqueLanguages = uniqueSorted(languages);
  const uniqueFrameworks = uniqueSorted(frameworks);
  const uniqueTooling = uniqueSorted(tooling);

  const hasExplicitConfig =
    hasTypeScript ||
    hasDocker ||
    uniqueLanguages.some((language) => language !== 'JavaScript');
  const confidence: TechnologyConfidence =
    uniqueLanguages.length === 0 ? 'low' : hasExplicitConfig ? 'high' : 'medium';

  return {
    languages: uniqueLanguages,
    frameworks: uniqueFrameworks,
    packageManagers,
    tooling: uniqueTooling,
    confidence,
  };
}
