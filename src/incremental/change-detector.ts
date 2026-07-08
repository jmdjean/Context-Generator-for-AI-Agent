import { RepositoryNode } from '../domain';
import { DocumentationPlan } from '../domain/documentation-plan';
import {
  AiInsightsKnowledge,
  ChangeSection,
  ChangeSummaryKnowledge,
  ConventionKnowledge,
  DependencyEdge,
  DependencyGraphKnowledge,
  FolderKnowledge,
  ModuleKnowledge,
  NavigationEntry,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { DependencyEdgeChange } from './change-summary';
import { PreviousKnowledgeBaseline, repositoryRootsMatch } from './state-loader';

function stableSerialize(value: unknown): string {
  return JSON.stringify(value);
}

function sortedCopy(values: string[]): string[] {
  return [...values].sort();
}

function diffPathSets(
  previousPaths: string[],
  currentPaths: string[],
): { added: string[]; removed: string[] } {
  const previousSet = new Set(previousPaths);
  const currentSet = new Set(currentPaths);

  return {
    added: currentPaths.filter((item) => !previousSet.has(item)),
    removed: previousPaths.filter((item) => !currentSet.has(item)),
  };
}

function collectTreeRelativePaths(node: RepositoryNode | undefined): string[] {
  if (node === undefined) {
    return [];
  }

  const paths: string[] = [];

  function walk(current: RepositoryNode): void {
    if (current.relativePath.length > 0) {
      paths.push(current.relativePath);
    }

    for (const child of current.children ?? []) {
      walk(child);
    }
  }

  walk(node);
  return sortedCopy(paths);
}

function collectTechnologyTokens(knowledge: ProjectKnowledge): string[] {
  const { technologies } = knowledge;
  const tokens = [
    ...technologies.languages,
    ...technologies.frameworks,
    ...technologies.packageManagers,
    ...technologies.tooling,
  ];

  return sortedCopy([...new Set(tokens)]);
}

function diffTechnologyTokens(previous: string[], current: string[]): string[] {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  const changed: string[] = [];

  for (const token of current) {
    if (!previousSet.has(token)) {
      changed.push(token);
    }
  }

  for (const token of previous) {
    if (!currentSet.has(token)) {
      changed.push(token);
    }
  }

  return sortedCopy(changed);
}

function edgeKey(edge: Pick<DependencyEdge, 'from' | 'to' | 'type'>): string {
  return `${edge.from}->${edge.to}:${edge.type}`;
}

function normalizeDependencyEdge(edge: DependencyEdge): {
  from: string;
  to: string;
  type: DependencyEdge['type'];
  confidence: DependencyEdge['confidence'];
  evidence: string[];
} {
  return {
    from: edge.from,
    to: edge.to,
    type: edge.type,
    confidence: edge.confidence,
    evidence: edge.evidence
      .map((item) => `${item.sourceFile}:${item.importPath}`)
      .sort(),
  };
}

function normalizeDependencyEdges(edges: DependencyEdge[] | undefined): string {
  const normalized = (edges ?? [])
    .map((edge) => normalizeDependencyEdge(edge))
    .sort((left, right) => stableSerialize(left).localeCompare(stableSerialize(right)));

  return stableSerialize(normalized);
}

function diffDependencyEdges(
  previousEdges: DependencyEdge[] | undefined,
  currentEdges: DependencyEdge[] | undefined,
): DependencyEdgeChange[] {
  const previousKeys = new Set((previousEdges ?? []).map((edge) => edgeKey(edge)));
  const currentKeys = new Set((currentEdges ?? []).map((edge) => edgeKey(edge)));
  const changes: DependencyEdgeChange[] = [];

  for (const edge of currentEdges ?? []) {
    if (!previousKeys.has(edgeKey(edge))) {
      changes.push({
        from: edge.from,
        to: edge.to,
        type: edge.type,
        change: 'added',
      });
    }
  }

  for (const edge of previousEdges ?? []) {
    if (!currentKeys.has(edgeKey(edge))) {
      changes.push({
        from: edge.from,
        to: edge.to,
        type: edge.type,
        change: 'removed',
      });
    }
  }

  return changes.sort((left, right) => {
    const leftKey = `${left.change}:${edgeKey(left)}`;
    const rightKey = `${right.change}:${edgeKey(right)}`;
    return leftKey.localeCompare(rightKey);
  });
}

function normalizeConventions(conventions: ConventionKnowledge[] | undefined): string {
  const normalized = (conventions ?? [])
    .map((convention) => ({
      category: convention.category,
      name: convention.name,
      description: convention.description,
      confidence: convention.confidence,
      evidence: convention.evidence
        .map((item) => `${item.type}:${item.source}:${item.detail}`)
        .sort(),
    }))
    .sort((left, right) => `${left.category}:${left.name}`.localeCompare(`${right.category}:${right.name}`));

  return stableSerialize(normalized);
}

function normalizeNavigationEntries(entries: NavigationEntry[] | undefined): string {
  const normalized = (entries ?? [])
    .map((entry) => ({
      taskType: entry.taskType,
      description: entry.description,
      recommendedKnowledge: sortedCopy(entry.recommendedKnowledge),
      recommendedDocuments: sortedCopy(entry.recommendedDocuments),
      relatedModules: sortedCopy(entry.relatedModules),
      relatedFolders: sortedCopy(entry.relatedFolders),
      warnings: sortedCopy(entry.warnings),
      confidence: entry.confidence,
    }))
    .sort((left, right) => left.taskType.localeCompare(right.taskType));

  return stableSerialize(normalized);
}

function normalizeModules(modules: ModuleKnowledge[] | undefined): string {
  const normalized = (modules ?? [])
    .map((module) => ({
      relativePath: module.relativePath,
      type: module.type,
      responsibility: module.responsibility,
      confidence: module.confidence,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return stableSerialize(normalized);
}

function normalizeFolders(folders: FolderKnowledge[] | undefined): string {
  const normalized = (folders ?? [])
    .map((folder) => ({
      relativePath: folder.relativePath,
      classification: folder.classification,
      responsibility: folder.responsibility,
      confidence: folder.confidence,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return stableSerialize(normalized);
}

function normalizeAiInsights(insights: AiInsightsKnowledge | undefined): string {
  if (insights === undefined) {
    return stableSerialize(null);
  }

  return stableSerialize({
    architectureSummary: insights.architectureSummary,
    risks: sortedCopy(insights.risks ?? []),
    recommendations: sortedCopy(insights.recommendations ?? []),
    agentGuidance: sortedCopy(insights.agentGuidance ?? []),
    model: insights.model,
  });
}

function normalizeDependencyGraph(graph: DependencyGraphKnowledge | undefined): string {
  if (graph === undefined) {
    return stableSerialize({ nodes: [], edges: [] });
  }

  const nodes = graph.nodes
    .map((node) => ({
      id: node.id,
      type: node.type,
      relativePath: node.relativePath,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return stableSerialize({
    nodes,
    edges: normalizeDependencyEdges(graph.edges),
  });
}

function normalizeDocumentationPlan(plan: DocumentationPlan): string {
  const documents = [...plan.documents]
    .map((document) => ({
      relativePath: document.relativePath,
      source: document.source,
      priority: document.priority,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return stableSerialize({
    strategy: plan.strategy,
    documents,
  });
}

function createEmptyComparisonFields(): Pick<
  ChangeSummaryKnowledge,
  | 'changedSections'
  | 'addedModules'
  | 'removedModules'
  | 'changedTechnologies'
  | 'technologyConfidenceChanged'
  | 'addedFolders'
  | 'removedFolders'
  | 'dependencyEdgeChanges'
> {
  return {
    changedSections: [],
    addedModules: [],
    removedModules: [],
    changedTechnologies: [],
    technologyConfidenceChanged: false,
    addedFolders: [],
    removedFolders: [],
    dependencyEdgeChanges: [],
  };
}

function createBaselineSummary(
  baseline: PreviousKnowledgeBaseline,
  generatedAt: string,
): ChangeSummaryKnowledge {
  const empty = createEmptyComparisonFields();

  if (baseline.status === 'none') {
    return {
      isInitialRun: true,
      baselineStatus: 'none',
      warnings: [],
      generatedAt,
      ...empty,
    };
  }

  if (baseline.status === 'repository-mismatch') {
    return {
      isInitialRun: true,
      baselineStatus: 'repository-mismatch',
      warnings: [
        'Previous PKM snapshot belongs to a different repository root and was ignored.',
      ],
      generatedAt,
      ...empty,
    };
  }

  return {
    isInitialRun: false,
    baselineStatus: 'unreadable',
    warnings: [
      'Previous PKM snapshot exists but could not be loaded; change comparison was skipped.',
    ],
    generatedAt,
    ...empty,
  };
}

export function detectChanges(
  baseline: PreviousKnowledgeBaseline,
  current: ProjectKnowledge,
): ChangeSummaryKnowledge {
  const generatedAt = new Date().toISOString();

  if (baseline.status !== 'loaded' || baseline.knowledge === undefined) {
    return createBaselineSummary(baseline, generatedAt);
  }

  if (!repositoryRootsMatch(baseline.knowledge.repository.rootPath, current.repository.rootPath)) {
    return createBaselineSummary({ status: 'repository-mismatch' }, generatedAt);
  }

  const previous = baseline.knowledge;
  const changedSections: ChangeSection[] = [];

  const previousDetectedFiles = sortedCopy(previous.repository.detectedFiles);
  const currentDetectedFiles = sortedCopy(current.repository.detectedFiles);

  if (stableSerialize(previousDetectedFiles) !== stableSerialize(currentDetectedFiles)) {
    changedSections.push('detectedFiles');
  }

  const previousTreePaths = collectTreeRelativePaths(previous.repository.repositoryTree);
  const currentTreePaths = collectTreeRelativePaths(current.repository.repositoryTree);

  if (stableSerialize(previousTreePaths) !== stableSerialize(currentTreePaths)) {
    changedSections.push('repositoryTree');
  }

  const previousTechnologies = collectTechnologyTokens(previous);
  const currentTechnologies = collectTechnologyTokens(current);
  const changedTechnologies = diffTechnologyTokens(previousTechnologies, currentTechnologies);
  const technologyConfidenceChanged =
    previous.technologies.confidence !== current.technologies.confidence;

  if (changedTechnologies.length > 0 || technologyConfidenceChanged) {
    changedSections.push('technologies');
  }

  const previousFolderPaths = sortedCopy(
    previous.analysis.folderContexts?.map((folder) => folder.relativePath) ?? [],
  );
  const currentFolderPaths = sortedCopy(
    current.analysis.folderContexts?.map((folder) => folder.relativePath) ?? [],
  );
  const folderDiff = diffPathSets(previousFolderPaths, currentFolderPaths);

  if (
    folderDiff.added.length > 0 ||
    folderDiff.removed.length > 0 ||
    normalizeFolders(previous.analysis.folderContexts) !== normalizeFolders(current.analysis.folderContexts)
  ) {
    changedSections.push('folderContexts');
  }

  const previousModulePaths = sortedCopy(
    previous.analysis.modules?.map((module) => module.relativePath) ?? [],
  );
  const currentModulePaths = sortedCopy(
    current.analysis.modules?.map((module) => module.relativePath) ?? [],
  );
  const moduleDiff = diffPathSets(previousModulePaths, currentModulePaths);

  if (
    moduleDiff.added.length > 0 ||
    moduleDiff.removed.length > 0 ||
    normalizeModules(previous.analysis.modules) !== normalizeModules(current.analysis.modules)
  ) {
    changedSections.push('modules');
  }

  const dependencyEdgeChanges = diffDependencyEdges(
    previous.analysis.dependencyGraph?.edges,
    current.analysis.dependencyGraph?.edges,
  );

  if (
    dependencyEdgeChanges.length > 0 ||
    normalizeDependencyGraph(previous.analysis.dependencyGraph) !==
      normalizeDependencyGraph(current.analysis.dependencyGraph)
  ) {
    changedSections.push('dependencyGraph');
  }

  if (
    normalizeConventions(previous.analysis.conventions) !==
    normalizeConventions(current.analysis.conventions)
  ) {
    changedSections.push('conventions');
  }

  if (
    normalizeNavigationEntries(previous.analysis.navigationMap?.entries) !==
    normalizeNavigationEntries(current.analysis.navigationMap?.entries)
  ) {
    changedSections.push('navigationMap');
  }

  if (
    normalizeAiInsights(previous.analysis.aiInsights) !== normalizeAiInsights(current.analysis.aiInsights)
  ) {
    changedSections.push('aiInsights');
  }

  if (
    previous.metadata.generatorVersion !== current.metadata.generatorVersion ||
    normalizeDocumentationPlan(previous.documentation.plan) !==
      normalizeDocumentationPlan(current.documentation.plan)
  ) {
    changedSections.push('documentation');
  }

  return {
    isInitialRun: false,
    baselineStatus: 'loaded',
    warnings: [],
    changedSections,
    addedModules: moduleDiff.added,
    removedModules: moduleDiff.removed,
    changedTechnologies,
    technologyConfidenceChanged,
    addedFolders: folderDiff.added,
    removedFolders: folderDiff.removed,
    dependencyEdgeChanges,
    generatedAt,
  };
}
