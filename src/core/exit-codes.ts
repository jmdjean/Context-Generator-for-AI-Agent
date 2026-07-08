import { PipelineExecutionResult } from './pipeline-orchestrator';

export const EXIT_SUCCESS = 0;
export const EXIT_USER_ERROR = 1;
export const EXIT_VALIDATION_ERROR = 2;
export const EXIT_RUNTIME_ERROR = 3;

export function resolveExitCode(result: PipelineExecutionResult): number {
  if (result.success) {
    return EXIT_SUCCESS;
  }

  const validationFailed =
    result.metrics.validation?.status === 'failed' ||
    result.errors.some((error) => error.stepName === 'Validate Documentation');

  if (validationFailed) {
    return EXIT_VALIDATION_ERROR;
  }

  return EXIT_RUNTIME_ERROR;
}
