import { PlannedDocument } from '../domain/documentation-plan';
import { getDocsDir, getDocumentationPlan, ProjectKnowledge } from '../knowledge';
import {
  GENERIC_MARKDOWN_TEMPLATE_ID,
  renderGenericMarkdownDocument,
} from './markdown-template';
import { getTemplateByOutputPath, hasRegisteredTemplate } from './template-registry';
import {
  RenderedPlannedDocument,
  TemplateContext,
  TemplateRenderResult,
} from './template-context';

export function buildTemplateContext(knowledge: ProjectKnowledge): TemplateContext {
  return {
    knowledge,
    generatedAt: knowledge.metadata.generatedAt,
    docsDir: getDocsDir(knowledge),
  };
}

export function renderDocumentWithTemplate(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): RenderedPlannedDocument {
  const context = buildTemplateContext(knowledge);
  const template = getTemplateByOutputPath(document.relativePath);

  if (template) {
    const content = template.render(context, document);
    return {
      outputPath: document.relativePath,
      content,
      templateId: template.id,
      generatedAt: context.generatedAt,
      renderKind: 'template',
    };
  }

  const content = renderGenericMarkdownDocument(document, context);
  return {
    outputPath: document.relativePath,
    content,
    templateId: GENERIC_MARKDOWN_TEMPLATE_ID,
    generatedAt: context.generatedAt,
    renderKind: 'generic',
  };
}

export function renderDocumentationPlan(
  knowledge: ProjectKnowledge,
  documents?: ReadonlyArray<PlannedDocument>,
): TemplateRenderResult[] {
  const plannedDocuments = documents ?? getDocumentationPlan(knowledge).documents;

  return plannedDocuments.map((document) => {
    const rendered = renderDocumentWithTemplate(document, knowledge);
    return {
      outputPath: rendered.outputPath,
      content: rendered.content,
      templateId: rendered.templateId,
      generatedAt: rendered.generatedAt,
    };
  });
}

export { hasRegisteredTemplate, REGISTERED_TEMPLATE_OUTPUT_PATHS } from './template-registry';
