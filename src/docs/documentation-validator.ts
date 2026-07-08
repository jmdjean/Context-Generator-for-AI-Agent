import * as fs from 'node:fs';
import { getDocsDir, getDocumentationPlan, getProjectRoot, ProjectKnowledge } from '../knowledge';
import { resolvePathWithinRoot } from '../utils/fs';
import { GENERATED_FILE_MARKER } from './document-template';
import { normalizeGeneratedFileContent } from './documentation-write-policy';
import { DocumentationWriteResult } from './documentation-writer';

export interface DocumentationValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  relativePath?: string;
}

export type DocumentationValidationStatus = 'passed' | 'failed';

export interface DocumentationValidationResult {
  errorCount: number;
  warningCount: number;
  status: DocumentationValidationStatus;
  issues: DocumentationValidationIssue[];
}

function validateDocumentOnDisk(
  docsRootPath: string,
  relativePath: string,
  issues: DocumentationValidationIssue[],
): void {
  const filePath = resolvePathWithinRoot(docsRootPath, relativePath);
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    issues.push({
      severity: 'error',
      message: 'document is missing on disk',
      relativePath,
    });
    return;
  }

  const normalizedContent = normalizeGeneratedFileContent(content);

  if (!normalizedContent.startsWith(GENERATED_FILE_MARKER)) {
    issues.push({
      severity: 'error',
      message: 'document is missing the generated-file marker',
      relativePath,
    });
    return;
  }

  const body = normalizedContent.slice(GENERATED_FILE_MARKER.length).trim();
  if (body.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'document body is empty',
      relativePath,
    });
  }
}

export function validateDocumentation(
  knowledge: ProjectKnowledge,
  writeResult: DocumentationWriteResult,
): DocumentationValidationResult {
  const issues: DocumentationValidationIssue[] = [];

  if (writeResult.writtenCount !== writeResult.writtenPaths.length) {
    issues.push({
      severity: 'error',
      message: 'documentation write result counts are inconsistent',
    });
  }

  if (writeResult.skippedCount !== writeResult.skippedPaths.length) {
    issues.push({
      severity: 'error',
      message: 'documentation skip result counts are inconsistent',
    });
  }

  if (
    writeResult.skippedUnchangedCount !== writeResult.skippedUnchangedPaths.length ||
    writeResult.skippedProtectedCount !== writeResult.skippedProtectedPaths.length
  ) {
    issues.push({
      severity: 'error',
      message: 'documentation skip category counts are inconsistent',
    });
  }

  const documentationPlan = getDocumentationPlan(knowledge);
  const docsRootPath = resolvePathWithinRoot(getProjectRoot(knowledge), getDocsDir(knowledge));
  const writtenPaths = new Set(writeResult.writtenPaths);
  const skippedUnchangedPaths = new Set(writeResult.skippedUnchangedPaths);
  const skippedProtectedPaths = new Set(writeResult.skippedProtectedPaths);

  if (writeResult.skippedProtectedCount > 0) {
    issues.push({
      severity: 'warning',
      message:
        writeResult.skippedProtectedCount === 1
          ? '1 user-managed document preserved'
          : `${writeResult.skippedProtectedCount} user-managed documents preserved`,
    });
  }

  for (const document of documentationPlan.documents) {
    if (skippedProtectedPaths.has(document.relativePath)) {
      continue;
    }

    if (skippedUnchangedPaths.has(document.relativePath)) {
      validateDocumentOnDisk(docsRootPath, document.relativePath, issues);
      continue;
    }

    if (!writtenPaths.has(document.relativePath)) {
      issues.push({
        severity: 'error',
        message: 'planned document was not written',
        relativePath: document.relativePath,
      });
      continue;
    }

    validateDocumentOnDisk(docsRootPath, document.relativePath, issues);
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    errorCount,
    warningCount,
    status: errorCount === 0 ? 'passed' : 'failed',
    issues,
  };
}
