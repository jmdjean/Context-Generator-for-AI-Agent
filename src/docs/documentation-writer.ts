import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDocsDir, getDocumentationPlan, getProjectRoot, ProjectKnowledge } from '../knowledge';
import { resolvePathWithinRoot } from '../utils/fs';
import { GENERATED_FILE_MARKER, renderDeterministicDocument } from './document-template';
import { PlannedDocument } from '../domain/documentation-plan';

export interface DocumentationWriteResult {
  writtenCount: number;
  skippedCount: number;
  docsDirectoryPath: string;
  writtenPaths: string[];
  skippedPaths: string[];
}

function hasGeneratedMarker(fileContent: string): boolean {
  return fileContent.startsWith(GENERATED_FILE_MARKER);
}

function ensureDirectory(targetPath: string): void {
  fs.mkdirSync(targetPath, { recursive: true });
}

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

function writePlannedDocument(
  document: PlannedDocument,
  docsRootPath: string,
  knowledge: ProjectKnowledge,
): 'written' | 'skipped' {
  const outputPath = resolvePathWithinRoot(docsRootPath, document.relativePath);
  const existingContent = readFileIfPresent(outputPath);

  if (existingContent !== undefined && !hasGeneratedMarker(existingContent)) {
    console.warn(`Warning: skipped user-managed documentation at ${document.relativePath}`);
    return 'skipped';
  }

  ensureDirectory(path.dirname(outputPath));

  const markdown = renderDeterministicDocument(document, knowledge);

  fs.writeFileSync(outputPath, markdown, 'utf-8');
  return 'written';
}

export function writeDocumentation(knowledge: ProjectKnowledge): DocumentationWriteResult {
  const documentationPlan = getDocumentationPlan(knowledge);
  const docsRootPath = resolvePathWithinRoot(getProjectRoot(knowledge), getDocsDir(knowledge));

  ensureDirectory(docsRootPath);

  const writtenPaths: string[] = [];
  const skippedPaths: string[] = [];

  for (const document of documentationPlan.documents) {
    const outcome = writePlannedDocument(document, docsRootPath, knowledge);

    if (outcome === 'written') {
      writtenPaths.push(document.relativePath);
    } else {
      skippedPaths.push(document.relativePath);
    }
  }

  return {
    writtenCount: writtenPaths.length,
    skippedCount: skippedPaths.length,
    docsDirectoryPath: getDocsDir(knowledge),
    writtenPaths,
    skippedPaths,
  };
}
