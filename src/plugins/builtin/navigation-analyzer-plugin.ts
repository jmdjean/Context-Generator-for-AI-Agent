import { enrichProjectKnowledgeWithNavigationMap } from '../../analyzers/navigation-map-analyzer';
import { AnalyzerPlugin } from '../analyzer-plugin';
import { createCompletedPluginResult } from '../plugin-result';

export const NAVIGATION_ANALYZER_PLUGIN_ID = 'builtin.navigation-analyzer';

export const navigationAnalyzerPlugin: AnalyzerPlugin = {
  id: NAVIGATION_ANALYZER_PLUGIN_ID,
  name: 'Navigation Analyzer',
  description:
    'Builds a deterministic navigation map that tells AI agents which knowledge sections to read per task type.',
  version: '1.0.0',
  kind: 'analyzer',

  supports(): boolean {
    return true;
  },

  analyze(context) {
    const { result } = enrichProjectKnowledgeWithNavigationMap(context.knowledge);

    return createCompletedPluginResult(
      `built navigation map with ${result.totalEntries} entr(ies), ${result.highConfidenceEntries} high confidence`,
      {
        contributions: {
          navigationMap: result.navigationMap,
        },
        metrics: {
          navigationEntries: result.totalEntries,
          highConfidenceEntries: result.highConfidenceEntries,
        },
      },
    );
  },
};
