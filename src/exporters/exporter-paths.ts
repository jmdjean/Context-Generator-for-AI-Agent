import * as path from 'node:path';

export function formatDocsRelativePath(docsDir: string, relativePath: string): string {
  return path.posix.join(docsDir, relativePath);
}
