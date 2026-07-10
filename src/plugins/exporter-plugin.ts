/**
 * Reserved contract for future exporter plugins.
 * Agent export today runs through `src/exporters/` (`AgentExporter` contract).
 * When implemented, plugins will register here and run through `PluginManager`.
 */
import { ProjectKnowledge } from '../knowledge';
import { PluginContext } from './plugin-context';
import { Plugin } from './plugin-contract';
import { PluginResult } from './plugin-result';

export interface ExporterPlugin extends Plugin {
  readonly kind: 'exporter';
  supports(knowledge: ProjectKnowledge): boolean;
  export(context: PluginContext): PluginResult;
}

export function isExporterPlugin(plugin: Plugin): plugin is ExporterPlugin {
  return plugin.kind === 'exporter';
}
