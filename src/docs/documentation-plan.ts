export type DocumentPriority = 'required' | 'recommended' | 'optional';
export type DocumentSource = 'core' | 'technology' | 'agent';

export interface PlannedDocument {
  title: string;
  relativePath: string;
  purpose: string;
  priority: DocumentPriority;
  source: DocumentSource;
  dependsOn?: string[];
}

export interface DocumentationPlan {
  docsDir: string;
  documents: PlannedDocument[];
  generatedAt: string;
  strategy: string;
}
