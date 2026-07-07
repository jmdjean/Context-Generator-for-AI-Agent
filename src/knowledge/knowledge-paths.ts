import * as path from 'node:path';
import { resolvePathWithinRoot } from '../utils/fs';

export const KNOWLEDGE_DIRECTORY_NAME = 'knowledge';

export const KNOWLEDGE_FILE_NAMES = {
  projectKnowledge: 'project-knowledge.json',
  repository: 'repository.json',
  repositoryTree: 'repository-tree.json',
  technologies: 'technologies.json',
  documentation: 'documentation.json',
  analysis: 'analysis.json',
  folders: 'folders.json',
  modules: 'modules.json',
  dependencies: 'dependencies.json',
  conventions: 'conventions.json',
} as const;

export type KnowledgeFileName =
  (typeof KNOWLEDGE_FILE_NAMES)[keyof typeof KNOWLEDGE_FILE_NAMES];

export function getKnowledgeDirectoryRelativePath(docsDir: string): string {
  return path.posix.join(docsDir, KNOWLEDGE_DIRECTORY_NAME);
}

export function resolveKnowledgeDirectory(rootPath: string, docsDir: string): string {
  return resolvePathWithinRoot(rootPath, getKnowledgeDirectoryRelativePath(docsDir));
}

export function resolveKnowledgeFilePath(
  rootPath: string,
  docsDir: string,
  fileName: KnowledgeFileName,
): string {
  return resolvePathWithinRoot(
    rootPath,
    path.posix.join(getKnowledgeDirectoryRelativePath(docsDir), fileName),
  );
}

export function formatKnowledgeRelativeFilePath(docsDir: string, fileName: KnowledgeFileName): string {
  return path.posix.join(getKnowledgeDirectoryRelativePath(docsDir), fileName);
}

export function listKnowledgeRelativeFilePaths(
  docsDir: string,
  includeRepositoryTree = true,
  includeFolders = false,
  includeModules = false,
  includeDependencies = false,
  includeConventions = false,
): string[] {
  return listPersistedKnowledgeRelativeFilePaths(
    docsDir,
    includeRepositoryTree,
    includeFolders,
    includeModules,
    includeDependencies,
    includeConventions,
  );
}

export function listPersistedKnowledgeRelativeFilePaths(
  docsDir: string,
  includeRepositoryTree: boolean,
  includeFolders = true,
  includeModules = true,
  includeDependencies = true,
  includeConventions = true,
): string[] {
  const fileNames = Object.values(KNOWLEDGE_FILE_NAMES).filter((fileName) => {
    if (fileName === KNOWLEDGE_FILE_NAMES.repositoryTree) {
      return includeRepositoryTree;
    }
    if (fileName === KNOWLEDGE_FILE_NAMES.folders) {
      return includeFolders;
    }
    if (fileName === KNOWLEDGE_FILE_NAMES.modules) {
      return includeModules;
    }
    if (fileName === KNOWLEDGE_FILE_NAMES.dependencies) {
      return includeDependencies;
    }
    if (fileName === KNOWLEDGE_FILE_NAMES.conventions) {
      return includeConventions;
    }
    return true;
  });

  return fileNames.map((fileName) => formatKnowledgeRelativeFilePath(docsDir, fileName));
}
