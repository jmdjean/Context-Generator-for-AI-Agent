export type DocumentPriority = 'required' | 'recommended' | 'optional';
export type DocumentSource = 'core' | 'technology' | 'agent' | 'playbook' | 'module';

/**
 * Which staged documentation phase owns this planned document.
 * Baseline covers the early static plan; later stages expand the plan.
 */
export type DocumentationStage =
  | 'baseline'
  | 'routing'
  | 'architecture'
  | 'module-plan'
  | 'module'
  | 'readiness';

/**
 * How the document body is expected to be produced.
 * Writers/templates use this without re-deriving planner intent.
 */
export type DocumentGeneratorKind =
  | 'deterministic'
  | 'staged-architecture'
  | 'staged-module-plan'
  | 'staged-module'
  | 'generic';

export interface PlannedDocument {
  title: string;
  relativePath: string;
  purpose: string;
  priority: DocumentPriority;
  source: DocumentSource;
  dependsOn?: string[];
  /** Staged ownership for writer ordering and selective regeneration. */
  stage?: DocumentationStage;
  /** Presentation/generation strategy for this document. */
  generatorKind?: DocumentGeneratorKind;
  /** Stable module id when this document is per-module (typically relativePath). */
  moduleId?: string;
  moduleName?: string;
  /** 1-based sequence within a stage group (module docs, routing docs, …). */
  order?: number;
}

export interface DocumentationPlan {
  docsDir: string;
  documents: PlannedDocument[];
  generatedAt: string;
  strategy: string;
}
