import { MARKDOWN_TEMPLATES } from './markdown-template';
import { TemplateDefinition } from './template-context';

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

assertUniqueTemplateRegistry(MARKDOWN_TEMPLATES);

const templatesByOutputPath = new Map<string, TemplateDefinition>(
  MARKDOWN_TEMPLATES.map((template) => [template.outputPath, template]),
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
  return MARKDOWN_TEMPLATES;
}
