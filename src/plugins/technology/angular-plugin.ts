import { ProjectKnowledge } from '../../knowledge';
import { PluginContext } from '../plugin-context';
import { createSkippedPluginResult } from '../plugin-result';
import { TechnologyPlugin } from '../technology-plugin';

const ANGULAR_CONFIG_FILES = ['angular.json', 'angular-cli.json'] as const;

function hasAngularDependency(knowledge: ProjectKnowledge): boolean {
  const frameworks = knowledge.technologies.frameworks;
  if (frameworks.some((framework) => framework.toLowerCase().includes('angular'))) {
    return true;
  }

  const detectedFiles = knowledge.repository.detectedFiles;
  return detectedFiles.some((file) => ANGULAR_CONFIG_FILES.includes(file as (typeof ANGULAR_CONFIG_FILES)[number]));
}

export const angularPlugin: TechnologyPlugin = {
  id: 'technology.angular',
  name: 'Angular',
  description: 'Technology plugin for Angular projects. Detection only in v1.',
  version: '1.0.0',
  kind: 'technology',
  framework: 'Angular',

  supports(knowledge: ProjectKnowledge): boolean {
    return hasAngularDependency(knowledge);
  },

  analyze(_context: PluginContext) {
    return createSkippedPluginResult('skipped: Angular analysis not implemented yet');
  },
};
