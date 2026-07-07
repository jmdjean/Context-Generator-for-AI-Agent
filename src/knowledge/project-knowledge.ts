import { RepositoryNode, TechnologyConfidence } from '../domain';
import { DocumentationPlan } from '../domain/documentation-plan';
export type AnalysisKnowledgeStatus = 'pending' | 'partial' | 'complete';

export interface KnowledgeMetadata {
  schemaVersion: string;
  generatedAt: string;
  generatorVersion: string;
  projectName: string;
  docsDir: string;
}

export interface RepositoryKnowledge {
  name: string;
  rootPath: string;
  packageManager?: string;
  detectedFiles: string[];
  ignoredPaths: string[];
  repositoryTree?: RepositoryNode;
}

export interface TechnologyKnowledge {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  tooling: string[];
  confidence: TechnologyConfidence;
}

export interface DocumentationKnowledge {
  plan: DocumentationPlan;
}

export type FolderClassification =
  | 'source'
  | 'test'
  | 'config'
  | 'documentation'
  | 'build-output'
  | 'dependency-cache'
  | 'asset'
  | 'scripts'
  | 'tooling'
  | 'unknown';

export type FolderKnowledgeConfidence = 'high' | 'medium' | 'low';

export interface FolderKnowledge {
  path: string;
  relativePath: string;
  name: string;
  depth: number;
  classification: FolderClassification;
  responsibility: string;
  importantFiles: string[];
  childFolders: string[];
  signals: string[];
  confidence: FolderKnowledgeConfidence;
}

export type ModuleType =
  | 'application'
  | 'library'
  | 'package'
  | 'feature'
  | 'component-group'
  | 'service-group'
  | 'core'
  | 'configuration'
  | 'documentation'
  | 'tooling'
  | 'unknown';

export type ModuleKnowledgeConfidence = 'high' | 'medium' | 'low';

export interface ModuleKnowledge {
  name: string;
  path: string;
  relativePath: string;
  type: ModuleType;
  framework?: string;
  responsibility: string;
  importantFiles: string[];
  relatedFolders: string[];
  signals: string[];
  confidence: ModuleKnowledgeConfidence;
}

export type DependencyEdgeType =
  | 'imports'
  | 'contains'
  | 'references'
  | 'configures'
  | 'unknown';

export type DependencyEdgeConfidence = 'high' | 'medium' | 'low';

export interface DependencyEdgeEvidence {
  sourceFile: string;
  importPath: string;
}

export interface DependencyNode {
  id: string;
  name: string;
  type: ModuleType;
  relativePath: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: DependencyEdgeType;
  evidence: DependencyEdgeEvidence[];
  confidence: DependencyEdgeConfidence;
}

export interface DependencyGraphKnowledge {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  generatedAt: string;
}

export type ConventionCategory =
  | 'language'
  | 'tooling'
  | 'documentation'
  | 'architecture'
  | 'testing'
  | 'package-management'
  | 'generated-context'
  | 'repository-structure'
  | 'unknown';

export type ConventionConfidence = 'high' | 'medium' | 'low';

export type ConventionEvidenceType =
  | 'file'
  | 'folder'
  | 'config'
  | 'module'
  | 'technology'
  | 'knowledge';

export interface ConventionEvidence {
  type: ConventionEvidenceType;
  source: string;
  detail: string;
}

export interface ConventionKnowledge {
  category: ConventionCategory;
  name: string;
  description: string;
  evidence: ConventionEvidence[];
  confidence: ConventionConfidence;
}

export type NavigationTaskType =
  | 'architecture-change'
  | 'new-feature'
  | 'bug-fix'
  | 'test-change'
  | 'documentation-change'
  | 'config-change'
  | 'dependency-change'
  | 'ai-agent-integration';

export type NavigationEntryConfidence = 'high' | 'medium' | 'low';

export type NavigationKnowledgeSection =
  | 'repository'
  | 'technologies'
  | 'documentation'
  | 'folderContexts'
  | 'modules'
  | 'dependencyGraph'
  | 'conventions'
  | 'navigationMap';

export interface NavigationEntry {
  taskType: NavigationTaskType;
  description: string;
  recommendedKnowledge: NavigationKnowledgeSection[];
  recommendedDocuments: string[];
  relatedModules: string[];
  relatedFolders: string[];
  warnings: string[];
  confidence: NavigationEntryConfidence;
}

export interface NavigationMapKnowledge {
  entries: NavigationEntry[];
  generatedAt: string;
}

export interface AnalysisKnowledge {
  status: AnalysisKnowledgeStatus;
  architecture?: string;
  conventions?: ConventionKnowledge[];
  dependencyGraph?: DependencyGraphKnowledge;
  navigationMap?: NavigationMapKnowledge;
  folderContexts?: FolderKnowledge[];
  modules?: ModuleKnowledge[];
  implementationRecommendations?: string[];
}

export interface ProjectKnowledge {
  metadata: KnowledgeMetadata;
  repository: RepositoryKnowledge;
  technologies: TechnologyKnowledge;
  documentation: DocumentationKnowledge;
  analysis: AnalysisKnowledge;
}
