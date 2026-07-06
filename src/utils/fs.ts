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
