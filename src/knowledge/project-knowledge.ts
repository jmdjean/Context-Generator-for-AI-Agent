import { RepositoryNode, TechnologyConfidence } from '../domain';
import { DocumentationPlan } from '../domain/documentation-plan';
import type { AIReadinessKnowledge } from '../readiness/ai-readiness-model';
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

export interface AiInsightsKnowledge {
  architectureSummary?: string;
  risks?: string[];
  recommendations?: string[];
  agentGuidance?: string[];
  generatedAt: string;
  model: string;
}

/**
 * Lifecycle status for staged documentation work: a pipeline stage, a plan
 * entry, or a per-module result. Supports partial progress, skips, and retries.
 */
export type StagedDocumentationStatus =
  | 'pending'
  | 'skipped'
  | 'in-progress'
  | 'partial'
  | 'completed'
  | 'failed';

export type StagedDocumentationStageId =
  | 'architecture'
  | 'module-plan'
  | 'module-documentation';

/**
 * Per-stage execution metadata for observability. Provider/model fields are
 * optional transport identifiers only — never treat them as ground truth.
 */
export interface StagedDocumentationStageExecution {
  stageId: StagedDocumentationStageId;
  status: StagedDocumentationStatus;
  startedAt?: string;
  completedAt?: string;
  provider?: string;
  model?: string;
  warnings: string[];
  /** Safe failure detail; do not store secrets or raw provider payloads. */
  error?: string;
}

/**
 * Architecture-stage output mirrored in PKM so later stages and renderers
 * consume structured data instead of scraping Markdown from disk.
 */
export interface ArchitectureStageKnowledge {
  status: StagedDocumentationStatus;
  /** Short architecture summary for routing and later stage prompts. */
  summary?: string;
  /** Architecture body used by templates and downstream AI stages. */
  content?: string;
  /** Relative document paths this stage intends to feed. */
  documentPaths: string[];
  generatedAt?: string;
  provider?: string;
  model?: string;
  warnings: string[];
  error?: string;
}

/**
 * One planned module documentation unit derived from discovered modules.
 */
export interface ModuleDocumentationPlanEntry {
  /** Stable id — typically the module relativePath. */
  moduleId: string;
  moduleName: string;
  moduleRelativePath: string;
  /** Relative path of the planned Markdown document. */
  documentPath: string;
  /** 1-based sequence for writer/order-aware rendering. */
  order: number;
  status: StagedDocumentationStatus;
  /** Why this module is documented and/or ordered this way. */
  rationale?: string;
}

export interface ModuleDocumentationPlanKnowledge {
  status: StagedDocumentationStatus;
  entries: ModuleDocumentationPlanEntry[];
  generatedAt?: string;
  warnings: string[];
  error?: string;
}

/**
 * Per-module AI documentation result ready for deterministic rendering.
 */
export interface ModuleDocumentationResultKnowledge {
  moduleId: string;
  moduleName: string;
  moduleRelativePath: string;
  documentPath: string;
  status: StagedDocumentationStatus;
  summary?: string;
  content?: string;
  generatedAt?: string;
  provider?: string;
  model?: string;
  warnings: string[];
  error?: string;
}

export interface ModuleDocumentationResultsKnowledge {
  status: StagedDocumentationStatus;
  results: ModuleDocumentationResultKnowledge[];
  generatedAt?: string;
  warnings: string[];
}

/**
 * Staged multi-agent documentation state. Absent until staged AI/planning
 * stages run. AI content here is enrichment, not deterministic truth.
 */
export interface StagedDocumentationKnowledge {
  architecture?: ArchitectureStageKnowledge;
  modulePlan?: ModuleDocumentationPlanKnowledge;
  moduleResults?: ModuleDocumentationResultsKnowledge;
  /** One entry per staged pipeline step for partial progress visibility. */
  execution: StagedDocumentationStageExecution[];
  generatedAt?: string;
}

export type AgentExportTarget =
  | 'generic'
  | 'cursor'
  | 'claude'
  | 'codex'
  | 'copilot';

export interface AgentExportFileKnowledge {
  relativePath: string;
  status: 'written' | 'skipped';
  reason?: string;
}

export interface AgentExportResultKnowledge {
  target: AgentExportTarget;
  filesWritten: number;
  filesSkipped: number;
  warnings: string[];
  generatedAt: string;
  files: AgentExportFileKnowledge[];
}

export interface AgentExportsKnowledge {
  enabled: boolean;
  enabledTargets: AgentExportTarget[];
  results: AgentExportResultKnowledge[];
  generatedAt: string;
  warnings: string[];
}

export interface AnalysisKnowledge {
  status: AnalysisKnowledgeStatus;
  architecture?: string;
  aiInsights?: AiInsightsKnowledge;
  /** Staged architecture / module-plan / per-module documentation outputs. */
  stagedDocumentation?: StagedDocumentationKnowledge;
  aiReadiness?: AIReadinessKnowledge;
  agentExports?: AgentExportsKnowledge;
  changeSummary?: ChangeSummaryKnowledge;
  documentImpact?: DocumentImpactSummaryKnowledge;
  conventions?: ConventionKnowledge[];
  dependencyGraph?: DependencyGraphKnowledge;
  navigationMap?: NavigationMapKnowledge;
  folderContexts?: FolderKnowledge[];
  modules?: ModuleKnowledge[];
  implementationRecommendations?: string[];
}

export type ChangeSection =
  | 'detectedFiles'
  | 'repositoryTree'
  | 'technologies'
  | 'folderContexts'
  | 'modules'
  | 'dependencyGraph'
  | 'conventions'
  | 'navigationMap'
  | 'aiInsights'
  | 'stagedDocumentation'
  | 'documentation';

export interface DependencyEdgeChangeKnowledge {
  from: string;
  to: string;
  type: DependencyEdgeType;
  change: 'added' | 'removed';
}

export type ChangeBaselineStatus = 'none' | 'loaded' | 'unreadable' | 'repository-mismatch';

export interface ChangeSummaryKnowledge {
  isInitialRun: boolean;
  baselineStatus: ChangeBaselineStatus;
  warnings: string[];
  changedSections: ChangeSection[];
  addedModules: string[];
  removedModules: string[];
  changedTechnologies: string[];
  technologyConfidenceChanged: boolean;
  addedFolders: string[];
  removedFolders: string[];
  dependencyEdgeChanges: DependencyEdgeChangeKnowledge[];
  generatedAt: string;
}

export interface DocumentImpactKnowledge {
  documentPath: string;
  reason: string;
  impactedBy: ChangeSection[];
  shouldRegenerate: boolean;
}

export interface DocumentImpactSummaryKnowledge {
  impactedDocuments: DocumentImpactKnowledge[];
  unchangedDocuments: string[];
  generatedAt: string;
}

export interface ProjectKnowledge {
  metadata: KnowledgeMetadata;
  repository: RepositoryKnowledge;
  technologies: TechnologyKnowledge;
  documentation: DocumentationKnowledge;
  analysis: AnalysisKnowledge;
}
