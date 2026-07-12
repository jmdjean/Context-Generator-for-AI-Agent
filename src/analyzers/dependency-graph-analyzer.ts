import * as path from 'node:path';
import {
  DependencyEdge,
  DependencyEdgeConfidence,
  DependencyGraphKnowledge,
  DependencyNode,
  ModuleKnowledge,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { createRepositoryBoundary, RepositoryBoundary } from '../scanner/repository-boundary';
import { toPosixPath } from './folder-constants';
import { ParsedImport, parseImportsFromRepository } from './import-parser';
import { modulePathContainsRelativePath } from './module-constants';

export interface DependencyGraphAnalysisResult {
  dependencyGraph: DependencyGraphKnowledge;
  totalNodes: number;
  totalEdges: number;
  importsAnalyzed: number;
  filesRead: number;
  filesSkipped: number;
}

const SOURCE_EXTENSIONS = /\.(tsx?|jsx?|mjs|cjs)$/i;
const MAX_EVIDENCE_PER_EDGE = 15;

interface ModuleIndex {
  byPath: Map<string, ModuleKnowledge>;
  sortedByPathLength: ModuleKnowledge[];
}

function buildModuleIndex(modules: ModuleKnowledge[]): ModuleIndex {
  const byPath = new Map<string, ModuleKnowledge>();
  for (const module of modules) {
    byPath.set(toPosixPath(module.relativePath), module);
  }

  const sortedByPathLength = [...modules].sort(
    (left, right) => right.relativePath.length - left.relativePath.length,
  );

  return { byPath, sortedByPathLength };
}

function buildDependencyNodes(modules: ModuleKnowledge[]): DependencyNode[] {
  return modules
    .map((module) => ({
      id: toPosixPath(module.relativePath),
      name: module.name,
      type: module.type,
      relativePath: toPosixPath(module.relativePath),
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function filterGraphNodes(nodes: DependencyNode[], edges: DependencyEdge[]): DependencyNode[] {
  const connectedIds = new Set<string>();
  for (const edge of edges) {
    connectedIds.add(edge.from);
    connectedIds.add(edge.to);
  }

  return nodes.filter(
    (node) => node.type !== 'documentation' || connectedIds.has(node.id),
  );
}

function stripModuleSuffix(importPath: string): string {
  return importPath.replace(SOURCE_EXTENSIONS, '').replace(/\/index$/, '');
}

export function resolveRelativeImportPath(
  sourceFile: string,
  importSpecifier: string,
): string | undefined {
  if (!importSpecifier.startsWith('.')) {
    return undefined;
  }

  const sourceDir = path.posix.dirname(toPosixPath(sourceFile));
  const resolved = path.posix.normalize(path.posix.join(sourceDir, importSpecifier));

  if (resolved.startsWith('..')) {
    return undefined;
  }

  return stripModuleSuffix(resolved.replace(/^\.\//, ''));
}

function findModuleForFile(
  filePath: string,
  moduleIndex: ModuleIndex,
): ModuleKnowledge | undefined {
  const normalized = toPosixPath(filePath);
  return moduleIndex.sortedByPathLength.find((module) =>
    modulePathContainsRelativePath(module.relativePath, normalized),
  );
}

interface ModuleMatch {
  module: ModuleKnowledge;
  confidence: DependencyEdgeConfidence;
}

function findModuleForResolvedPath(
  resolvedPath: string,
  moduleIndex: ModuleIndex,
): ModuleMatch | undefined {
  const normalized = stripModuleSuffix(toPosixPath(resolvedPath));

  const exactMatch = moduleIndex.byPath.get(normalized);
  if (exactMatch !== undefined) {
    return { module: exactMatch, confidence: 'high' };
  }

  const containingModule = moduleIndex.sortedByPathLength.find((module) =>
    modulePathContainsRelativePath(module.relativePath, normalized),
  );
  if (containingModule !== undefined) {
    return { module: containingModule, confidence: 'high' };
  }

  return undefined;
}

function edgeKey(from: string, to: string, type: DependencyEdge['type']): string {
  return `${from}|${to}|${type}`;
}

function mergeEdgeEvidence(
  existing: DependencyEdge,
  parsedImport: ParsedImport,
): DependencyEdge {
  const hasEvidence = existing.evidence.some(
    (evidence) =>
      evidence.sourceFile === parsedImport.sourceFile &&
      evidence.importPath === parsedImport.importPath,
  );

  if (hasEvidence || existing.evidence.length >= MAX_EVIDENCE_PER_EDGE) {
    return existing;
  }

  return {
    ...existing,
    evidence: [
      ...existing.evidence,
      {
        sourceFile: parsedImport.sourceFile,
        importPath: parsedImport.importPath,
      },
    ],
  };
}

function resolveTargetModule(
  parsedImport: ParsedImport,
  moduleIndex: ModuleIndex,
): ModuleMatch | undefined {
  const resolvedPath = resolveRelativeImportPath(
    parsedImport.sourceFile,
    parsedImport.importPath,
  );

  if (resolvedPath === undefined) {
    return undefined;
  }

  return findModuleForResolvedPath(resolvedPath, moduleIndex);
}

function buildImportEdges(
  parsedImports: ParsedImport[],
  moduleIndex: ModuleIndex,
): DependencyEdge[] {
  const edges = new Map<string, DependencyEdge>();

  for (const parsedImport of parsedImports) {
    if (!parsedImport.importPath.startsWith('.')) {
      continue;
    }

    const sourceModule = findModuleForFile(parsedImport.sourceFile, moduleIndex);
    if (sourceModule === undefined) {
      continue;
    }

    const targetMatch = resolveTargetModule(parsedImport, moduleIndex);
    if (targetMatch === undefined) {
      continue;
    }

    if (sourceModule.relativePath === targetMatch.module.relativePath) {
      continue;
    }

    const from = toPosixPath(sourceModule.relativePath);
    const to = toPosixPath(targetMatch.module.relativePath);
    const key = edgeKey(from, to, 'imports');
    const existing = edges.get(key);

    if (existing === undefined) {
      edges.set(key, {
        from,
        to,
        type: 'imports',
        confidence: targetMatch.confidence,
        evidence: [
          {
            sourceFile: parsedImport.sourceFile,
            importPath: parsedImport.importPath,
          },
        ],
      });
      continue;
    }

    edges.set(key, mergeEdgeEvidence(existing, parsedImport));
  }

  return [...edges.values()].sort((left, right) => {
    const fromCompare = left.from.localeCompare(right.from);
    if (fromCompare !== 0) {
      return fromCompare;
    }
    return left.to.localeCompare(right.to);
  });
}

function countRelativeImports(parsedImports: readonly ParsedImport[]): number {
  return parsedImports.filter((parsedImport) => parsedImport.importPath.startsWith('.')).length;
}

export interface DependencyGraphAnalysisOptions {
  boundary?: RepositoryBoundary;
}

export function analyzeDependencyGraph(
  knowledge: ProjectKnowledge,
  options?: DependencyGraphAnalysisOptions,
): DependencyGraphAnalysisResult {
  const modules = knowledge.analysis.modules ?? [];
  const moduleIndex = buildModuleIndex(modules);
  const boundary =
    options?.boundary ?? createRepositoryBoundary(knowledge.repository.rootPath);
  const modulePaths = modules.map((module) => toPosixPath(module.relativePath));
  const parseResult = parseImportsFromRepository(knowledge.repository.repositoryTree, {
    docsDir: knowledge.metadata.docsDir,
    modulePaths,
    boundary,
  });
  const edges = buildImportEdges(parseResult.imports, moduleIndex);
  const allNodes = buildDependencyNodes(modules);
  const nodes = filterGraphNodes(allNodes, edges);

  return {
    dependencyGraph: {
      nodes,
      edges,
      generatedAt: knowledge.metadata.generatedAt,
    },
    totalNodes: nodes.length,
    totalEdges: edges.length,
    importsAnalyzed: countRelativeImports(parseResult.imports),
    filesRead: parseResult.filesRead,
    filesSkipped: parseResult.filesSkipped,
  };
}

export function enrichProjectKnowledgeWithDependencyGraph(
  knowledge: ProjectKnowledge,
  options?: DependencyGraphAnalysisOptions,
): { knowledge: ProjectKnowledge; result: DependencyGraphAnalysisResult } {
  const result = analyzeDependencyGraph(knowledge, options);
  const hasModules = (knowledge.analysis.modules?.length ?? 0) > 0;
  const hasGraph =
    result.dependencyGraph.nodes.length > 0 || result.dependencyGraph.edges.length > 0;

  return {
    knowledge: {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        status:
          hasGraph || hasModules || knowledge.analysis.status === 'partial'
            ? 'partial'
            : knowledge.analysis.status,
        dependencyGraph: hasGraph || hasModules ? result.dependencyGraph : undefined,
      },
    },
    result,
  };
}
