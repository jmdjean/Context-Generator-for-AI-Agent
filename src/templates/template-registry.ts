import { AI_READINESS_TEMPLATE } from '../readiness/ai-readiness-renderer';
import { MARKDOWN_TEMPLATES } from './markdown-template';
import { TemplateDefinition } from './template-context';

const REGISTERED_TEMPLATES: ReadonlyArray<TemplateDefinition> = [
  ...MARKDOWN_TEMPLATES,
  AI_READINESS_TEMPLATE,
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
  REGISTERED_TEMPLATES.map((template) => [template.outputPath, template]),
);

export const REGISTERED_TEMPLATE_OUTPUT_PATHS: ReadonlyArray<string> = [
  ...templatesByOutputPath.keys(),
];

export function getTemplateByOutputPath(outputPath: string): TemplateDefinition | undefined {
  return templatesByOutputPath.get(outputPath);
}

export function hasRegisteredTemplate(outputPath: string): boolean {
  return templatesByOutputPath.has(outputPath);
}

export function listRegisteredTemplates(): ReadonlyArray<TemplateDefinition> {
  return REGISTERED_TEMPLATES;
}
