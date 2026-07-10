import * as fs from 'node:fs';
import {
  getDocsDir,
  getDocumentationPlan,
  getProjectRoot,
  KNOWLEDGE_FILE_NAMES,
  ProjectKnowledge,
  resolveKnowledgeFilePath,
} from '../knowledge';
import {
  AI_READINESS_DOCUMENT_PATH,
  MAX_READINESS_SCORE,
  MIN_READINESS_SCORE,
} from '../readiness/ai-readiness-model';
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

const EXPECTED_READINESS_WEIGHT_TOTAL = 100;

function isValidScore(value: number): boolean {
  return (
    Number.isFinite(value) && value >= MIN_READINESS_SCORE && value <= MAX_READINESS_SCORE
  );
}

/**
 * Validates the structure of the persisted AI Readiness result. A low score is
 * an assessment outcome and never produces issues here; only structurally
 * invalid results (impossible scores, broken weights, ungrounded
 * recommendations, missing persisted files) are reported as errors.
 */
export function validateAiReadiness(
  knowledge: ProjectKnowledge,
): DocumentationValidationIssue[] {
  const issues: DocumentationValidationIssue[] = [];
  const readiness = knowledge.analysis.aiReadiness;

  if (!readiness) {
    issues.push({
      severity: 'error',
      message: 'analysis.aiReadiness is missing after the readiness step',
    });
    return issues;
  }

  if (!isValidScore(readiness.overallScore)) {
    issues.push({
      severity: 'error',
      message: `AI readiness overall score ${readiness.overallScore} is outside the 0-100 range`,
    });
  }

  const weightTotal = readiness.categories.reduce((sum, category) => sum + category.weight, 0);
  if (weightTotal !== EXPECTED_READINESS_WEIGHT_TOTAL) {
    issues.push({
      severity: 'error',
      message: `AI readiness category weights total ${weightTotal} instead of ${EXPECTED_READINESS_WEIGHT_TOTAL}`,
    });
  }

  for (const category of readiness.categories) {
    if (!isValidScore(category.score)) {
      issues.push({
        severity: 'error',
        message: `AI readiness category "${category.id}" has invalid score ${category.score}`,
      });
    }
  }

  const actionableFindingIds = new Set(
    readiness.categories
      .flatMap((category) => category.findings)
      .filter((finding) => finding.status === 'failed' || finding.status === 'partial')
      .map((finding) => finding.id),
  );
  for (const recommendation of readiness.recommendations) {
    if (!actionableFindingIds.has(recommendation.findingId)) {
      issues.push({
        severity: 'error',
        message: `AI readiness recommendation "${recommendation.action}" does not correspond to a partial or failed finding`,
      });
    }
  }

  const rootPath = getProjectRoot(knowledge);
  const docsDir = getDocsDir(knowledge);
  const readinessJsonPath = resolveKnowledgeFilePath(
    rootPath,
    docsDir,
    KNOWLEDGE_FILE_NAMES.aiReadiness,
  );
  if (!fs.existsSync(readinessJsonPath)) {
    issues.push({
      severity: 'error',
      message: 'ai-readiness.json is missing from the knowledge directory',
      relativePath: `knowledge/${KNOWLEDGE_FILE_NAMES.aiReadiness}`,
    });
  }

  const markdownPlanned = getDocumentationPlan(knowledge).documents.some(
    (document) => document.relativePath === AI_READINESS_DOCUMENT_PATH,
  );
  if (markdownPlanned) {
    const markdownPath = resolvePathWithinRoot(
      resolvePathWithinRoot(rootPath, docsDir),
      AI_READINESS_DOCUMENT_PATH,
    );
    if (!fs.existsSync(markdownPath)) {
      issues.push({
        severity: 'error',
        message: 'ai-readiness.md is planned but missing on disk',
        relativePath: AI_READINESS_DOCUMENT_PATH,
      });
    }
  }

  return issues;
}

/**
 * Merges late-stage issues (for example AI readiness checks) into an existing
 * validation result, recomputing counts and overall status.
 */
export function mergeValidationIssues(
  result: DocumentationValidationResult | undefined,
  additionalIssues: DocumentationValidationIssue[],
): DocumentationValidationResult {
  const issues = [...(result?.issues ?? []), ...additionalIssues];
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    errorCount,
    warningCount,
    status: errorCount === 0 ? 'passed' : 'failed',
    issues,
  };
}
