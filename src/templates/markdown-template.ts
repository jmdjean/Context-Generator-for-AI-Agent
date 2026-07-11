import { PlannedDocument } from '../domain/documentation-plan';
import { renderDeterministicDocument } from '../docs/document-template';
import { renderAgentNavigationDocument } from '../docs/markdown-renderers/agent-navigation-renderer';
import { renderAiContextDocument } from '../docs/markdown-renderers/ai-context-renderer';
import { renderAiStartHereDocument } from '../docs/markdown-renderers/ai-start-here-renderer';
import { renderArchitectureDocument } from '../docs/markdown-renderers/architecture-renderer';
import { renderContextRouterDocument } from '../docs/markdown-renderers/context-router-renderer';
import { renderConventionsDocument } from '../docs/markdown-renderers/conventions-renderer';
import { renderDependencyMapDocument } from '../docs/markdown-renderers/dependency-map-renderer';
import { renderDocumentationMaintenanceDocument } from '../docs/markdown-renderers/documentation-maintenance-renderer';
import { renderDocumentationStatusDocument } from '../docs/markdown-renderers/documentation-status-renderer';
import { renderFolderStructureDocument } from '../docs/markdown-renderers/folder-structure-renderer';
import { renderImplementationGuideDocument } from '../docs/markdown-renderers/implementation-guide-renderer';
import { renderModuleDocument } from '../docs/markdown-renderers/module-document-renderer';
import { renderModuleDocumentationPlanDocument } from '../docs/markdown-renderers/module-documentation-plan-renderer';
import { renderProjectMapDocument } from '../docs/markdown-renderers/project-map-renderer';
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
export const MODULE_DOCUMENT_TEMPLATE_ID = 'markdown.module-document';

/** Sentinel outputPath — module docs are resolved by generatorKind, not path. */
export const MODULE_DOCUMENT_TEMPLATE_OUTPUT_PATH = 'code/components/<module>.md';

export const MODULE_DOCUMENT_TEMPLATE: TemplateDefinition = createMarkdownTemplate(
  MODULE_DOCUMENT_TEMPLATE_ID,
  'Module Document',
  'Renders per-module cards from deterministic module knowledge and staged moduleResults.',
  MODULE_DOCUMENT_TEMPLATE_OUTPUT_PATH,
  (document, context) => renderModuleDocument(document, context.knowledge),
);

export const MARKDOWN_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
  createMarkdownTemplate(
    'markdown.architecture',
    'Architecture Document',
    'Renders architecture.md from PKM technologies, modules, conventions, dependency graph, and staged architecture output.',
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
  createMarkdownTemplate(
    'markdown.ai-start-here',
    'AI Start Here Document',
    'Renders AI_START_HERE.md orientation from PKM modules, technologies, and conventions.',
    'AI_START_HERE.md',
    (document, context) => renderAiStartHereDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.context-router',
    'Context Router Document',
    'Renders CONTEXT_ROUTER.md ordered reading paths from the PKM navigation map.',
    'CONTEXT_ROUTER.md',
    (document, context) => renderContextRouterDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.documentation-maintenance',
    'Documentation Maintenance Document',
    'Renders DOCUMENTATION_MAINTENANCE.md change-type guidance from PKM navigation entries.',
    'DOCUMENTATION_MAINTENANCE.md',
    (document, context) => renderDocumentationMaintenanceDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.documentation-status',
    'Documentation Status Document',
    'Renders DOCUMENTATION_STATUS.md trust ledger from stagedDocumentation and the plan.',
    'DOCUMENTATION_STATUS.md',
    (document, context) => renderDocumentationStatusDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.project-map',
    'Project Map Document',
    'Renders PROJECT_MAP.md from PKM modules, folders, and planned entry points.',
    'PROJECT_MAP.md',
    (document, context) => renderProjectMapDocument(document, context.knowledge),
  ),
  createMarkdownTemplate(
    'markdown.module-documentation-plan',
    'Module Documentation Plan Document',
    'Renders module-documentation-plan.md from analysis.stagedDocumentation.modulePlan.',
    'module-documentation-plan.md',
    (document, context) => renderModuleDocumentationPlanDocument(document, context.knowledge),
  ),
];

export function renderGenericMarkdownDocument(
  document: PlannedDocument,
  context: TemplateContext,
): string {
  return renderDeterministicDocument(document, context.knowledge);
}
