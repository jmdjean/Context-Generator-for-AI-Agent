import { ProjectKnowledge } from '../knowledge';
import { PluginContext } from './plugin-context';
import { Plugin, PluginKind } from './plugin-contract';
import { PluginResult } from './plugin-result';

export interface AnalyzerPlugin extends Plugin {
  readonly kind: 'analyzer';
  supports(knowledge: ProjectKnowledge): boolean;
  analyze(context: PluginContext): PluginResult;
}

export function isAnalyzerPlugin(plugin: Plugin): plugin is AnalyzerPlugin {
  return plugin.kind === 'analyzer';
}
