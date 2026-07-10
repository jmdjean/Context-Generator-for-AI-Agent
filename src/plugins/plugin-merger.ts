import { AnalysisKnowledgeStatus, ProjectKnowledge } from '../knowledge';
import { PluginContributions } from './plugin-result';

function hasRepositoryTree(knowledge: ProjectKnowledge): boolean {
  return (
    knowledge.repository.repositoryTree !== undefined &&
    knowledge.repository.repositoryTree.type === 'directory'
  );
}

function hasStructuralAnalysis(knowledge: ProjectKnowledge): boolean {
  return (
    (knowledge.analysis.folderContexts !== undefined &&
      knowledge.analysis.folderContexts.length > 0) ||
    knowledge.repository.repositoryTree !== undefined
  );
}

function resolvePartialStatus(
  currentStatus: AnalysisKnowledgeStatus,
  shouldMarkPartial: boolean,
): AnalysisKnowledgeStatus {
  return shouldMarkPartial ? 'partial' : currentStatus;
}

function mergeFolderContributions(
  knowledge: ProjectKnowledge,
  folderContexts: PluginContributions['folderContexts'],
): ProjectKnowledge['analysis'] {
  const analysis = { ...knowledge.analysis };

  if (folderContexts === undefined) {
    return analysis;
  }

  if (hasRepositoryTree(knowledge)) {
    analysis.folderContexts = folderContexts;
    analysis.status = 'partial';
  }

  return analysis;
}

function mergeModuleContributions(
  knowledge: ProjectKnowledge,
  modules: PluginContributions['modules'],
): ProjectKnowledge['analysis'] {
  const analysis = { ...knowledge.analysis };

  if (modules === undefined) {
    return analysis;
  }

  const structural = hasStructuralAnalysis(knowledge);
  const shouldPersistModules = modules.length > 0;

  analysis.status = resolvePartialStatus(
    analysis.status,
    shouldPersistModules || structural,
  );
  analysis.modules = shouldPersistModules ? modules : structural ? [] : undefined;

  return analysis;
}

function mergeDependencyContributions(
  knowledge: ProjectKnowledge,
  dependencyGraph: PluginContributions['dependencyGraph'],
): ProjectKnowledge['analysis'] {
  const analysis = { ...knowledge.analysis };

  if (dependencyGraph === undefined) {
    return analysis;
  }

  const hasModules = (knowledge.analysis.modules?.length ?? 0) > 0;
  const hasGraph =
    dependencyGraph.nodes.length > 0 || dependencyGraph.edges.length > 0;

  analysis.status = resolvePartialStatus(
    analysis.status,
    hasGraph || hasModules || analysis.status === 'partial',
  );
  analysis.dependencyGraph = hasGraph || hasModules ? dependencyGraph : undefined;

  return analysis;
}

function mergeConventionContributions(
  knowledge: ProjectKnowledge,
  conventions: PluginContributions['conventions'],
): ProjectKnowledge['analysis'] {
  const analysis = { ...knowledge.analysis };

  if (conventions === undefined) {
    return analysis;
  }

  const hasConventions = conventions.length > 0;

  analysis.status = resolvePartialStatus(
    analysis.status,
    hasConventions || analysis.status === 'partial',
  );
  analysis.conventions = hasConventions ? conventions : undefined;

  return analysis;
}

function mergeNavigationContributions(
  knowledge: ProjectKnowledge,
  navigationMap: PluginContributions['navigationMap'],
): ProjectKnowledge['analysis'] {
  const analysis = { ...knowledge.analysis };

  if (navigationMap === undefined) {
    return analysis;
  }

  const hasEntries = navigationMap.entries.length > 0;

  analysis.status = resolvePartialStatus(
    analysis.status,
    hasEntries || analysis.status === 'partial',
  );
  analysis.navigationMap = hasEntries ? navigationMap : undefined;

  return analysis;
}

export function mergePluginContributions(
  knowledge: ProjectKnowledge,
  contributions: PluginContributions,
): ProjectKnowledge {
  let analysis = { ...knowledge.analysis };

  if (contributions.folderContexts !== undefined) {
    analysis = mergeFolderContributions({ ...knowledge, analysis }, contributions.folderContexts);
  }

  if (contributions.modules !== undefined) {
    analysis = mergeModuleContributions({ ...knowledge, analysis }, contributions.modules);
  }

  if (contributions.dependencyGraph !== undefined) {
    analysis = mergeDependencyContributions(
      { ...knowledge, analysis },
      contributions.dependencyGraph,
    );
  }

  if (contributions.conventions !== undefined) {
    analysis = mergeConventionContributions({ ...knowledge, analysis }, contributions.conventions);
  }

  if (contributions.navigationMap !== undefined) {
    analysis = mergeNavigationContributions({ ...knowledge, analysis }, contributions.navigationMap);
  }

  if (contributions.aiInsights !== undefined) {
    analysis = {
      ...analysis,
      aiInsights: contributions.aiInsights,
      status: 'partial',
    };
  }

  return {
    ...knowledge,
    analysis,
  };
}
