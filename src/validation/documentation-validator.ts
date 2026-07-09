import * as fs from 'node:fs';
import { PlannedDocument } from '../domain/documentation-plan';
import { GENERATED_FILE_MARKER } from '../docs/document-template';
import { getDocsDir, getDocumentationPlan, getProjectRoot, ProjectKnowledge } from '../knowledge';
import { resolvePathWithinRoot } from '../utils/fs';
import { ValidationIssue } from './validation-result';

export const KEY_DOCUMENT_PATHS: ReadonlyArray<string> = [
  'architecture.md',
  'folder-structure.md',
  'dependency-map.md',
  'conventions.md',
  'agent-navigation.md',
  'ai-context.md',
  'implementation-guide.md',
];

export interface DocumentationValidationOptions {
  skippedDocumentPaths?: readonly string[];
}

function readFileIfPresent(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function hasGeneratedMarker(content: string): boolean {
  return content.startsWith(GENERATED_FILE_MARKER);
}

function isEffectivelyEmpty(content: string): boolean {
  return content.replace(GENERATED_FILE_MARKER, '').trim().length === 0;
}

function validateMissingDocument(
  document: PlannedDocument,
  docsDir: string,
): ValidationIssue {
  const relativeDocPath = `${docsDir}/${document.relativePath}`;

  if (document.priority === 'required') {
    return {
      severity: 'error',
      code: 'required-document-missing',
      message: `Required planned document was not written: ${document.relativePath}`,
      path: relativeDocPath,
      recommendation: 'Re-run the pipeline; if the file was deleted manually, the next run recreates it.',
    };
  }

  return {
    severity: 'info',
    code: 'optional-document-missing',
    message: `Planned ${document.priority} document does not exist: ${document.relativePath}`,
    path: relativeDocPath,
  };
}

function validateExistingDocument(
  document: PlannedDocument,
  content: string,
  docsDir: string,
  skippedDocumentPaths: ReadonlySet<string>,
): ValidationIssue[] {
  const relativeDocPath = `${docsDir}/${document.relativePath}`;

  if (!hasGeneratedMarker(content)) {
    const skippedNote = skippedDocumentPaths.has(document.relativePath)
      ? ' The writer intentionally skipped it this run.'
      : '';
    return [
      {
        severity: 'info',
        code: 'document-user-managed',
        message: `${document.relativePath} has no generated marker and is treated as user-managed.${skippedNote}`,
        path: relativeDocPath,
        recommendation: 'Keep it if intentional; delete it to let the tool regenerate a managed version.',
      },
    ];
  }

  if (isEffectivelyEmpty(content)) {
    const isKeyDocument = KEY_DOCUMENT_PATHS.includes(document.relativePath);
    return [
      {
        severity: isKeyDocument ? 'error' : 'warning',
        code: 'document-empty',
        message: `Generated document has no content beyond the marker: ${document.relativePath}`,
        path: relativeDocPath,
        recommendation: 'Re-run the pipeline; an empty generated document indicates a rendering failure.',
      },
    ];
  }

  return [];
}

function validatePlannedDocuments(
  knowledge: ProjectKnowledge,
  docsRootPath: string,
  skippedDocumentPaths: ReadonlySet<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const docsDir = getDocsDir(knowledge);

  for (const document of getDocumentationPlan(knowledge).documents) {
    const documentPath = resolvePathWithinRoot(docsRootPath, document.relativePath);
    const content = readFileIfPresent(documentPath);

    if (content === undefined) {
      issues.push(validateMissingDocument(document, docsDir));
    } else {
      issues.push(...validateExistingDocument(document, content, docsDir, skippedDocumentPaths));
    }
  }
  return issues;
}

function validateNavigationDocumentReferences(knowledge: ProjectKnowledge): ValidationIssue[] {
  const navigationMap = knowledge.analysis.navigationMap;
  if (!navigationMap) {
    return [];
  }

  const plannedPaths = new Set(
    getDocumentationPlan(knowledge).documents.map((document) => document.relativePath),
  );
  const unplannedReferences = new Map<string, string[]>();

  for (const entry of navigationMap.entries) {
    for (const recommendedDocument of entry.recommendedDocuments) {
      if (!plannedPaths.has(recommendedDocument)) {
        const taskTypes = unplannedReferences.get(recommendedDocument) ?? [];
        taskTypes.push(entry.taskType);
        unplannedReferences.set(recommendedDocument, taskTypes);
      }
    }
  }

  return [...unplannedReferences.entries()].map(([recommendedDocument, taskTypes]) => ({
    severity: 'warning' as const,
    code: 'navigation-document-unplanned',
    message: `Navigation map recommends "${recommendedDocument}" (task types: ${taskTypes.join(', ')}) but it is not in the documentation plan.`,
    recommendation: 'Align the navigation rules with the documentation plan so agents are never sent to missing documents.',
  }));
}

export function validateDocumentation(
  knowledge: ProjectKnowledge,
  options: DocumentationValidationOptions = {},
): ValidationIssue[] {
  const docsDir = getDocsDir(knowledge);
  const docsRootPath = resolvePathWithinRoot(getProjectRoot(knowledge), docsDir);

  if (!isDirectory(docsRootPath)) {
    return [
      {
        severity: 'error',
        code: 'docs-directory-missing',
        message: `Docs directory does not exist: ${docsDir}`,
        path: docsDir,
        recommendation: 'Run the pipeline through the Write Documentation step before validating.',
      },
    ];
  }

  const skippedDocumentPaths = new Set(options.skippedDocumentPaths ?? []);

  return [
    ...validatePlannedDocuments(knowledge, docsRootPath, skippedDocumentPaths),
    ...validateNavigationDocumentReferences(knowledge),
  ];
}
