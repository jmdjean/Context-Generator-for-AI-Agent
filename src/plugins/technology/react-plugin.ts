import { ProjectKnowledge } from '../../knowledge';
import { PluginContext } from '../plugin-context';
import { createSkippedPluginResult } from '../plugin-result';
import { TechnologyPlugin } from '../technology-plugin';

export const reactPlugin: TechnologyPlugin = {
  id: 'technology.react',
  name: 'React',
  description: 'Technology plugin for React projects. Placeholder in v1.',
  version: '1.0.0',
  kind: 'technology',
  framework: 'React',

  supports(knowledge: ProjectKnowledge): boolean {
    return knowledge.technologies.frameworks.some((framework) =>
      framework.toLowerCase().includes('react'),
    );
  },

  analyze(_context: PluginContext) {
    return createSkippedPluginResult('skipped: React analysis not implemented yet');
  },
};
