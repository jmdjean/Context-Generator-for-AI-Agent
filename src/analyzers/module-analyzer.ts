import { RepositoryNode } from '../domain';
import {
  FolderKnowledge,
  ModuleKnowledge,
  ModuleType,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { resolvePathWithinRoot } from '../utils/fs';
import { isImportantFile, toPosixPath } from './folder-constants';
import {
  ModuleClassificationInput,
  ModuleClassificationResult,
  classifyModule,
  inferModuleResponsibility,
  shouldIgnoreModulePath,
} from './module-classifier';
import { isDocumentationModulePath } from './module-constants';

export interface ModuleAnalysisResult {
  modules: ModuleKnowledge[];
  totalModules: number;
  highConfidenceModules: number;
  mediumConfidenceModules: number;
  lowConfidenceModules: number;
}

const GROUP_MODULE_TYPES = new Set<ModuleType>(['component-group', 'service-group']);

function inferFramework(
  moduleType: ModuleKnowledge['type'],
  frameworks: readonly string[],
): string | undefined {
  if (frameworks.length === 0 || moduleType !== 'application') {
    return undefined;
  }

  return frameworks[0];
}

function collectImportantFiles(children: RepositoryNode[] | undefined): string[] {
  if (children === undefined) {
    return [];
  }

  return children
    .filter((child) => child.type === 'file' && isImportantFile(child.name))
    .map((child) => child.relativePath)
    .sort();
}

function collectChildFolders(children: RepositoryNode[] | undefined): string[] {
  if (children === undefined) {
    return [];
  }

  return children
    .filter((child) => child.type === 'directory')
    .map((child) => child.name)
    .sort();
}

function findDirectoryNode(
  node: RepositoryNode | undefined,
  relativePath: string,
): RepositoryNode | undefined {
  if (node === undefined || node.type !== 'directory') {
    return undefined;
  }

  const targetPath = toPosixPath(relativePath);
  const nodePath = toPosixPath(node.relativePath);

  if (nodePath === targetPath) {
    return node;
  }

  if (node.children === undefined) {
    return undefined;
  }

  for (const child of node.children) {
    if (child.type !== 'directory') {
      continue;
    }

    const childPath = toPosixPath(child.relativePath);
    if (targetPath === childPath || targetPath.startsWith(`${childPath}/`)) {
      const match = findDirectoryNode(child, relativePath);
      if (match !== undefined) {
        return match;
      }
    }
  }

  return undefined;
}

function folderKnowledgeFromNode(node: RepositoryNode, depth: number): FolderKnowledge {
  return {
    path: node.path,
    relativePath: toPosixPath(node.relativePath),
    name: node.name,
    depth,
    classification: 'unknown',
    responsibility: '',
    importantFiles: collectImportantFiles(node.children),
    childFolders: collectChildFolders(node.children),
    signals: [`folder-name:${node.name}`, 'source:repository-tree'],
    confidence: 'medium',
  };
}

function indexFoldersByPath(folders: FolderKnowledge[]): Map<string, FolderKnowledge> {
  return new Map(folders.map((folder) => [toPosixPath(folder.relativePath), folder]));
}

function resolveDocsDirChildFolders(
  knowledge: ProjectKnowledge,
  docsDir: string,
  folderIndex: Map<string, FolderKnowledge>,
): string[] {
  const existingFolder = folderIndex.get(docsDir);
  if (existingFolder !== undefined) {
    return [...existingFolder.childFolders];
  }

  const treeNode = findDirectoryNode(knowledge.repository.repositoryTree, docsDir);
  if (treeNode !== undefined) {
    return collectChildFolders(treeNode.children);
  }

  return [];
}

function createDocsDirFolderKnowledge(
  knowledge: ProjectKnowledge,
  folderIndex: Map<string, FolderKnowledge>,
): FolderKnowledge | undefined {
  const docsDir = toPosixPath(knowledge.metadata.docsDir);
  if (!isDocumentationModulePath(docsDir, docsDir)) {
    return undefined;
  }

  let docsDirPath: string;
  try {
    docsDirPath = resolvePathWithinRoot(knowledge.repository.rootPath, docsDir);
  } catch {
    return undefined;
  }

  const childFolders = resolveDocsDirChildFolders(knowledge, docsDir, folderIndex);
  const signals = ['folder-name:docs-output', 'source:metadata.docsDir'];
  if (childFolders.length === 0) {
    signals.push('related-folders:unverified');
  }

  return {
    path: docsDirPath,
    relativePath: docsDir,
    name: docsDir.split('/').pop() ?? docsDir,
    depth: docsDir.split('/').filter((segment) => segment.length > 0).length,
    classification: 'documentation',
    responsibility: '',
    importantFiles: [],
    childFolders,
    signals,
    confidence: 'high',
  };
}

function toClassificationInput(
  folder: FolderKnowledge,
  docsDir: string,
): ModuleClassificationInput {
  return {
    relativePath: toPosixPath(folder.relativePath),
    name: folder.name,
    docsDir,
    folderClassification: folder.classification,
    folderConfidence: folder.confidence,
    hasImportantFiles: folder.importantFiles.length > 0,
    hasChildFolders: folder.childFolders.length > 0,
  };
}

function collectTreeModuleFolders(
  node: RepositoryNode,
  docsDir: string,
  depth: number,
  folderIndex: Map<string, FolderKnowledge>,
  collected: Map<string, FolderKnowledge>,
  classificationCache: Map<string, ModuleClassificationResult | undefined>,
): void {
  if (node.type !== 'directory') {
    return;
  }

  const relativePath = toPosixPath(node.relativePath);
  if (
    relativePath.length > 0 &&
    !folderIndex.has(relativePath) &&
    !collected.has(relativePath)
  ) {
    const syntheticFolder = folderKnowledgeFromNode(node, depth);
    const classification = classifyModuleForFolder(syntheticFolder, docsDir, classificationCache);
    if (classification !== undefined) {
      collected.set(relativePath, syntheticFolder);
    }
  }

  if (shouldIgnoreModulePath(relativePath, docsDir) || node.children === undefined) {
    return;
  }

  for (const child of node.children) {
    if (child.type === 'directory') {
      collectTreeModuleFolders(
        child,
        docsDir,
        depth + 1,
        folderIndex,
        collected,
        classificationCache,
      );
    }
  }
}

function classifyModuleForFolder(
  folder: FolderKnowledge,
  docsDir: string,
  cache: Map<string, ModuleClassificationResult | undefined>,
): ModuleClassificationResult | undefined {
  const relativePath = toPosixPath(folder.relativePath);
  const cached = cache.get(relativePath);
  if (cached !== undefined || cache.has(relativePath)) {
    return cached;
  }

  const result = classifyModule(toClassificationInput(folder, docsDir));
  cache.set(relativePath, result);
  return result;
}

function collectModuleFolderCandidates(
  knowledge: ProjectKnowledge,
  classificationCache: Map<string, ModuleClassificationResult | undefined>,
): FolderKnowledge[] {
  const folderContexts = knowledge.analysis.folderContexts ?? [];
  const folderIndex = indexFoldersByPath(folderContexts);
  const collected = new Map<string, FolderKnowledge>();

  for (const folder of folderContexts) {
    collected.set(toPosixPath(folder.relativePath), folder);
  }

  const docsDirCandidate = createDocsDirFolderKnowledge(knowledge, folderIndex);
  if (docsDirCandidate !== undefined && !collected.has(docsDirCandidate.relativePath)) {
    collected.set(docsDirCandidate.relativePath, docsDirCandidate);
  }

  const repositoryTree = knowledge.repository.repositoryTree;
  if (repositoryTree !== undefined && repositoryTree.type === 'directory') {
    if (repositoryTree.children !== undefined) {
      for (const child of repositoryTree.children) {
        if (child.type === 'directory') {
          collectTreeModuleFolders(
            child,
            knowledge.metadata.docsDir,
            1,
            folderIndex,
            collected,
            classificationCache,
          );
        }
      }
    }
  }

  return [...collected.values()];
}

function resolveRelatedFolders(
  folder: FolderKnowledge,
  moduleType: ModuleType,
  modulePaths: Set<string>,
): string[] {
  const childFolders = [...folder.childFolders];

  if (!GROUP_MODULE_TYPES.has(moduleType)) {
    return childFolders;
  }

  const prefix = `${toPosixPath(folder.relativePath)}/`;
  const childModules = [...modulePaths]
    .filter((modulePath) => modulePath.startsWith(prefix))
    .map((modulePath) => modulePath.slice(prefix.length).split('/')[0] ?? '')
    .filter((name) => name.length > 0);

  return [...new Set([...childFolders, ...childModules])].sort();
}

function buildModuleSignals(
  classificationSignals: string[],
  folder: FolderKnowledge,
): string[] {
  const relativePath = toPosixPath(folder.relativePath);
  const signals = [
    ...classificationSignals,
    `module-key:${relativePath}`,
    `folder-name:${folder.name}`,
  ];

  if (folder.classification !== 'unknown') {
    signals.push(`folder-classification:${folder.classification}`);
  }

  for (const signal of folder.signals) {
    if (signal.startsWith('source:') || signal.startsWith('related-folders:')) {
      signals.push(signal);
    }
  }

  return signals;
}

function buildModuleKnowledge(
  folder: FolderKnowledge,
  docsDir: string,
  frameworks: readonly string[],
  modulePaths: Set<string>,
  classification: ModuleClassificationResult,
): ModuleKnowledge {
  const relativePath = toPosixPath(folder.relativePath);

  return {
    name: folder.name,
    path: folder.path,
    relativePath,
    type: classification.type,
    framework: inferFramework(classification.type, frameworks),
    responsibility: inferModuleResponsibility(
      classification.type,
      folder.name,
      relativePath,
      docsDir,
    ),
    importantFiles: [...folder.importantFiles],
    relatedFolders: resolveRelatedFolders(folder, classification.type, modulePaths),
    signals: buildModuleSignals(classification.signals, folder),
    confidence: classification.confidence,
  };
}

function sortModules(modules: ModuleKnowledge[]): ModuleKnowledge[] {
  return [...modules].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function countByConfidence(
  modules: ModuleKnowledge[],
  confidence: ModuleKnowledge['confidence'],
): number {
  return modules.filter((module) => module.confidence === confidence).length;
}

export function analyzeModuleKnowledge(knowledge: ProjectKnowledge): ModuleAnalysisResult {
  const docsDir = knowledge.metadata.docsDir;
  const frameworks = knowledge.technologies.frameworks;
  const classificationCache = new Map<string, ModuleClassificationResult | undefined>();
  const folderCandidates = collectModuleFolderCandidates(knowledge, classificationCache);
  const modulePaths = new Set<string>();

  for (const folder of folderCandidates) {
    const classification = classifyModuleForFolder(folder, docsDir, classificationCache);
    if (classification !== undefined) {
      modulePaths.add(toPosixPath(folder.relativePath));
    }
  }

  const modules: ModuleKnowledge[] = [];
  for (const folder of folderCandidates) {
    const relativePath = toPosixPath(folder.relativePath);
    const classification = classificationCache.get(relativePath);
    if (classification === undefined) {
      continue;
    }

    modules.push(
      buildModuleKnowledge(folder, docsDir, frameworks, modulePaths, classification),
    );
  }

  const sortedModules = sortModules(modules);

  return {
    modules: sortedModules,
    totalModules: sortedModules.length,
    highConfidenceModules: countByConfidence(sortedModules, 'high'),
    mediumConfidenceModules: countByConfidence(sortedModules, 'medium'),
    lowConfidenceModules: countByConfidence(sortedModules, 'low'),
  };
}

export function enrichProjectKnowledgeWithModuleAnalysis(
  knowledge: ProjectKnowledge,
): { knowledge: ProjectKnowledge; result: ModuleAnalysisResult } {
  const result = analyzeModuleKnowledge(knowledge);
  const hasStructuralAnalysis =
    (knowledge.analysis.folderContexts !== undefined &&
      knowledge.analysis.folderContexts.length > 0) ||
    knowledge.repository.repositoryTree !== undefined;
  const shouldPersistModules = result.modules.length > 0;

  return {
    knowledge: {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        status:
          shouldPersistModules || hasStructuralAnalysis
            ? 'partial'
            : knowledge.analysis.status,
        modules: shouldPersistModules
          ? result.modules
          : hasStructuralAnalysis
            ? []
            : undefined,
      },
    },
    result,
  };
}
