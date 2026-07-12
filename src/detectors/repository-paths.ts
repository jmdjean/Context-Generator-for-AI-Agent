import { RepositoryInfo, RepositoryNode } from '../domain';
import * as path from 'node:path';

export function collectRepositoryRelativePaths(tree: RepositoryNode): string[] {
  const paths: string[] = [];

  function visit(node: RepositoryNode): void {
    if (node.type === 'file') {
      paths.push(node.relativePath);
      return;
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  visit(tree);
  return paths;
}

export function getSearchableRepositoryPaths(repositoryInfo: RepositoryInfo): string[] {
  if (repositoryInfo.repositoryTree !== undefined) {
    return collectRepositoryRelativePaths(repositoryInfo.repositoryTree);
  }

  return repositoryInfo.detectedFiles;
}

export function hasRepositoryPath(paths: readonly string[], targetPath: string): boolean {
  const normalizedTarget = toPosixPath(targetPath);

  return paths.some((entry) => entry === normalizedTarget || entry.endsWith(`/${normalizedTarget}`));
}

export function findRepositoryPath(paths: readonly string[], fileName: string): string | undefined {
  const rootMatch = paths.find((entry) => entry === fileName);
  if (rootMatch !== undefined) {
    return rootMatch;
  }

  return paths.find((entry) => entry.endsWith(`/${fileName}`));
}

/** All matching paths for a basename, root first then nested (sorted). */
export function findAllRepositoryPaths(paths: readonly string[], fileName: string): string[] {
  const normalizedName = toPosixPath(fileName);
  const matches = paths.filter(
    (entry) => entry === normalizedName || entry.endsWith(`/${normalizedName}`),
  );

  return [...new Set(matches)].sort((left, right) => {
    if (left === normalizedName) {
      return -1;
    }
    if (right === normalizedName) {
      return 1;
    }
    return left.localeCompare(right);
  });
}

export function hasRepositoryPathWithExtension(
  paths: readonly string[],
  extension: string,
): boolean {
  const normalizedExtension = extension.startsWith('.')
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;

  return paths.some((entry) => toPosixPath(entry).toLowerCase().endsWith(normalizedExtension));
}

export function resolveRepositoryFilePath(rootPath: string, relativePath: string): string {
  return path.join(rootPath, ...relativePath.split('/'));
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}
