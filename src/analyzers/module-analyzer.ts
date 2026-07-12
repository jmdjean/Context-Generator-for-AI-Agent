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
import {
  isDocumentationModulePath,
  isModuleManifestFileName,
  isRepositoryRootModulePath,
  listOwnedModuleManifests,
} from './module-constants';

function normalizeModuleRelativePath(relativePath: string): string {
  const posixPath = toPosixPath(relativePath);
  return isRepositoryRootModulePath(posixPath) ? '.' : posixPath;
}

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

function collectChildFileNames(children: RepositoryNode[] | undefined): string[] {
  if (children === undefined) {
    return [];
  }

  return children.filter((child) => child.type === 'file').map((child) => child.name).sort();
}

function resolveOwnedFileNames(folder: FolderKnowledge, treeNode?: RepositoryNode): string[] {
  const fromTree = collectChildFileNames(treeNode?.children);
  if (fromTree.length > 0) {
    return fromTree;
  }

  return folder.importantFiles
    .map((filePath) => {
      const posix = toPosixPath(filePath);
      const segments = posix.split('/');
      return segments[segments.length - 1] ?? posix;
    })
    .filter((name) => name.length > 0)
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
  ownedFileNames: readonly string[] = [],
): ModuleClassificationInput {
  return {
    relativePath: normalizeModuleRelativePath(folder.relativePath),
    name: folder.name,
    docsDir,
    folderClassification: folder.classification,
    folderConfidence: folder.confidence,
    hasImportantFiles: folder.importantFiles.length > 0 || ownedFileNames.length > 0,
    hasChildFolders: folder.childFolders.length > 0,
    ownedFileNames,
  };
}

function collectTreeModuleFolders(
  node: RepositoryNode,
  docsDir: string,
  depth: number,
  folderIndex: Map<string, FolderKnowledge>,
  collected: Map<string, FolderKnowledge>,
  classificationCache: Map<string, ModuleClassificationResult | undefined>,
  treeIndex: Map<string, RepositoryNode>,
): void {
  if (node.type !== 'directory') {
    return;
  }

  const relativePath = toPosixPath(node.relativePath);
  treeIndex.set(relativePath, node);

  if (
    relativePath.length > 0 &&
    !folderIndex.has(relativePath) &&
    !collected.has(relativePath)
  ) {
    const syntheticFolder = folderKnowledgeFromNode(node, depth);
    const classification = classifyModuleForFolder(
      syntheticFolder,
      docsDir,
      classificationCache,
      treeIndex,
    );
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
        treeIndex,
      );
    }
  }
}

function classifyModuleForFolder(
  folder: FolderKnowledge,
  docsDir: string,
  cache: Map<string, ModuleClassificationResult | undefined>,
  treeIndex: Map<string, RepositoryNode>,
): ModuleClassificationResult | undefined {
  const relativePath = normalizeModuleRelativePath(folder.relativePath);
  const cached = cache.get(relativePath);
  if (cached !== undefined || cache.has(relativePath)) {
    return cached;
  }

  const ownedFileNames = resolveOwnedFileNames(
    folder,
    treeIndex.get(relativePath) ?? (relativePath === '.' ? treeIndex.get('') : undefined),
  );
  const result = classifyModule(toClassificationInput(folder, docsDir, ownedFileNames));
  cache.set(relativePath, result);
  return result;
}

function createRootFolderKnowledge(
  knowledge: ProjectKnowledge,
  treeRoot: RepositoryNode,
): FolderKnowledge {
  const importantFiles = collectImportantFiles(treeRoot.children);
  const childFolders = collectChildFolders(treeRoot.children);
  const ownedManifests = listOwnedModuleManifests(collectChildFileNames(treeRoot.children));

  return {
    path: knowledge.repository.rootPath,
    // Use '.' so module ids, document paths, and plan entries stay non-empty.
    relativePath: '.',
    name: knowledge.repository.name,
    depth: 0,
    classification: ownedManifests.length > 0 ? 'source' : 'unknown',
    responsibility: '',
    importantFiles,
    childFolders,
    signals: ['folder-name:repository-root', 'source:repository-tree'],
    confidence: ownedManifests.length > 0 ? 'high' : 'medium',
  };
}

function directoryOwnsManifest(node: RepositoryNode): boolean {
  if (node.children === undefined) {
    return false;
  }

  return node.children.some(
    (child) => child.type === 'file' && isModuleManifestFileName(child.name),
  );
}

function collectModuleFolderCandidates(
  knowledge: ProjectKnowledge,
  classificationCache: Map<string, ModuleClassificationResult | undefined>,
): FolderKnowledge[] {
  const folderContexts = knowledge.analysis.folderContexts ?? [];
  const folderIndex = indexFoldersByPath(folderContexts);
  const collected = new Map<string, FolderKnowledge>();
  const treeIndex = new Map<string, RepositoryNode>();

  for (const folder of folderContexts) {
    const relativePath = normalizeModuleRelativePath(folder.relativePath);
    collected.set(relativePath, {
      ...folder,
      relativePath,
    });
  }

  const docsDirCandidate = createDocsDirFolderKnowledge(knowledge, folderIndex);
  if (docsDirCandidate !== undefined && !collected.has(docsDirCandidate.relativePath)) {
    collected.set(docsDirCandidate.relativePath, docsDirCandidate);
  }

  const repositoryTree = knowledge.repository.repositoryTree;
  if (repositoryTree !== undefined && repositoryTree.type === 'directory') {
    treeIndex.set('', repositoryTree);
    treeIndex.set('.', repositoryTree);

    if (directoryOwnsManifest(repositoryTree) && !collected.has('.')) {
      collected.set('.', createRootFolderKnowledge(knowledge, repositoryTree));
    }

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
            treeIndex,
          );
        }
      }
    }
  }

  // Ensure classification cache is populated with tree-aware owned files for all candidates.
  for (const folder of collected.values()) {
    classifyModuleForFolder(folder, knowledge.metadata.docsDir, classificationCache, treeIndex);
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
  const relativePath = normalizeModuleRelativePath(folder.relativePath);
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
  const relativePath = normalizeModuleRelativePath(folder.relativePath);

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
    const relativePath = normalizeModuleRelativePath(folder.relativePath);
    const classification = classificationCache.get(relativePath);
    if (classification !== undefined) {
      modulePaths.add(relativePath);
    }
  }

  const modules: ModuleKnowledge[] = [];
  for (const folder of folderCandidates) {
    const relativePath = normalizeModuleRelativePath(folder.relativePath);
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
