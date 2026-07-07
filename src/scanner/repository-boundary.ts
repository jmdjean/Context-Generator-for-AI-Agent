import * as path from 'node:path';
import { resolvePathWithinRoot } from '../utils/fs';

export interface RepositoryBoundary {
  readonly rootPath: string;
  resolveRelative(relativePath: string): string;
  toRelative(absolutePath: string): string;
}

export function createRepositoryBoundary(rootPath: string): RepositoryBoundary {
  const absoluteRoot = path.resolve(rootPath);

  return {
    rootPath: absoluteRoot,

    resolveRelative(relativePath: string): string {
      return resolvePathWithinRoot(absoluteRoot, relativePath);
    },

    toRelative(absolutePath: string): string {
      const resolved = path.resolve(absolutePath);
      const relative = path.relative(absoluteRoot, resolved);

      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Path escapes repository root: ${absolutePath}`);
      }

      return relative === '' ? '' : relative.split(path.sep).join('/');
    },
  };
}
