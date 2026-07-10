import { enrichProjectKnowledgeWithDependencyGraph } from '../../analyzers/dependency-graph-analyzer';
import { AnalyzerPlugin } from '../analyzer-plugin';
import { createCompletedPluginResult } from '../plugin-result';

export const DEPENDENCY_ANALYZER_PLUGIN_ID = 'builtin.dependency-analyzer';

export const dependencyAnalyzerPlugin: AnalyzerPlugin = {
  id: DEPENDENCY_ANALYZER_PLUGIN_ID,
  name: 'Dependency Analyzer',
  description:
    'Detects import relationships between discovered modules using lightweight file import parsing.',
  version: '1.0.0',
  kind: 'analyzer',

  supports(): boolean {
    return true;
  },

  analyze(context) {
    const { result } = enrichProjectKnowledgeWithDependencyGraph(context.knowledge, {
      boundary: context.boundary,
    });

    return createCompletedPluginResult(
      `built dependency graph with ${result.totalNodes} node(s) and ${result.totalEdges} edge(s)`,
      {
        contributions: {
          dependencyGraph: result.dependencyGraph,
        },
        metrics: {
          dependencyEdges: result.totalEdges,
          dependencyNodes: result.totalNodes,
        },
      },
    );
  },
};
