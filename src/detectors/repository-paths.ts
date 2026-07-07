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

export function resolveRepositoryFilePath(rootPath: string, relativePath: string): string {
  return path.join(rootPath, ...relativePath.split('/'));
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}
