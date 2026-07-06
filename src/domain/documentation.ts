export interface DocumentSection {
  heading: string;
  content: string;
  order: number;
}

export interface DocumentModel {
  title: string;
  relativePath: string;
  description: string;
  sections: DocumentSection[];
  metadata: Record<string, string>;
}
