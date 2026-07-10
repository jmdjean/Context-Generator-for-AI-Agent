import { PlannedDocument } from '../domain/documentation-plan';
import { ProjectKnowledge } from '../knowledge';

export interface TemplateContext {
  knowledge: ProjectKnowledge;
  generatedAt: string;
  docsDir: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  outputPath: string;
  render(context: TemplateContext, document: PlannedDocument): string;
}

export interface TemplateRenderResult {
  outputPath: string;
  content: string;
  templateId: string;
  generatedAt: string;
}

export type TemplateRenderKind = 'template' | 'generic';

export interface RenderedPlannedDocument extends TemplateRenderResult {
  renderKind: TemplateRenderKind;
}
