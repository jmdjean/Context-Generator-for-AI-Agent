import { AnalyzerPlugin } from './analyzer-plugin';
import { BUILTIN_ANALYZER_PLUGINS } from './builtin';
import { DocumentationPlugin } from './documentation-plugin';
import { ExporterPlugin } from './exporter-plugin';
import { Plugin } from './plugin-contract';
import { TechnologyPlugin } from './technology-plugin';
import { TECHNOLOGY_PLUGINS } from './technology';

const ALL_PLUGINS: ReadonlyArray<Plugin> = [
  ...BUILTIN_ANALYZER_PLUGINS,
  ...TECHNOLOGY_PLUGINS,
];

export class PluginRegistry {
  private readonly pluginsById: Map<string, Plugin>;

  constructor(plugins: ReadonlyArray<Plugin> = ALL_PLUGINS) {
    this.pluginsById = new Map();

    for (const plugin of plugins) {
      if (this.pluginsById.has(plugin.id)) {
        throw new Error(`Duplicate plugin id registered: ${plugin.id}`);
      }
      this.pluginsById.set(plugin.id, plugin);
    }
  }

  listPlugins(): ReadonlyArray<Plugin> {
    return [...this.pluginsById.values()];
  }

  getById(id: string): Plugin | undefined {
    return this.pluginsById.get(id);
  }

  listAnalyzerPlugins(): ReadonlyArray<AnalyzerPlugin> {
    return this.listPlugins().filter(
      (plugin): plugin is AnalyzerPlugin => plugin.kind === 'analyzer',
    );
  }

  listTechnologyPlugins(): ReadonlyArray<TechnologyPlugin> {
    return this.listPlugins().filter(
      (plugin): plugin is TechnologyPlugin => plugin.kind === 'technology',
    );
  }

  listDocumentationPlugins(): ReadonlyArray<DocumentationPlugin> {
    return this.listPlugins().filter(
      (plugin): plugin is DocumentationPlugin => plugin.kind === 'documentation',
    );
  }

  listExporterPlugins(): ReadonlyArray<ExporterPlugin> {
    return this.listPlugins().filter(
      (plugin): plugin is ExporterPlugin => plugin.kind === 'exporter',
    );
  }

  register(plugin: Plugin): void {
    if (this.pluginsById.has(plugin.id)) {
      throw new Error(`Duplicate plugin id registered: ${plugin.id}`);
    }
    this.pluginsById.set(plugin.id, plugin);
  }
}

let defaultRegistry: PluginRegistry | undefined;

export function getDefaultPluginRegistry(): PluginRegistry {
  if (defaultRegistry === undefined) {
    defaultRegistry = new PluginRegistry();
  }
  return defaultRegistry;
}

export function resetDefaultPluginRegistry(): void {
  defaultRegistry = undefined;
}
