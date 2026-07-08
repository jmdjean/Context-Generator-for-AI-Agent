import * as fs from 'node:fs';
import * as path from 'node:path';
import { isToolManagedExportContent } from '../docs/documentation-write-policy';
import { resolvePathWithinRoot } from '../utils/fs';
import { ExportedFile } from './exporter-contract';

function readFileIfPresent(targetPath: string): string | undefined {
  try {
    return fs.readFileSync(targetPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export function writeExportFile(
  docsRootPath: string,
  relativePath: string,
  content: string,
  overwriteGeneratedOnly: boolean,
): ExportedFile {
  const outputPath = resolvePathWithinRoot(docsRootPath, relativePath);
  const existingContent = readFileIfPresent(outputPath);

  if (existingContent !== undefined && overwriteGeneratedOnly && !isToolManagedExportContent(existingContent)) {
    return {
      relativePath,
      status: 'skipped',
      reason: 'user-managed file without generated marker',
    };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf-8');

  return {
    relativePath,
    status: 'written',
  };
}
