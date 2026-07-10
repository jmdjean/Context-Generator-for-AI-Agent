import { enrichProjectKnowledgeWithConventions } from '../../analyzers/convention-analyzer';
import { AnalyzerPlugin } from '../analyzer-plugin';
import { createCompletedPluginResult } from '../plugin-result';

export const CONVENTION_ANALYZER_PLUGIN_ID = 'builtin.convention-analyzer';

export const conventionAnalyzerPlugin: AnalyzerPlugin = {
  id: CONVENTION_ANALYZER_PLUGIN_ID,
  name: 'Convention Analyzer',
  description:
    'Detects project conventions from the PKM, technologies, modules, and safe config file reads.',
  version: '1.0.0',
  kind: 'analyzer',

  supports(): boolean {
    return true;
  },

  analyze(context) {
    const { result } = enrichProjectKnowledgeWithConventions(context.knowledge, {
      boundary: context.boundary,
    });

    return createCompletedPluginResult(
      `detected ${result.totalConventions} convention(s), ${result.highConfidenceConventions} high confidence`,
      {
        contributions: {
          conventions: result.conventions,
        },
        metrics: {
          conventionsDetected: result.totalConventions,
          highConfidenceConventions: result.highConfidenceConventions,
        },
      },
    );
  },
};
