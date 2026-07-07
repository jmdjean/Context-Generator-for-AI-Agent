import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDocsDir, getDocumentationPlan, getProjectRoot, ProjectKnowledge } from '../knowledge';
import { resolvePathWithinRoot } from '../utils/fs';
import { GENERATED_FILE_MARKER } from './document-template';
import { DocumentRendererKind, renderPlannedDocument } from './markdown-renderers';
import { PlannedDocument } from '../domain/documentation-plan';

export interface DocumentationWriteResult {
  writtenCount: number;
  skippedCount: number;
  pkmPoweredCount: number;
  genericCount: number;
  docsDirectoryPath: string;
  writtenPaths: string[];
  skippedPaths: string[];
}

type WriteOutcome =
  | { outcome: 'written'; rendererKind: DocumentRendererKind }
  | { outcome: 'skipped' };

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
): WriteOutcome {
  const outputPath = resolvePathWithinRoot(docsRootPath, document.relativePath);
  const existingContent = readFileIfPresent(outputPath);

  if (existingContent !== undefined && !hasGeneratedMarker(existingContent)) {
    console.warn(`Warning: skipped user-managed documentation at ${document.relativePath}`);
    return { outcome: 'skipped' };
  }

  ensureDirectory(path.dirname(outputPath));

  const rendered = renderPlannedDocument(document, knowledge);

  fs.writeFileSync(outputPath, rendered.markdown, 'utf-8');
  return { outcome: 'written', rendererKind: rendered.rendererKind };
}

export function writeDocumentation(knowledge: ProjectKnowledge): DocumentationWriteResult {
  const documentationPlan = getDocumentationPlan(knowledge);
  const docsRootPath = resolvePathWithinRoot(getProjectRoot(knowledge), getDocsDir(knowledge));

  ensureDirectory(docsRootPath);

  const writtenPaths: string[] = [];
  const skippedPaths: string[] = [];
  let pkmPoweredCount = 0;
  let genericCount = 0;

  for (const document of documentationPlan.documents) {
    const result = writePlannedDocument(document, docsRootPath, knowledge);

    if (result.outcome === 'written') {
      writtenPaths.push(document.relativePath);
      if (result.rendererKind === 'pkm') {
        pkmPoweredCount += 1;
      } else {
        genericCount += 1;
      }
    } else {
      skippedPaths.push(document.relativePath);
    }
  }

  return {
    writtenCount: writtenPaths.length,
    skippedCount: skippedPaths.length,
    pkmPoweredCount,
    genericCount,
    docsDirectoryPath: getDocsDir(knowledge),
    writtenPaths,
    skippedPaths,
  };
}
