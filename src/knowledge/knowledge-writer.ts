import * as fs from 'node:fs';
import { getDocsDir, getProjectRoot } from './accessors';
import {
  KNOWLEDGE_FILE_NAMES,
  KnowledgeFileName,
  listPersistedKnowledgeRelativeFilePaths,
  resolveKnowledgeDirectory,
  resolveKnowledgeFilePath,
} from './knowledge-paths';
import {
  AnalysisKnowledge,
  ConventionKnowledge,
  DependencyGraphKnowledge,
  DocumentationKnowledge,
  FolderKnowledge,
  ModuleKnowledge,
  ProjectKnowledge,
  RepositoryKnowledge,
  TechnologyKnowledge,
} from './project-knowledge';
import { RepositoryNode } from '../domain';

export interface KnowledgePersistenceResult {
  schemaVersion: string;
  schemaVersionLabel: string;
  knowledgeDirectoryPath: string;
  persistedRelativePaths: string[];
}

interface PersistedKnowledgeHeader {
  schemaVersion: string;
  generatedAt: string;
}

type PersistedRepositoryKnowledge = PersistedKnowledgeHeader & RepositoryKnowledge;
type PersistedTechnologyKnowledge = PersistedKnowledgeHeader & TechnologyKnowledge;
type PersistedDocumentationKnowledge = PersistedKnowledgeHeader & DocumentationKnowledge;
type PersistedAnalysisKnowledge = PersistedKnowledgeHeader & AnalysisKnowledge;

function buildPersistedHeader(knowledge: ProjectKnowledge): PersistedKnowledgeHeader {
  return {
    schemaVersion: knowledge.metadata.schemaVersion,
    generatedAt: knowledge.metadata.generatedAt,
  };
}

function formatSchemaVersionLabel(schemaVersion: string): string {
  const majorVersion = schemaVersion.split('.')[0];
  return majorVersion.length > 0 ? majorVersion : schemaVersion;
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

interface PersistedRepositoryTreeKnowledge extends PersistedKnowledgeHeader {
  tree: RepositoryNode;
}

interface PersistedFoldersKnowledge extends PersistedKnowledgeHeader {
  folders: FolderKnowledge[];
}

interface PersistedModulesKnowledge extends PersistedKnowledgeHeader {
  modules: ModuleKnowledge[];
}

interface PersistedDependenciesKnowledge extends PersistedKnowledgeHeader {
  dependencyGraph: DependencyGraphKnowledge;
}

interface PersistedConventionsKnowledge extends PersistedKnowledgeHeader {
  conventions: ConventionKnowledge[];
}

function buildKnowledgeFiles(
  knowledge: ProjectKnowledge,
): ReadonlyArray<[KnowledgeFileName, unknown]> {
  const header = buildPersistedHeader(knowledge);
  const { repositoryTree: _repositoryTree, ...repositoryMetadata } = knowledge.repository;
  const files: Array<[KnowledgeFileName, unknown]> = [
    [KNOWLEDGE_FILE_NAMES.projectKnowledge, knowledge],
    [KNOWLEDGE_FILE_NAMES.repository, { ...header, ...repositoryMetadata }],
    [KNOWLEDGE_FILE_NAMES.technologies, { ...header, ...knowledge.technologies }],
    [KNOWLEDGE_FILE_NAMES.documentation, { ...header, ...knowledge.documentation }],
    [KNOWLEDGE_FILE_NAMES.analysis, { ...header, ...knowledge.analysis }],
  ];

  if (knowledge.repository.repositoryTree !== undefined) {
    const repositoryTreePayload: PersistedRepositoryTreeKnowledge = {
      ...header,
      tree: knowledge.repository.repositoryTree,
    };
    files.push([KNOWLEDGE_FILE_NAMES.repositoryTree, repositoryTreePayload]);
  }

  if (knowledge.analysis.folderContexts !== undefined && knowledge.analysis.folderContexts.length > 0) {
    const foldersPayload: PersistedFoldersKnowledge = {
      ...header,
      folders: knowledge.analysis.folderContexts,
    };
    files.push([KNOWLEDGE_FILE_NAMES.folders, foldersPayload]);
  }

  if (knowledge.analysis.modules !== undefined && knowledge.analysis.modules.length > 0) {
    const modulesPayload: PersistedModulesKnowledge = {
      ...header,
      modules: knowledge.analysis.modules,
    };
    files.push([KNOWLEDGE_FILE_NAMES.modules, modulesPayload]);
  }

  if (knowledge.analysis.dependencyGraph !== undefined) {
    const dependenciesPayload: PersistedDependenciesKnowledge = {
      ...header,
      dependencyGraph: knowledge.analysis.dependencyGraph,
    };
    files.push([KNOWLEDGE_FILE_NAMES.dependencies, dependenciesPayload]);
  }

  if (knowledge.analysis.conventions !== undefined && knowledge.analysis.conventions.length > 0) {
    const conventionsPayload: PersistedConventionsKnowledge = {
      ...header,
      conventions: knowledge.analysis.conventions,
    };
    files.push([KNOWLEDGE_FILE_NAMES.conventions, conventionsPayload]);
  }

  return files;
}

export function persistProjectKnowledge(knowledge: ProjectKnowledge): KnowledgePersistenceResult {
  const rootPath = getProjectRoot(knowledge);
  const docsDir = getDocsDir(knowledge);
  const knowledgeDirectoryPath = resolveKnowledgeDirectory(rootPath, docsDir);

  fs.mkdirSync(knowledgeDirectoryPath, { recursive: true });

  for (const [fileName, data] of buildKnowledgeFiles(knowledge)) {
    writeJsonFile(resolveKnowledgeFilePath(rootPath, docsDir, fileName), data);
  }

  const repositoryTreePath = resolveKnowledgeFilePath(
    rootPath,
    docsDir,
    KNOWLEDGE_FILE_NAMES.repositoryTree,
  );

  if (knowledge.repository.repositoryTree === undefined && fs.existsSync(repositoryTreePath)) {
    fs.unlinkSync(repositoryTreePath);
  }

  const foldersPath = resolveKnowledgeFilePath(
    rootPath,
    docsDir,
    KNOWLEDGE_FILE_NAMES.folders,
  );
  const hasFolderContexts =
    knowledge.analysis.folderContexts !== undefined &&
    knowledge.analysis.folderContexts.length > 0;

  if (!hasFolderContexts && fs.existsSync(foldersPath)) {
    fs.unlinkSync(foldersPath);
  }

  const modulesPath = resolveKnowledgeFilePath(
    rootPath,
    docsDir,
    KNOWLEDGE_FILE_NAMES.modules,
  );
  const hasModules =
    knowledge.analysis.modules !== undefined && knowledge.analysis.modules.length > 0;

  if (!hasModules && fs.existsSync(modulesPath)) {
    fs.unlinkSync(modulesPath);
  }

  const dependenciesPath = resolveKnowledgeFilePath(
    rootPath,
    docsDir,
    KNOWLEDGE_FILE_NAMES.dependencies,
  );
  const hasDependencyGraph = knowledge.analysis.dependencyGraph !== undefined;

  if (!hasDependencyGraph && fs.existsSync(dependenciesPath)) {
    fs.unlinkSync(dependenciesPath);
  }

  const conventionsPath = resolveKnowledgeFilePath(
    rootPath,
    docsDir,
    KNOWLEDGE_FILE_NAMES.conventions,
  );
  const hasConventions =
    knowledge.analysis.conventions !== undefined && knowledge.analysis.conventions.length > 0;

  if (!hasConventions && fs.existsSync(conventionsPath)) {
    fs.unlinkSync(conventionsPath);
  }

  return {
    schemaVersion: knowledge.metadata.schemaVersion,
    schemaVersionLabel: formatSchemaVersionLabel(knowledge.metadata.schemaVersion),
    knowledgeDirectoryPath,
    persistedRelativePaths: listPersistedKnowledgeRelativeFilePaths(
      docsDir,
      knowledge.repository.repositoryTree !== undefined,
      hasFolderContexts,
      hasModules,
      hasDependencyGraph,
      hasConventions,
    ),
  };
}
