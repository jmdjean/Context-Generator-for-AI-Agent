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
import { MODULE_DOCUMENTATION_PLAN_PATH } from './documentation-planner';
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

/** Playbook routing docs expected after module-plan expansion. */
const EXPECTED_PLAYBOOK_PATHS: readonly string[] = [
  'AI_START_HERE.md',
  'CONTEXT_ROUTER.md',
  'DOCUMENTATION_MAINTENANCE.md',
  'DOCUMENTATION_STATUS.md',
  'PROJECT_MAP.md',
  'code/index.md',
  MODULE_DOCUMENTATION_PLAN_PATH,
];

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

/**
 * Validates staged documentation PKM coverage against the documentation plan.
 * Uses PKM metadata only — does not parse Markdown bodies as source of truth.
 */
export function validateStagedDocumentationCoverage(
  knowledge: ProjectKnowledge,
): DocumentationValidationIssue[] {
  const issues: DocumentationValidationIssue[] = [];
  const staged = knowledge.analysis.stagedDocumentation;

  if (staged === undefined || staged.modulePlan === undefined) {
    return issues;
  }

  const plannedPaths = new Set(
    getDocumentationPlan(knowledge).documents.map((document) => document.relativePath),
  );
  const modules = knowledge.analysis.modules ?? [];

  for (const playbookPath of EXPECTED_PLAYBOOK_PATHS) {
    if (!plannedPaths.has(playbookPath)) {
      issues.push({
        severity: 'error',
        message: 'required playbook/module-plan document missing from documentation plan',
        relativePath: playbookPath,
      });
    }
  }

  for (const entry of staged.modulePlan.entries) {
    if (!plannedPaths.has(entry.documentPath)) {
      issues.push({
        severity: 'error',
        message: `module-plan entry "${entry.moduleId}" is missing from the documentation plan`,
        relativePath: entry.documentPath,
      });
    }
  }

  if (staged.modulePlan.entries.length !== modules.length) {
    issues.push({
      severity: 'warning',
      message: `module-plan entries (${staged.modulePlan.entries.length}) do not match discovered modules (${modules.length})`,
    });
  }

  const moduleResults = staged.moduleResults;
  if (moduleResults !== undefined) {
    const resultByModuleId = new Map(
      moduleResults.results.map((result) => [result.moduleId, result]),
    );

    for (const entry of staged.modulePlan.entries) {
      const result = resultByModuleId.get(entry.moduleId);
      if (result === undefined) {
        issues.push({
          severity: 'warning',
          message: `module-plan entry "${entry.moduleId}" has no moduleResults entry`,
          relativePath: entry.documentPath,
        });
        continue;
      }

      if (result.status === 'failed') {
        issues.push({
          severity: 'warning',
          message: result.error
            ? `module documentation AI failed: ${result.error}`
            : 'module documentation AI failed',
          relativePath: result.documentPath,
        });
      }
    }

    if (
      moduleResults.status === 'failed' ||
      (moduleResults.status === 'partial' &&
        moduleResults.results.every((result) => result.status === 'failed'))
    ) {
      issues.push({
        severity: 'warning',
        message: 'staged module documentation completed with failures; deterministic cards may still be present',
      });
    }
  }

  if (staged.architecture?.status === 'failed') {
    issues.push({
      severity: 'warning',
      message: staged.architecture.error
        ? `architecture stage failed: ${staged.architecture.error}`
        : 'architecture stage failed',
      relativePath: 'architecture.md',
    });
  }

  return issues;
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

  issues.push(...validateStagedDocumentationCoverage(knowledge));

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
