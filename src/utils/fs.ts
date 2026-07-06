import * as fs from 'node:fs';
import * as path from 'node:path';

export function resolveAbsolutePath(inputPath: string): string {
  return path.resolve(inputPath);
}

export function pathExists(targetPath: string): boolean {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

export function resolvePathWithinRoot(rootPath: string, relativePath: string): string {
  const absoluteRootPath = path.resolve(rootPath);
  const resolvedPath = path.resolve(absoluteRootPath, relativePath);
  const relativeToRoot = path.relative(absoluteRootPath, resolvedPath);

  if (
    relativeToRoot === '' ||
    (!relativeToRoot.startsWith('..') && !path.isAbsolute(relativeToRoot))
  ) {
    return resolvedPath;
  }

  throw new Error(`Resolved path escapes repository root: ${relativePath}`);
}
