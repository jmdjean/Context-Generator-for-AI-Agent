import * as fs from 'node:fs';
import * as path from 'node:path';
import { RepositoryInfo, TechnologyProfile, TechnologyConfidence } from '../domain';
import { detectPackageManager } from './package-manager-detector';

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

function hasFile(detectedFiles: string[], name: string): boolean {
  return detectedFiles.includes(name);
}

function readPackageJson(rootPath: string): PackageJson | null {
  try {
    const raw = fs.readFileSync(path.join(rootPath, 'package.json'), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as PackageJson;
  } catch {
    return null;
  }
}

function matchDeps(
  allDeps: Record<string, string>,
  depMap: ReadonlyArray<[string, string]>,
): string[] {
  return depMap
    .filter(([dep]) => dep in allDeps)
    .map(([, label]) => label);
}

export function detectTechnologies(repositoryInfo: RepositoryInfo): TechnologyProfile {
  const { detectedFiles, rootPath } = repositoryInfo;

  const languages: string[] = [];
  const tooling: string[] = [];
  const frameworks: string[] = [];

  const hasTypeScript = hasFile(detectedFiles, 'tsconfig.json');
  const hasPackageJson = hasFile(detectedFiles, 'package.json');
  const hasDocker =
    hasFile(detectedFiles, 'Dockerfile') || hasFile(detectedFiles, 'docker-compose.yml');

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

  if (hasPackageJson) {
    const pkg = readPackageJson(rootPath);
    if (pkg) {
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

  const hasExplicitConfig = hasTypeScript || hasDocker;
  const confidence: TechnologyConfidence =
    languages.length === 0 ? 'low' : hasExplicitConfig ? 'high' : 'medium';

  return { languages, frameworks, packageManagers, tooling, confidence };
}
