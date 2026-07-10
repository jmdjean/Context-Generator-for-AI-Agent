import { ProjectKnowledge } from '../../knowledge';
import { PluginContext } from '../plugin-context';
import { createSkippedPluginResult } from '../plugin-result';
import { TechnologyPlugin } from '../technology-plugin';

export const nodePlugin: TechnologyPlugin = {
  id: 'technology.node',
  name: 'Node.js',
  description: 'Technology plugin for Node.js projects. Placeholder in v1.',
  version: '0.1.0',
  kind: 'technology',
  framework: 'Node.js',

  supports(knowledge: ProjectKnowledge): boolean {
    if (knowledge.technologies.frameworks.length > 0) {
      return false;
    }

    const languages = knowledge.technologies.languages.map((language) => language.toLowerCase());

    return (
      knowledge.repository.detectedFiles.includes('package.json') &&
      (languages.includes('typescript') || languages.includes('javascript'))
    );
  },

  analyze(_context: PluginContext) {
    return createSkippedPluginResult('skipped: Node.js analysis not implemented yet');
  },
};
