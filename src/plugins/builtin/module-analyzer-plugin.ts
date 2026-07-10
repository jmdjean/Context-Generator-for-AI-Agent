import { enrichProjectKnowledgeWithModuleAnalysis } from '../../analyzers/module-analyzer';
import { AnalyzerPlugin } from '../analyzer-plugin';
import { createCompletedPluginResult } from '../plugin-result';

export const MODULE_ANALYZER_PLUGIN_ID = 'builtin.module-analyzer';

export const moduleAnalyzerPlugin: AnalyzerPlugin = {
  id: MODULE_ANALYZER_PLUGIN_ID,
  name: 'Module Analyzer',
  description:
    'Detects meaningful project modules from the repository tree and folder knowledge.',
  version: '1.0.0',
  kind: 'analyzer',

  supports(): boolean {
    return true;
  },

  analyze(context) {
    const { result } = enrichProjectKnowledgeWithModuleAnalysis(context.knowledge);

    return createCompletedPluginResult(
      `discovered ${result.totalModules} module(s), ${result.highConfidenceModules} high confidence`,
      {
        contributions: {
          modules: result.modules,
        },
        metrics: {
          modulesDiscovered: result.totalModules,
          highConfidenceModules: result.highConfidenceModules,
        },
      },
    );
  },
};
