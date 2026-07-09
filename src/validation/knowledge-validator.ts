import * as fs from 'node:fs';
import * as path from 'node:path';
import { RepositoryNode } from '../domain';
import {
  formatKnowledgeRelativeFilePath,
  getDocsDir,
  getProjectRoot,
  KNOWLEDGE_FILE_NAMES,
  KnowledgeFileName,
  ProjectKnowledge,
  resolveKnowledgeFilePath,
} from '../knowledge';
import { ValidationIssue } from './validation-result';

const REQUIRED_KNOWLEDGE_FILES: ReadonlyArray<KnowledgeFileName> = [
  KNOWLEDGE_FILE_NAMES.projectKnowledge,
  KNOWLEDGE_FILE_NAMES.repository,
  KNOWLEDGE_FILE_NAMES.technologies,
  KNOWLEDGE_FILE_NAMES.documentation,
  KNOWLEDGE_FILE_NAMES.analysis,
];

const UNMATCHED_LIST_LIMIT = 5;

function readFileIfPresent(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

function formatUnmatchedList(values: string[]): string {
  const shown = values.slice(0, UNMATCHED_LIST_LIMIT).join(', ');
  const remainder = values.length - UNMATCHED_LIST_LIMIT;
  return remainder > 0 ? `${shown} (and ${remainder} more)` : shown;
}

function validateKnowledgeFilesExist(knowledge: ProjectKnowledge): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rootPath = getProjectRoot(knowledge);
  const docsDir = getDocsDir(knowledge);

  for (const fileName of REQUIRED_KNOWLEDGE_FILES) {
    const filePath = resolveKnowledgeFilePath(rootPath, docsDir, fileName);
    if (!fs.existsSync(filePath)) {
      issues.push({
        severity: 'error',
        code: 'knowledge-file-missing',
        message: `Persisted knowledge file is missing: ${fileName}`,
        path: formatKnowledgeRelativeFilePath(docsDir, fileName),
        recommendation: 'Run the full pipeline so the Persist Project Knowledge step writes this file.',
      });
    }
  }
  return issues;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function validatePersistedSnapshot(knowledge: ProjectKnowledge): ValidationIssue[] {
  const docsDir = getDocsDir(knowledge);
  const snapshotRelativePath = formatKnowledgeRelativeFilePath(
    docsDir,
    KNOWLEDGE_FILE_NAMES.projectKnowledge,
  );
  const snapshotPath = resolveKnowledgeFilePath(
    getProjectRoot(knowledge),
    docsDir,
    KNOWLEDGE_FILE_NAMES.projectKnowledge,
  );

  const content = readFileIfPresent(snapshotPath);
  if (content === undefined) {
    return [];
  }

  let snapshot: unknown;
  try {
    snapshot = JSON.parse(content);
  } catch {
    return [
      {
        severity: 'error',
        code: 'knowledge-snapshot-unparseable',
        message: 'project-knowledge.json exists but is not valid JSON.',
        path: snapshotRelativePath,
        recommendation: 'Re-run the pipeline to regenerate the snapshot; do not edit knowledge JSON by hand.',
      },
    ];
  }

  const issues: ValidationIssue[] = [];
  const snapshotRecord = asRecord(snapshot) ?? {};
  const metadata = asRecord(snapshotRecord.metadata) ?? {};
  const repository = asRecord(snapshotRecord.repository);
  const technologies = asRecord(snapshotRecord.technologies);

  const requiredFields: ReadonlyArray<[string, boolean]> = [
    ['metadata.schemaVersion', isNonEmptyString(metadata.schemaVersion)],
    ['metadata.generatedAt', isNonEmptyString(metadata.generatedAt)],
    ['repository', repository !== undefined && isNonEmptyString(repository.name) && isNonEmptyString(repository.rootPath)],
    ['technologies', technologies !== undefined && Array.isArray(technologies.languages)],
  ];

  for (const [field, valid] of requiredFields) {
    if (!valid) {
      issues.push({
        severity: 'error',
        code: 'knowledge-snapshot-invalid',
        message: `Persisted project knowledge is missing or has invalid "${field}".`,
        path: snapshotRelativePath,
        recommendation: 'Re-run the pipeline to regenerate the snapshot.',
      });
    }
  }
  return issues;
}

function validateAnalysisSections(knowledge: ProjectKnowledge): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { analysis } = knowledge;

  const sections: ReadonlyArray<[string, unknown, number | undefined]> = [
    ['folderContexts', analysis.folderContexts, analysis.folderContexts?.length],
    ['modules', analysis.modules, analysis.modules?.length],
    ['dependencyGraph', analysis.dependencyGraph, analysis.dependencyGraph?.nodes.length],
    ['conventions', analysis.conventions, analysis.conventions?.length],
    ['navigationMap', analysis.navigationMap, analysis.navigationMap?.entries.length],
  ];

  for (const [name, section, entryCount] of sections) {
    if (section === undefined) {
      issues.push({
        severity: 'warning',
        code: 'analysis-section-missing',
        message: `PKM analysis section "${name}" is not populated.`,
        recommendation: `Ensure the analyzer that produces "${name}" ran and completed.`,
      });
    } else if (entryCount === 0) {
      issues.push({
        severity: 'info',
        code: 'analysis-section-empty',
        message: `PKM analysis section "${name}" is present but empty.`,
        recommendation: 'This can be normal for very small repositories; verify it matches expectations.',
      });
    }
  }

  if (analysis.status !== 'complete') {
    issues.push({
      severity: 'info',
      code: 'analysis-status-incomplete',
      message: `PKM analysis status is "${analysis.status}" — AI-powered enrichment has not run yet.`,
      recommendation: 'Deterministic knowledge is still trustworthy; deeper analysis arrives with the AI stage.',
    });
  }
  return issues;
}

function collectTreeDirectoryPaths(tree: RepositoryNode | undefined): Set<string> {
  const paths = new Set<string>();

  function walk(node: RepositoryNode): void {
    if (node.type === 'directory') {
      paths.add(node.relativePath);
      for (const child of node.children ?? []) {
        walk(child);
      }
    }
  }

  if (tree) {
    walk(tree);
  }
  return paths;
}

function isValidRelativePath(relativePath: string): boolean {
  if (path.isAbsolute(relativePath)) {
    return false;
  }
  return !relativePath.split(/[\\/]/).includes('..');
}

function validateFolderContextPaths(knowledge: ProjectKnowledge): ValidationIssue[] {
  const invalidPaths = (knowledge.analysis.folderContexts ?? [])
    .map((folder) => folder.relativePath)
    .filter((relativePath) => !isValidRelativePath(relativePath));

  if (invalidPaths.length === 0) {
    return [];
  }

  return [
    {
      severity: 'error',
      code: 'folder-path-invalid',
      message: `Folder contexts contain invalid relative paths: ${formatUnmatchedList(invalidPaths)}`,
      recommendation: 'Folder analyzer output must use repository-relative paths without ".." segments.',
    },
  ];
}

function validateDependencyGraphConsistency(knowledge: ProjectKnowledge): ValidationIssue[] {
  const graph = knowledge.analysis.dependencyGraph;
  const modules = knowledge.analysis.modules;

  if (!graph || !modules || modules.length === 0) {
    return [];
  }

  const modulePaths = new Set(modules.map((module) => module.relativePath));
  const unmatchedNodes = graph.nodes
    .map((node) => node.relativePath)
    .filter((relativePath) => !modulePaths.has(relativePath));

  if (unmatchedNodes.length === 0) {
    return [];
  }

  return [
    {
      severity: 'warning',
      code: 'dependency-node-unknown-module',
      message: `Dependency graph nodes do not match any discovered module: ${formatUnmatchedList(unmatchedNodes)}`,
      recommendation: 'Re-run the pipeline so module discovery and the dependency graph come from the same PKM snapshot.',
    },
  ];
}

function validateModulePathsExist(knowledge: ProjectKnowledge): ValidationIssue[] {
  const modules = knowledge.analysis.modules;
  const folderContexts = knowledge.analysis.folderContexts;
  const tree = knowledge.repository.repositoryTree;

  if (!modules || modules.length === 0 || (!folderContexts && !tree)) {
    return [];
  }

  const knownPaths = collectTreeDirectoryPaths(tree);
  for (const folder of folderContexts ?? []) {
    knownPaths.add(folder.relativePath);
  }
  // The docs directory is generated output: the module analyzer documents it
  // while the scanner intentionally excludes it from the repository tree.
  knownPaths.add(getDocsDir(knowledge));

  const unknownModulePaths = modules
    .map((module) => module.relativePath)
    .filter((relativePath) => !knownPaths.has(relativePath));

  if (unknownModulePaths.length === 0) {
    return [];
  }

  return [
    {
      severity: 'warning',
      code: 'module-path-unknown',
      message: `Discovered modules point at paths not found in folder knowledge or the repository tree: ${formatUnmatchedList(unknownModulePaths)}`,
      recommendation: 'Re-run the pipeline so module discovery reflects the current repository structure.',
    },
  ];
}

export function validateKnowledge(knowledge: ProjectKnowledge): ValidationIssue[] {
  return [
    ...validateKnowledgeFilesExist(knowledge),
    ...validatePersistedSnapshot(knowledge),
    ...validateAnalysisSections(knowledge),
    ...validateFolderContextPaths(knowledge),
    ...validateDependencyGraphConsistency(knowledge),
    ...validateModulePathsExist(knowledge),
  ];
}
