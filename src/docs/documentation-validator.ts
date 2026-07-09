import * as fs from 'node:fs';
import { getDocsDir, getDocumentationPlan, getProjectRoot, ProjectKnowledge } from '../knowledge';
import { resolvePathWithinRoot } from '../utils/fs';
import { GENERATED_FILE_MARKER } from './document-template';

export type DocumentationValidationStatus = 'passed' | 'failed';

export interface DocumentationValidationIssue {
  documentPath: string;
  message: string;
}

export interface DocumentationValidationResult {
  status: DocumentationValidationStatus;
  documentsChecked: number;
  errors: DocumentationValidationIssue[];
  warnings: DocumentationValidationIssue[];
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

function hasMarkdownTitle(content: string): boolean {
  return content.split('\n').some((line) => line.startsWith('# '));
}

export function validateDocumentation(knowledge: ProjectKnowledge): DocumentationValidationResult {
  const documentationPlan = getDocumentationPlan(knowledge);
  const docsRootPath = resolvePathWithinRoot(getProjectRoot(knowledge), getDocsDir(knowledge));

  const errors: DocumentationValidationIssue[] = [];
  const warnings: DocumentationValidationIssue[] = [];

  for (const document of documentationPlan.documents) {
    const outputPath = resolvePathWithinRoot(docsRootPath, document.relativePath);
    const content = readFileIfPresent(outputPath);

    if (content === undefined) {
      errors.push({
        documentPath: document.relativePath,
        message: 'planned document is missing from the docs directory',
      });
      continue;
    }

    if (content.trim() === '') {
      errors.push({
        documentPath: document.relativePath,
        message: 'document exists but is empty',
      });
      continue;
    }

    if (!content.startsWith(GENERATED_FILE_MARKER)) {
      warnings.push({
        documentPath: document.relativePath,
        message: 'document is user-managed (no generated-file marker) and was left untouched',
      });
      continue;
    }

    if (!hasMarkdownTitle(content)) {
      warnings.push({
        documentPath: document.relativePath,
        message: 'generated document has no top-level Markdown heading',
      });
    }
  }

  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    documentsChecked: documentationPlan.documents.length,
    errors,
    warnings,
  };
}
