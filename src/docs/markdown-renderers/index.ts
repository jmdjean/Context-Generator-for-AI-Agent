import { PlannedDocument } from '../../domain/documentation-plan';
import { ProjectKnowledge } from '../../knowledge';
import { renderDeterministicDocument } from '../document-template';
import { renderAgentNavigationDocument } from './agent-navigation-renderer';
import { renderAiContextDocument } from './ai-context-renderer';
import { renderArchitectureDocument } from './architecture-renderer';
import { renderConventionsDocument } from './conventions-renderer';
import { renderDependencyMapDocument } from './dependency-map-renderer';
import { renderFolderStructureDocument } from './folder-structure-renderer';
import { renderImplementationGuideDocument } from './implementation-guide-renderer';
import { MarkdownRenderer } from './render-helpers';

export type DocumentRendererKind = 'pkm' | 'generic';

export interface RenderedDocument {
  markdown: string;
  rendererKind: DocumentRendererKind;
}

const PKM_RENDERERS: Readonly<Record<string, MarkdownRenderer>> = {
  'architecture.md': renderArchitectureDocument,
  'folder-structure.md': renderFolderStructureDocument,
  'dependency-map.md': renderDependencyMapDocument,
  'conventions.md': renderConventionsDocument,
  'agent-navigation.md': renderAgentNavigationDocument,
  'ai-context.md': renderAiContextDocument,
  'implementation-guide.md': renderImplementationGuideDocument,
};

export const PKM_RENDERED_DOCUMENT_PATHS: ReadonlyArray<string> = Object.keys(PKM_RENDERERS);

export function hasPkmRenderer(relativePath: string): boolean {
  return relativePath in PKM_RENDERERS;
}

export function renderPlannedDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): RenderedDocument {
  const renderer = PKM_RENDERERS[document.relativePath];

  if (renderer) {
    return { markdown: renderer(document, knowledge), rendererKind: 'pkm' };
  }

  return {
    markdown: renderDeterministicDocument(document, knowledge),
    rendererKind: 'generic',
  };
}

export type { MarkdownRenderer } from './render-helpers';
