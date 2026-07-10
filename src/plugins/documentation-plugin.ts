/**
 * Reserved contract for future documentation plugins.
 * Markdown generation today runs through `src/docs/documentation-writer.ts`.
 * When implemented, plugins will contribute sections via `PluginContributions.documentationSections`.
 */
import { ProjectKnowledge } from '../knowledge';
import { PluginContext } from './plugin-context';
import { Plugin } from './plugin-contract';
import { PluginResult } from './plugin-result';

export interface DocumentationPlugin extends Plugin {
  readonly kind: 'documentation';
  supports(knowledge: ProjectKnowledge): boolean;
  contribute(context: PluginContext): PluginResult;
}

export function isDocumentationPlugin(plugin: Plugin): plugin is DocumentationPlugin {
  return plugin.kind === 'documentation';
}
