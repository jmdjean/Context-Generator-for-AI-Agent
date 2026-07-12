import { PlannedDocument } from '../domain/documentation-plan';
import { AI_READINESS_TEMPLATE } from '../readiness/ai-readiness-renderer';
import {
  CAPABILITY_STUB_TEMPLATE,
  MARKDOWN_TEMPLATES,
  MODULE_DOCUMENT_TEMPLATE,
  MODULE_DOCUMENT_TEMPLATE_OUTPUT_PATH,
} from './markdown-template';
import { TemplateDefinition } from './template-context';

const PATH_REGISTERED_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
  ...MARKDOWN_TEMPLATES,
  AI_READINESS_TEMPLATE,
];

const REGISTERED_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
  ...PATH_REGISTERED_TEMPLATES,
  MODULE_DOCUMENT_TEMPLATE,
  CAPABILITY_STUB_TEMPLATE,
];

function assertUniqueTemplateRegistry(templates: ReadonlyArray<TemplateDefinition>): void {
  const outputPaths = new Set<string>();
  const templateIds = new Set<string>();

  for (const template of templates) {
    if (outputPaths.has(template.outputPath)) {
      throw new Error(`Duplicate template outputPath: ${template.outputPath}`);
    }

    if (templateIds.has(template.id)) {
      throw new Error(`Duplicate template id: ${template.id}`);
    }

    outputPaths.add(template.outputPath);
    templateIds.add(template.id);
  }
}

assertUniqueTemplateRegistry(REGISTERED_TEMPLATES);

const templatesByOutputPath = new Map<string, TemplateDefinition>(
  PATH_REGISTERED_TEMPLATES.map((template) => [template.outputPath, template]),
);

export const REGISTERED_TEMPLATE_OUTPUT_PATHS: ReadonlyArray<string> = [
  ...templatesByOutputPath.keys(),
];

export function getTemplateByOutputPath(outputPath: string): TemplateDefinition | undefined {
  return templatesByOutputPath.get(outputPath);
}

/**
 * Resolve a template by planned-document metadata.
 * Prefer exact outputPath matches; fall back to generatorKind for dynamic module cards.
 */
export function resolveTemplateForDocument(
  document: PlannedDocument,
): TemplateDefinition | undefined {
  const byPath = getTemplateByOutputPath(document.relativePath);
  if (byPath) {
    return byPath;
  }

  if (document.generatorKind === 'staged-module' || document.stage === 'module') {
    return MODULE_DOCUMENT_TEMPLATE;
  }

  if (document.generatorKind === 'capability-stub') {
    return CAPABILITY_STUB_TEMPLATE;
  }

  return undefined;
}

export function hasRegisteredTemplate(outputPath: string): boolean {
  return templatesByOutputPath.has(outputPath);
}

export function hasTemplateForDocument(document: PlannedDocument): boolean {
  return resolveTemplateForDocument(document) !== undefined;
}

export function listRegisteredTemplates(): ReadonlyArray<TemplateDefinition> {
  return REGISTERED_TEMPLATES;
}

export { MODULE_DOCUMENT_TEMPLATE_OUTPUT_PATH };
