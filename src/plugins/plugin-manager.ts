import { ProjectKnowledge } from '../knowledge';
import { AnalyzerPlugin, isAnalyzerPlugin } from './analyzer-plugin';
import { BUILTIN_ANALYZER_PLUGIN_ORDER } from './builtin';
import { PluginContext } from './plugin-context';
import { PluginLogger } from './plugin-logger';
import { mergePluginContributions } from './plugin-merger';
import { getDefaultPluginRegistry, PluginRegistry } from './plugin-registry';
import { createFailedPluginResult, PluginResult } from './plugin-result';
import { TechnologyPlugin } from './technology-plugin';

export interface PluginExecutionOutcome {
  knowledge: ProjectKnowledge;
  result: PluginResult;
}

export interface AnalyzerPluginExecutionSummary {
  knowledge: ProjectKnowledge;
  results: PluginResult[];
}

export class PluginManager {
  constructor(private readonly registry: PluginRegistry = getDefaultPluginRegistry()) {}

  executeAnalyzerPlugin(
    pluginId: string,
    context: PluginContext,
  ): PluginExecutionOutcome {
    const plugin = this.registry.getById(pluginId);

    if (plugin === undefined || !isAnalyzerPlugin(plugin)) {
      return {
        knowledge: context.knowledge,
        result: createFailedPluginResult(`analyzer plugin not found: ${pluginId}`),
      };
    }

    return this.runAnalyzerPlugin(plugin, context);
  }

  executeBuiltinAnalyzerPlugins(context: PluginContext): AnalyzerPluginExecutionSummary {
    const builtinPlugins = BUILTIN_ANALYZER_PLUGIN_ORDER.map((pluginId) =>
      this.registry.getById(pluginId),
    ).filter((plugin): plugin is AnalyzerPlugin => plugin !== undefined && isAnalyzerPlugin(plugin));

    return this.executeAnalyzerPluginsInOrder(context, builtinPlugins);
  }

  executeSupportedTechnologyPlugins(context: PluginContext): AnalyzerPluginExecutionSummary {
    let knowledge = context.knowledge;
    const results: PluginResult[] = [];

    for (const plugin of this.registry.listTechnologyPlugins()) {
      const outcome = this.runTechnologyPlugin(plugin, {
        ...context,
        knowledge,
      });
      knowledge = outcome.knowledge;
      results.push(outcome.result);

      if (outcome.result.status === 'failed') {
        break;
      }
    }

    return { knowledge, results };
  }

  private executeAnalyzerPluginsInOrder(
    context: PluginContext,
    plugins: ReadonlyArray<AnalyzerPlugin>,
  ): AnalyzerPluginExecutionSummary {
    let knowledge = context.knowledge;
    const results: PluginResult[] = [];

    for (const plugin of plugins) {
      const outcome = this.runAnalyzerPlugin(plugin, {
        ...context,
        knowledge,
      });
      knowledge = outcome.knowledge;
      results.push(outcome.result);

      if (outcome.result.status === 'failed') {
        break;
      }
    }

    return { knowledge, results };
  }

  private runAnalyzerPlugin(
    plugin: AnalyzerPlugin,
    context: PluginContext,
  ): PluginExecutionOutcome {
    return this.runPluginWithSupports(
      plugin.id,
      plugin.name,
      context,
      (knowledge) => plugin.supports(knowledge),
      () => plugin.analyze(context),
    );
  }

  private runTechnologyPlugin(
    plugin: TechnologyPlugin,
    context: PluginContext,
  ): PluginExecutionOutcome {
    return this.runPluginWithSupports(
      plugin.id,
      plugin.name,
      context,
      (knowledge) => plugin.supports(knowledge),
      () => plugin.analyze(context),
    );
  }

  private runPluginWithSupports(
    pluginId: string,
    pluginName: string,
    context: PluginContext,
    supports: (knowledge: ProjectKnowledge) => boolean,
    analyze: () => PluginResult,
  ): PluginExecutionOutcome {
    const supportOutcome = this.evaluateSupports(pluginId, pluginName, context, supports);
    if (supportOutcome !== undefined) {
      return supportOutcome;
    }

    return this.executePluginAction(pluginId, pluginName, context, analyze);
  }

  private evaluateSupports(
    pluginId: string,
    pluginName: string,
    context: PluginContext,
    supports: (knowledge: ProjectKnowledge) => boolean,
  ): PluginExecutionOutcome | undefined {
    try {
      if (!supports(context.knowledge)) {
        return {
          knowledge: context.knowledge,
          result: {
            status: 'skipped',
            message: `skipped: ${pluginName} does not support this project`,
          },
        };
      }

      return undefined;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const warning = `${pluginName} (${pluginId}) supports() threw: ${detail}`;
      context.logger.error(warning);

      return {
        knowledge: context.knowledge,
        result: createFailedPluginResult(`failed: ${pluginName}`, {
          warnings: [warning],
        }),
      };
    }
  }

  private executePluginAction(
    pluginId: string,
    pluginName: string,
    context: PluginContext,
    action: () => PluginResult,
  ): PluginExecutionOutcome {
    try {
      const result = action();
      const knowledge = this.resolveKnowledge(context.knowledge, result, context.logger);

      return { knowledge, result };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const warning = `${pluginName} (${pluginId}) threw: ${detail}`;
      context.logger.error(warning);

      return {
        knowledge: context.knowledge,
        result: createFailedPluginResult(`failed: ${pluginName}`, {
          warnings: [warning],
        }),
      };
    }
  }

  private resolveKnowledge(
    currentKnowledge: ProjectKnowledge,
    result: PluginResult,
    logger: PluginLogger,
  ): ProjectKnowledge {
    if (result.status !== 'completed') {
      return currentKnowledge;
    }

    if (result.knowledge !== undefined && result.contributions !== undefined) {
      logger.warn(
        'plugin result included both knowledge and contributions; using knowledge only.',
      );
      return result.knowledge;
    }

    if (result.knowledge !== undefined) {
      logger.warn(
        'plugin result used deprecated knowledge field; prefer PluginContributions.',
      );
      return result.knowledge;
    }

    if (result.contributions !== undefined) {
      return mergePluginContributions(currentKnowledge, result.contributions);
    }

    return currentKnowledge;
  }
}

export function createPluginManager(registry?: PluginRegistry): PluginManager {
  return new PluginManager(registry);
}
