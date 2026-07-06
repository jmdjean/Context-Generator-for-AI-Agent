import * as fs from 'node:fs';
import * as path from 'node:path';
import { RuntimeConfig } from '../config';
import { RepositoryInfo } from '../domain';

export function loadRepositoryMetadata(config: RuntimeConfig): RepositoryInfo {
  const { targetProjectPath } = config;
  return {
    name: path.basename(targetProjectPath),
    rootPath: targetProjectPath,
    detectedFiles: listTopLevelEntries(targetProjectPath),
    ignoredPaths: [],
  };
}

function listTopLevelEntries(rootPath: string): string[] {
  try {
    return fs.readdirSync(rootPath);
  } catch {
    return [];
  }
}
