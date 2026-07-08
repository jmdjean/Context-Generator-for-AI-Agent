import { RuntimeConfig } from '../config';
import { executePipeline } from './pipeline-orchestrator';
import { resolveExitCode } from './exit-codes';
import { printRunSummary } from './run-summary';

export { executePipeline };
export { resolveExitCode, EXIT_SUCCESS, EXIT_USER_ERROR, EXIT_VALIDATION_ERROR, EXIT_RUNTIME_ERROR } from './exit-codes';
export type {
  PipelineExecutionResult,
  ExecutedPipelineStep,
  PipelineExecutionError,
} from './pipeline-orchestrator';
export type { PipelineRunMetrics } from './pipeline-metrics';
export { formatRunSummary, isPipelineSuccessful } from './run-summary';

export async function run(config: RuntimeConfig): Promise<number> {
  const result = await executePipeline(config);

  printRunSummary({
    config,
    result,
  });

  return resolveExitCode(result);
}
