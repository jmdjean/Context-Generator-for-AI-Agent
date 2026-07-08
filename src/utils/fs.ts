import * as fs from 'node:fs';
import * as path from 'node:path';
import { formatErrorMessage } from './error-format';

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

export function assertReadableDirectory(targetPath: string): string {
  const absolutePath = resolveAbsolutePath(targetPath);

  try {
    fs.accessSync(absolutePath, fs.constants.F_OK | fs.constants.R_OK);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(`Target path does not exist: ${absolutePath}`);
    }
    if (code === 'EACCES' || code === 'EPERM') {
      throw new Error(`Permission denied reading target path: ${absolutePath}`);
    }
    throw new Error(`Cannot access target path: ${absolutePath} (${formatErrorMessage(err)})`);
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolutePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw new Error(`Permission denied reading target path: ${absolutePath}`);
    }
    throw new Error(`Cannot read target path: ${absolutePath} (${formatErrorMessage(err)})`);
  }

  if (!stat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${absolutePath}`);
  }

  return absolutePath;
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
