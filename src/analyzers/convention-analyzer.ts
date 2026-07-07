import * as fs from 'node:fs';
import { RepositoryNode } from '../domain';
import { ConventionKnowledge, ProjectKnowledge } from '../knowledge/project-knowledge';
import { RepositoryBoundary, createRepositoryBoundary } from '../scanner/repository-boundary';
import { toPosixPath } from './folder-constants';
import {
  ConventionDetectionInput,
  detectArchitectureConventions,
  detectDocumentationConventions,
  detectGeneratedContextConventions,
  detectPackageManagerConventions,
  detectRepositoryStructureConventions,
  detectTestingConventions,
  detectTypeScriptConventions,
  sortConventions,
} from './convention-classifier';

export interface ConventionAnalysisResult {
  conventions: ConventionKnowledge[];
  totalConventions: number;
  highConfidenceConventions: number;
  mediumConfidenceConventions: number;
  lowConfidenceConventions: number;
}

const SAFE_CONFIG_FILE_NAMES = new Set(['tsconfig.json', 'package.json']);

interface RepositoryTreeIndex {
  filePaths: Set<string>;
  folderPaths: Set<string>;
}

function indexRepositoryTree(tree: RepositoryNode | undefined): RepositoryTreeIndex {
  const filePaths = new Set<string>();
  const folderPaths = new Set<string>();

  const visit = (node: RepositoryNode): void => {
    const relativePath = toPosixPath(node.relativePath);

    if (node.type === 'file') {
      filePaths.add(relativePath);
      return;
    }

    if (relativePath.length > 0) {
      folderPaths.add(relativePath);
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  };

  if (tree !== undefined) {
    visit(tree);
  }

  return { filePaths, folderPaths };
}

function readSafeConfigFile(
  boundary: RepositoryBoundary,
  fileName: string,
  index: RepositoryTreeIndex,
  detectedFiles: readonly string[],
): string | undefined {
  if (!SAFE_CONFIG_FILE_NAMES.has(fileName)) {
    return undefined;
  }

  if (!index.filePaths.has(fileName) && !detectedFiles.includes(fileName)) {
    return undefined;
  }

  try {
    return fs.readFileSync(boundary.resolveRelative(fileName), 'utf-8');
  } catch {
    return undefined;
  }
}

function buildDetectionInput(knowledge: ProjectKnowledge): ConventionDetectionInput {
  const index = indexRepositoryTree(knowledge.repository.repositoryTree);
  const detectedFiles = knowledge.repository.detectedFiles;
  const boundary = createRepositoryBoundary(knowledge.repository.rootPath);

  return {
    docsDir: toPosixPath(knowledge.metadata.docsDir),
    filePaths: index.filePaths,
    folderPaths: index.folderPaths,
    detectedFiles,
    languages: knowledge.technologies.languages,
    packageManagers: knowledge.technologies.packageManagers,
    modules: knowledge.analysis.modules ?? [],
    tsconfigText: readSafeConfigFile(boundary, 'tsconfig.json', index, detectedFiles),
    packageJsonText: readSafeConfigFile(boundary, 'package.json', index, detectedFiles),
  };
}

function countByConfidence(
  conventions: ConventionKnowledge[],
  confidence: ConventionKnowledge['confidence'],
): number {
  return conventions.filter((convention) => convention.confidence === confidence).length;
}

export function analyzeConventions(knowledge: ProjectKnowledge): ConventionAnalysisResult {
  const input = buildDetectionInput(knowledge);

  const conventions = sortConventions([
    ...detectTypeScriptConventions(input),
    ...detectPackageManagerConventions(input),
    ...detectRepositoryStructureConventions(input),
    ...detectArchitectureConventions(input),
    ...detectTestingConventions(input),
    ...detectDocumentationConventions(input),
    ...detectGeneratedContextConventions(input),
  ]);

  return {
    conventions,
    totalConventions: conventions.length,
    highConfidenceConventions: countByConfidence(conventions, 'high'),
    mediumConfidenceConventions: countByConfidence(conventions, 'medium'),
    lowConfidenceConventions: countByConfidence(conventions, 'low'),
  };
}

export function enrichProjectKnowledgeWithConventions(
  knowledge: ProjectKnowledge,
): { knowledge: ProjectKnowledge; result: ConventionAnalysisResult } {
  const result = analyzeConventions(knowledge);
  const hasConventions = result.conventions.length > 0;

  return {
    knowledge: {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        status:
          hasConventions || knowledge.analysis.status === 'partial'
            ? 'partial'
            : knowledge.analysis.status,
        conventions: hasConventions ? result.conventions : undefined,
      },
    },
    result,
  };
}
