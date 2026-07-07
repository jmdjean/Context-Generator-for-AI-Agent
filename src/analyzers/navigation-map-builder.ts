import {
  FolderClassification,
  FolderKnowledge,
  ModuleKnowledge,
  ModuleType,
  NavigationEntry,
  NavigationEntryConfidence,
  NavigationKnowledgeSection,
  NavigationTaskType,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { toPosixPath } from './folder-constants';

export interface NavigationRule {
  taskType: NavigationTaskType;
  description: string;
  recommendedKnowledge: NavigationKnowledgeSection[];
  recommendedDocuments: string[];
  warnings: string[];
  relatedModulePaths: string[];
  relatedModuleTypes: ModuleType[];
  relatedFolderPaths: string[];
  relatedFolderClassifications: FolderClassification[];
}

export const NAVIGATION_RULES: readonly NavigationRule[] = [
  {
    taskType: 'architecture-change',
    description:
      'Changing module boundaries, pipeline structure, or how stages and generators interact.',
    recommendedKnowledge: ['modules', 'folderContexts', 'dependencyGraph', 'conventions'],
    recommendedDocuments: [
      'architecture.md',
      'folder-structure.md',
      'dependency-map.md',
      'conventions.md',
      'ai-context.md',
    ],
    warnings: [
      'Review dependency graph before changing module boundaries.',
      'Preserve domain purity.',
      'Keep generators consuming PKM instead of scanning directly.',
    ],
    relatedModulePaths: ['src/core', 'src/domain', 'src/knowledge', 'src/analyzers', 'src/docs'],
    relatedModuleTypes: [],
    relatedFolderPaths: ['src/core', 'src/domain', 'src/knowledge', 'src/analyzers', 'src/docs'],
    relatedFolderClassifications: [],
  },
  {
    taskType: 'new-feature',
    description:
      'Adding new behavior: a pipeline step, analyzer, generator, detector, or CLI capability.',
    recommendedKnowledge: [
      'modules',
      'folderContexts',
      'conventions',
      'dependencyGraph',
      'navigationMap',
    ],
    recommendedDocuments: [
      'architecture.md',
      'folder-structure.md',
      'implementation-guide.md',
      'conventions.md',
      'agent-navigation.md',
    ],
    warnings: [
      'Add new behavior through the correct module boundary.',
      'Update PKM-related docs if architecture changes.',
      'Do not bypass the pipeline orchestration layer.',
    ],
    relatedModulePaths: ['src/core', 'src/domain', 'src/analyzers', 'src/knowledge', 'src/docs'],
    relatedModuleTypes: ['feature', 'application'],
    relatedFolderPaths: ['src'],
    relatedFolderClassifications: [],
  },
  {
    taskType: 'bug-fix',
    description:
      'Correcting incorrect behavior in existing code without changing architecture or contracts.',
    recommendedKnowledge: ['modules', 'dependencyGraph', 'conventions'],
    recommendedDocuments: ['implementation-guide.md', 'dependency-map.md', 'conventions.md'],
    warnings: [
      'Fix the root cause instead of patching generated output.',
      'Avoid changing unrelated modules.',
    ],
    relatedModulePaths: [],
    relatedModuleTypes: ['core', 'application', 'feature', 'library', 'service-group'],
    relatedFolderPaths: [],
    relatedFolderClassifications: [],
  },
  {
    taskType: 'test-change',
    description: 'Adding, updating, or reorganizing tests for existing or new behavior.',
    recommendedKnowledge: ['conventions', 'modules', 'folderContexts'],
    recommendedDocuments: ['conventions.md', 'implementation-guide.md'],
    warnings: [
      'Preserve existing testing conventions.',
      'Do not weaken assertions or remove tests.',
    ],
    relatedModulePaths: [],
    relatedModuleTypes: [],
    relatedFolderPaths: [],
    relatedFolderClassifications: ['test'],
  },
  {
    taskType: 'documentation-change',
    description: 'Updating Markdown documentation, READMEs, or the generated context layer.',
    recommendedKnowledge: ['documentation', 'conventions', 'navigationMap'],
    recommendedDocuments: ['README.md', 'agent-navigation.md', 'ai-context.md', 'conventions.md'],
    warnings: [
      'Markdown should reflect PKM.',
      'Do not manually edit generated files unless intentionally supported.',
    ],
    relatedModulePaths: ['src/docs', 'src/knowledge'],
    relatedModuleTypes: ['documentation'],
    relatedFolderPaths: [],
    relatedFolderClassifications: ['documentation'],
  },
  {
    taskType: 'config-change',
    description:
      'Changing runtime configuration, compiler options, or tooling configuration files.',
    recommendedKnowledge: ['technologies', 'conventions', 'modules'],
    recommendedDocuments: ['architecture.md', 'conventions.md', 'implementation-guide.md'],
    warnings: [
      'Check package manager and TypeScript strict mode conventions.',
      'Avoid introducing conflicting tooling.',
    ],
    relatedModulePaths: ['src/config', 'src/detectors'],
    relatedModuleTypes: ['configuration', 'tooling'],
    relatedFolderPaths: [],
    relatedFolderClassifications: ['config', 'tooling'],
  },
  {
    taskType: 'dependency-change',
    description: 'Adding, removing, or upgrading package dependencies.',
    recommendedKnowledge: ['technologies', 'dependencyGraph', 'conventions'],
    recommendedDocuments: ['dependency-map.md', 'conventions.md', 'implementation-guide.md'],
    warnings: [
      'Check impacted modules before changing dependencies.',
      'Keep dependency changes minimal.',
    ],
    relatedModulePaths: ['src/detectors'],
    relatedModuleTypes: [],
    relatedFolderPaths: [],
    relatedFolderClassifications: ['config'],
  },
  {
    taskType: 'ai-agent-integration',
    description:
      'Building or adjusting agent-facing outputs: agent docs, exporters, rules, or skills.',
    recommendedKnowledge: ['documentation', 'conventions', 'navigationMap', 'modules'],
    recommendedDocuments: [
      'AGENTS.md',
      'ai-context.md',
      'agent-navigation.md',
      'implementation-guide.md',
    ],
    warnings: [
      'Agent-specific outputs must be derived from PKM.',
      'Do not duplicate repository analysis inside exporters.',
    ],
    relatedModulePaths: ['src/docs', 'src/knowledge', 'src/analyzers'],
    relatedModuleTypes: ['documentation'],
    relatedFolderPaths: [],
    relatedFolderClassifications: ['documentation'],
  },
];

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function resolveRelatedModules(
  rule: NavigationRule,
  modules: readonly ModuleKnowledge[],
): string[] {
  const pathCandidates = new Set(rule.relatedModulePaths.map(toPosixPath));
  const typeCandidates = new Set(rule.relatedModuleTypes);

  return uniqueSorted(
    modules
      .filter((module) => {
        const relativePath = toPosixPath(module.relativePath);
        return pathCandidates.has(relativePath) || typeCandidates.has(module.type);
      })
      .map((module) => toPosixPath(module.relativePath)),
  );
}

export function resolveRelatedFolders(
  rule: NavigationRule,
  folders: readonly FolderKnowledge[],
): string[] {
  const pathCandidates = new Set(rule.relatedFolderPaths.map(toPosixPath));
  const classificationCandidates = new Set(rule.relatedFolderClassifications);

  return uniqueSorted(
    folders
      .filter((folder) => {
        const relativePath = toPosixPath(folder.relativePath);
        if (relativePath.length === 0) {
          return false;
        }
        return (
          pathCandidates.has(relativePath) ||
          classificationCandidates.has(folder.classification)
        );
      })
      .map((folder) => toPosixPath(folder.relativePath)),
  );
}

export function isKnowledgeSectionAvailable(
  section: NavigationKnowledgeSection,
  knowledge: ProjectKnowledge,
): boolean {
  switch (section) {
    case 'repository':
      return true;
    case 'technologies':
      return (
        knowledge.technologies.languages.length > 0 ||
        knowledge.technologies.packageManagers.length > 0 ||
        knowledge.technologies.frameworks.length > 0 ||
        knowledge.technologies.tooling.length > 0
      );
    case 'documentation':
      return knowledge.documentation.plan.documents.length > 0;
    case 'folderContexts':
      return (knowledge.analysis.folderContexts?.length ?? 0) > 0;
    case 'modules':
      return (knowledge.analysis.modules?.length ?? 0) > 0;
    case 'dependencyGraph':
      return knowledge.analysis.dependencyGraph !== undefined;
    case 'conventions':
      return (knowledge.analysis.conventions?.length ?? 0) > 0;
    case 'navigationMap':
      // Self-referential: the map being built guarantees this section exists.
      return true;
  }
}

export function resolveEntryConfidence(
  rule: NavigationRule,
  knowledge: ProjectKnowledge,
): NavigationEntryConfidence {
  const plannedDocuments = new Set(
    knowledge.documentation.plan.documents.map((document) => toPosixPath(document.relativePath)),
  );

  const missingKnowledge = rule.recommendedKnowledge.filter(
    (section) => !isKnowledgeSectionAvailable(section, knowledge),
  ).length;
  const missingDocuments = rule.recommendedDocuments.filter(
    (document) => !plannedDocuments.has(document),
  ).length;

  const missing = missingKnowledge + missingDocuments;
  if (missing === 0) {
    return 'high';
  }
  return missing <= 2 ? 'medium' : 'low';
}

export function buildNavigationEntry(
  rule: NavigationRule,
  knowledge: ProjectKnowledge,
): NavigationEntry {
  const modules = knowledge.analysis.modules ?? [];
  const folderContexts = knowledge.analysis.folderContexts ?? [];

  return {
    taskType: rule.taskType,
    description: rule.description,
    recommendedKnowledge: [...rule.recommendedKnowledge],
    recommendedDocuments: [...rule.recommendedDocuments],
    relatedModules: resolveRelatedModules(rule, modules),
    relatedFolders: resolveRelatedFolders(rule, folderContexts),
    warnings: [...rule.warnings],
    confidence: resolveEntryConfidence(rule, knowledge),
  };
}
