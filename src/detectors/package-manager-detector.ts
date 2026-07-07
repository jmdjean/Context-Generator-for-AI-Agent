import { RepositoryInfo } from '../domain';
import { getSearchableRepositoryPaths, hasRepositoryPath } from './repository-paths';

const LOCKFILE_MAP: ReadonlyArray<[string, string]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['bun.lockb', 'bun'],
];

export function detectPackageManager(repositoryInfo: RepositoryInfo): string {
  const searchablePaths = getSearchableRepositoryPaths(repositoryInfo);

  for (const [lockfile, manager] of LOCKFILE_MAP) {
    if (hasRepositoryPath(searchablePaths, lockfile)) {
      return manager;
    }
  }

  for (const [lockfile, manager] of LOCKFILE_MAP) {
    if (repositoryInfo.detectedFiles.includes(lockfile)) {
      return manager;
    }
  }

  return 'unknown';
}
