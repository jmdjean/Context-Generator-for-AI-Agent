import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DocumentImpactSummaryKnowledge,
  getDocsDir,
  getDocumentationPlan,
  getProjectRoot,
  ProjectKnowledge,
} from '../knowledge';
import { resolvePathWithinRoot } from '../utils/fs';
import {
  assertDocumentImpactConsistency,
  buildRegenerationPathSet,
  hasGeneratedFileMarker,
} from './documentation-write-policy';
import { renderDocumentWithTemplate } from '../templates/template-engine';
import { TemplateRenderKind } from '../templates/template-context';
import { PlannedDocument } from '../domain/documentation-plan';

export interface DocumentationWriteResult {
  writtenCount: number;
  skippedCount: number;
  skippedUnchangedCount: number;
  skippedProtectedCount: number;
  pkmPoweredCount: number;
  genericCount: number;
  docsDirectoryPath: string;
  writtenPaths: string[];
  skippedPaths: string[];
  skippedUnchangedPaths: string[];
  skippedProtectedPaths: string[];
}

type WriteOutcome =
  | { outcome: 'written'; renderKind: TemplateRenderKind }
  | { outcome: 'skipped-unchanged' }
  | { outcome: 'skipped-protected' };

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

function shouldRegenerateDocument(
  document: PlannedDocument,
  existingContent: string | undefined,
  regenerationPaths?: ReadonlySet<string>,
): boolean {
  if (regenerationPaths === undefined) {
    return true;
  }

  if (existingContent === undefined) {
    return true;
  }

  return regenerationPaths.has(document.relativePath);
}

function writePlannedDocument(
  document: PlannedDocument,
  docsRootPath: string,
  knowledge: ProjectKnowledge,
  regenerationPaths?: ReadonlySet<string>,
): WriteOutcome {
  const outputPath = resolvePathWithinRoot(docsRootPath, document.relativePath);
  const existingContent = readFileIfPresent(outputPath);

  if (existingContent !== undefined && !hasGeneratedFileMarker(existingContent)) {
    console.warn(`Warning: skipped user-managed documentation at ${document.relativePath}`);
    return { outcome: 'skipped-protected' };
  }

  if (!shouldRegenerateDocument(document, existingContent, regenerationPaths)) {
    return { outcome: 'skipped-unchanged' };
  }

  ensureDirectory(path.dirname(outputPath));

  const rendered = renderDocumentWithTemplate(document, knowledge);

  fs.writeFileSync(outputPath, rendered.content, 'utf-8');
  return { outcome: 'written', renderKind: rendered.renderKind };
}

export interface SingleDocumentWriteResult {
  relativePath: string;
  outcome: 'written' | 'skipped-protected';
}

/**
 * Renders and writes one planned document through its registered template,
 * outside the main documentation pass. Used by the AI readiness step, which
 * runs after documents are written and must refresh ai-readiness.md with the
 * freshly calculated result. Protection markers are respected: user-managed
 * files are never overwritten.
 */
export function writeSinglePlannedDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): SingleDocumentWriteResult {
  const docsRootPath = resolvePathWithinRoot(getProjectRoot(knowledge), getDocsDir(knowledge));
  ensureDirectory(docsRootPath);

  const result = writePlannedDocument(document, docsRootPath, knowledge);

  return {
    relativePath: document.relativePath,
    outcome: result.outcome === 'skipped-protected' ? 'skipped-protected' : 'written',
  };
}

export function writeDocumentation(
  knowledge: ProjectKnowledge,
  impactSummary?: DocumentImpactSummaryKnowledge,
): DocumentationWriteResult {
  const documentationPlan = getDocumentationPlan(knowledge);
  const docsRootPath = resolvePathWithinRoot(getProjectRoot(knowledge), getDocsDir(knowledge));

  ensureDirectory(docsRootPath);

  if (impactSummary !== undefined) {
    assertDocumentImpactConsistency(impactSummary);
  }

  const regenerationPaths =
    impactSummary === undefined ? undefined : buildRegenerationPathSet(impactSummary);

  const writtenPaths: string[] = [];
  const skippedUnchangedPaths: string[] = [];
  const skippedProtectedPaths: string[] = [];
  let pkmPoweredCount = 0;
  let genericCount = 0;

  for (const document of documentationPlan.documents) {
    const result = writePlannedDocument(document, docsRootPath, knowledge, regenerationPaths);

    if (result.outcome === 'written') {
      writtenPaths.push(document.relativePath);
      if (result.renderKind === 'template') {
        pkmPoweredCount += 1;
      } else {
        genericCount += 1;
      }
    } else if (result.outcome === 'skipped-unchanged') {
      skippedUnchangedPaths.push(document.relativePath);
    } else {
      skippedProtectedPaths.push(document.relativePath);
    }
  }

  const skippedPaths = [...skippedUnchangedPaths, ...skippedProtectedPaths];

  return {
    writtenCount: writtenPaths.length,
    skippedCount: skippedPaths.length,
    skippedUnchangedCount: skippedUnchangedPaths.length,
    skippedProtectedCount: skippedProtectedPaths.length,
    pkmPoweredCount,
    genericCount,
    docsDirectoryPath: getDocsDir(knowledge),
    writtenPaths,
    skippedPaths,
    skippedUnchangedPaths,
    skippedProtectedPaths,
  };
}
