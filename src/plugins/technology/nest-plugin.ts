import { ProjectKnowledge } from '../../knowledge';
import { PluginContext } from '../plugin-context';
import { createSkippedPluginResult } from '../plugin-result';
import { TechnologyPlugin } from '../technology-plugin';

export const nestPlugin: TechnologyPlugin = {
  id: 'technology.nest',
  name: 'NestJS',
  description: 'Technology plugin for NestJS projects. Placeholder in v1.',
  version: '1.0.0',
  kind: 'technology',
  framework: 'NestJS',

  supports(knowledge: ProjectKnowledge): boolean {
    return knowledge.technologies.frameworks.some((framework) =>
      framework.toLowerCase().includes('nest'),
    );
  },

  analyze(_context: PluginContext) {
    return createSkippedPluginResult('skipped: NestJS analysis not implemented yet');
  },
};
