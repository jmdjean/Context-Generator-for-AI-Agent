import { RepositoryInfo } from '../domain';

const LOCKFILE_MAP: ReadonlyArray<[string, string]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['bun.lockb', 'bun'],
];

export function detectPackageManager(repositoryInfo: RepositoryInfo): string {
  for (const [lockfile, manager] of LOCKFILE_MAP) {
    if (repositoryInfo.detectedFiles.includes(lockfile)) {
      return manager;
    }
  }
  return 'unknown';
}
