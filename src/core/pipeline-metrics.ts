import { DocumentationValidationResult } from '../docs/documentation-validator';
import { DocumentationWriteResult } from '../docs/documentation-writer';
import { AgentExportTarget } from '../knowledge';

export interface AgentExportMetrics {
  enabled: boolean;
  enabledTargets: AgentExportTarget[];
  filesWritten: number;
  filesSkipped: number;
  warnings: string[];
}

export interface PipelineRunMetrics {
  filesScanned: number;
  foldersAnalyzed: number;
  modulesDiscovered: number;
  dependencyEdges: number;
  conventionsDetected: number;
  navigationEntries: number;
  aiInsightsGenerated: boolean;
  aiInsightsAttempted: boolean;
  repositoryTreeGenerated: boolean;
  knowledgeFilesPersisted: number;
  documentationWrite?: DocumentationWriteResult;
  validation?: DocumentationValidationResult;
  agentExports?: AgentExportMetrics;
}

export function createEmptyPipelineMetrics(): PipelineRunMetrics {
  return {
    filesScanned: 0,
    foldersAnalyzed: 0,
    modulesDiscovered: 0,
    dependencyEdges: 0,
    conventionsDetected: 0,
    navigationEntries: 0,
    aiInsightsGenerated: false,
    aiInsightsAttempted: false,
    repositoryTreeGenerated: false,
    knowledgeFilesPersisted: 0,
  };
}
