import { ProjectKnowledge } from '../knowledge';
import { PluginContext } from './plugin-context';
import { Plugin } from './plugin-contract';
import { PluginResult } from './plugin-result';

export interface TechnologyPlugin extends Plugin {
  readonly kind: 'technology';
  readonly framework: string;
  supports(knowledge: ProjectKnowledge): boolean;
  analyze(context: PluginContext): PluginResult;
}

export function isTechnologyPlugin(plugin: Plugin): plugin is TechnologyPlugin {
  return plugin.kind === 'technology';
}
