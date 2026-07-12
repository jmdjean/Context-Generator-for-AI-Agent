import { AnalyzerPlugin } from '../analyzer-plugin';
import { conventionAnalyzerPlugin } from './convention-analyzer-plugin';
import { dependencyAnalyzerPlugin } from './dependency-analyzer-plugin';
import { folderAnalyzerPlugin } from './folder-analyzer-plugin';
import { moduleAnalyzerPlugin } from './module-analyzer-plugin';
import { navigationAnalyzerPlugin } from './navigation-analyzer-plugin';
import { operationalContextAnalyzerPlugin } from './operational-context-analyzer-plugin';

export const BUILTIN_ANALYZER_PLUGIN_ORDER: ReadonlyArray<string> = [
  folderAnalyzerPlugin.id,
  moduleAnalyzerPlugin.id,
  operationalContextAnalyzerPlugin.id,
  dependencyAnalyzerPlugin.id,
  conventionAnalyzerPlugin.id,
  navigationAnalyzerPlugin.id,
];

export const BUILTIN_ANALYZER_PLUGINS: ReadonlyArray<AnalyzerPlugin> = [
  folderAnalyzerPlugin,
  moduleAnalyzerPlugin,
  operationalContextAnalyzerPlugin,
  dependencyAnalyzerPlugin,
  conventionAnalyzerPlugin,
  navigationAnalyzerPlugin,
];

export {
  CONVENTION_ANALYZER_PLUGIN_ID,
} from './convention-analyzer-plugin';
export {
  DEPENDENCY_ANALYZER_PLUGIN_ID,
} from './dependency-analyzer-plugin';
export {
  FOLDER_ANALYZER_PLUGIN_ID,
} from './folder-analyzer-plugin';
export {
  MODULE_ANALYZER_PLUGIN_ID,
} from './module-analyzer-plugin';
export {
  NAVIGATION_ANALYZER_PLUGIN_ID,
} from './navigation-analyzer-plugin';
export {
  OPERATIONAL_CONTEXT_ANALYZER_PLUGIN_ID,
} from './operational-context-analyzer-plugin';
