import { RuntimeConfig } from '../config';
import { executePipeline, PipelineExecutionResult } from './pipeline-orchestrator';
import { formatRunSummary } from './run-summary';

export { executePipeline };
export { formatRunSummary } from './run-summary';
export type {
  PipelineExecutionResult,
  ExecutedPipelineStep,
  PipelineExecutionError,
} from './pipeline-orchestrator';

export async function run(config: RuntimeConfig): Promise<PipelineExecutionResult> {
  console.log(`Target project: ${config.targetProjectPath}`);
  console.log(`Docs directory: ${config.docsDir}`);

  const result = await executePipeline(config);

  console.log('');
  console.log(formatRunSummary(config, result));
  console.log('');

  return result;
}
