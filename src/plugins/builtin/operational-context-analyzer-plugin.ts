import { enrichProjectKnowledgeWithOperationalContext } from '../../analyzers/operational-context-analyzer';
import { AnalyzerPlugin } from '../analyzer-plugin';
import { createCompletedPluginResult } from '../plugin-result';

export const OPERATIONAL_CONTEXT_ANALYZER_PLUGIN_ID = 'builtin.operational-context-analyzer';

export const operationalContextAnalyzerPlugin: AnalyzerPlugin = {
  id: OPERATIONAL_CONTEXT_ANALYZER_PLUGIN_ID,
  name: 'Operational Context Analyzer',
  description:
    'Extracts stack-agnostic purpose, run commands, and env var keys from allowlisted config and README files.',
  version: '1.0.0',
  kind: 'analyzer',

  supports(): boolean {
    return true;
  },

  analyze(context) {
    const { result } = enrichProjectKnowledgeWithOperationalContext(context.knowledge, {
      boundary: context.boundary,
    });

    if (result.operationalContext === undefined) {
      return createCompletedPluginResult('no operational context signals detected', {
        metrics: {
          purposeFound: 0,
          runCommandsDetected: 0,
          envVarsDetected: 0,
        },
      });
    }

    return createCompletedPluginResult(
      `operational context: purpose=${result.purposeFound ? 'yes' : 'no'}, ` +
        `${result.runCommandCount} run command(s), ${result.envVarCount} env key(s)`,
      {
        contributions: {
          operationalContext: result.operationalContext,
        },
        metrics: {
          purposeFound: result.purposeFound ? 1 : 0,
          runCommandsDetected: result.runCommandCount,
          envVarsDetected: result.envVarCount,
        },
      },
    );
  },
};
