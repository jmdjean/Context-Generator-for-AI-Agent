import {
  enrichProjectKnowledgeWithFolderAnalysis,
} from '../../analyzers/folder-analyzer';
import { AnalyzerPlugin } from '../analyzer-plugin';
import { createCompletedPluginResult } from '../plugin-result';

export const FOLDER_ANALYZER_PLUGIN_ID = 'builtin.folder-analyzer';

export const folderAnalyzerPlugin: AnalyzerPlugin = {
  id: FOLDER_ANALYZER_PLUGIN_ID,
  name: 'Folder Analyzer',
  description:
    'Walks the repository tree from the PKM and produces deterministic folder-level knowledge.',
  version: '1.0.0',
  kind: 'analyzer',

  supports(): boolean {
    return true;
  },

  analyze(context) {
    const { result } = enrichProjectKnowledgeWithFolderAnalysis(context.knowledge);

    return createCompletedPluginResult(
      `analyzed ${result.totalFolders} folder(s), ${result.documentableFolders} documentable`,
      {
        contributions: {
          folderContexts: result.folders,
        },
        metrics: {
          foldersAnalyzed: result.totalFolders,
          documentableFolders: result.documentableFolders,
          ignoredFolders: result.ignoredFolders,
        },
      },
    );
  },
};
