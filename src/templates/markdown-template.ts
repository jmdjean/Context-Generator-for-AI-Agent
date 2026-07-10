import { PlannedDocument } from '../domain/documentation-plan';
import { renderDeterministicDocument } from '../docs/document-template';
import { renderAgentNavigationDocument } from '../docs/markdown-renderers/agent-navigation-renderer';
import { renderAiContextDocument } from '../docs/markdown-renderers/ai-context-renderer';
import { renderArchitectureDocument } from '../docs/markdown-renderers/architecture-renderer';
import { renderConventionsDocument } from '../docs/markdown-renderers/conventions-renderer';
import { renderDependencyMapDocument } from '../docs/markdown-renderers/dependency-map-renderer';
import { renderFolderStructureDocument } from '../docs/markdown-renderers/folder-structure-renderer';
import { renderImplementationGuideDocument } from '../docs/markdown-renderers/implementation-guide-renderer';
import { TemplateContext, TemplateDefinition } from './template-context';

function createMarkdownTemplate(
  id: string,
  name: string,
  description: string,
  outputPath: string,
  renderBody: (document: PlannedDocument, context: TemplateContext) => string,
): TemplateDefinition {
  return {
    id,
    name,
    description,
    outputPath,
    render(context, document) {
      return renderBody(document, context);
    },
  };
}

export const GENERIC_MARKDOWN_TEMPLATE_ID = 'markdown.generic';

export const MARKDOWN_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
  createMarkdownTemplate(
    'markdown.architecture',
    'Architecture Document',
    'Renders architecture.md from PKM technologies, modules, conventions, dependency graph, and navigation map.',
    'architecture.md',
    (document, context) => renderArchitectureDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.folder-structure',
    'Folder Structure Document',
    'Renders folder-structure.md from PKM folder contexts and ignored paths.',
    'folder-structure.md',
    (document, context) => renderFolderStructureDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.dependency-map',
    'Dependency Map Document',
    'Renders dependency-map.md from PKM dependency graph nodes, edges, and evidence.',
    'dependency-map.md',
    (document, context) => renderDependencyMapDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.conventions',
    'Conventions Document',
    'Renders conventions.md from PKM convention knowledge grouped by category.',
    'conventions.md',
    (document, context) => renderConventionsDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.agent-navigation',
    'Agent Navigation Document',
    'Renders agent-navigation.md from PKM navigation map entries and task guidance.',
    'agent-navigation.md',
    (document, context) => renderAgentNavigationDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.ai-context',
    'AI Context Document',
    'Renders ai-context.md from a cross-section PKM summary for agent onboarding.',
    'ai-context.md',
    (document, context) => renderAiContextDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.implementation-guide',
    'Implementation Guide Document',
    'Renders implementation-guide.md from PKM modules, navigation map, and metadata.',
    'implementation-guide.md',
    (document, context) => renderImplementationGuideDocument(document, context.knowledge),
  ),
];

export function renderGenericMarkdownDocument(
  document: PlannedDocument,
  context: TemplateContext,
): string {
  return renderDeterministicDocument(document, context.knowledge);
}
