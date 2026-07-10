import { PlannedDocument } from '../../domain/documentation-plan';
import { ProjectKnowledge } from '../../knowledge';
import {
  hasRegisteredTemplate,
  REGISTERED_TEMPLATE_OUTPUT_PATHS,
  renderDocumentWithTemplate,
} from '../../templates/template-engine';
import { TemplateRenderKind } from '../../templates/template-context';

/** @deprecated Use TemplateRenderKind from src/templates/template-context.ts. Maps `template` to legacy `pkm`. */
export type DocumentRendererKind = TemplateRenderKind | 'pkm';

export interface RenderedDocument {
  markdown: string;
  rendererKind: DocumentRendererKind;
}

export const PKM_RENDERED_DOCUMENT_PATHS: ReadonlyArray<string> = REGISTERED_TEMPLATE_OUTPUT_PATHS;

export function hasPkmRenderer(relativePath: string): boolean {
  return hasRegisteredTemplate(relativePath);
}

export function renderPlannedDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): RenderedDocument {
  const rendered = renderDocumentWithTemplate(document, knowledge);

  return {
    markdown: rendered.content,
    rendererKind: rendered.renderKind === 'template' ? 'pkm' : 'generic',
  };
}

export type { MarkdownRenderer } from './render-helpers';
