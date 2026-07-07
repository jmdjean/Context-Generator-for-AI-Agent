import { RuntimeConfig } from '../config';
import { ANALYSIS_PIPELINE, PipelineStepStatus } from '../domain';
import { PipelineContext, runStepHandler } from './pipeline-handlers';

export interface ExecutedPipelineStep {
  name: string;
  description: string;
  status: PipelineStepStatus;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
}

export interface PipelineExecutionError {
  stepName: string;
  message: string;
  cause?: unknown;
}

export interface PipelineExecutionResult {
  success: boolean;
  steps: ExecutedPipelineStep[];
  startedAt: string;
  finishedAt: string;
  errors: PipelineExecutionError[];
  projectKnowledge?: PipelineContext['projectKnowledge'];
}

function initializeSteps(): ExecutedPipelineStep[] {
  return ANALYSIS_PIPELINE.map((step) => ({
    name: step.name,
    description: step.description,
    status: 'pending' as PipelineStepStatus,
  }));
}

function printStep(step: ExecutedPipelineStep): void {
  const icon =
    step.status === 'completed' ? '✓' : step.status === 'skipped' ? '○' : '✗';
  console.log(`${icon} ${step.name}`);
}

function markRemainingStepsSkipped(
  steps: ExecutedPipelineStep[],
  startIndex: number,
): void {
  for (let i = startIndex; i < steps.length; i++) {
    steps[i].status = 'skipped';
    steps[i].message = 'skipped: previous step failed';
  }
}

export async function executePipeline(
  config: RuntimeConfig,
): Promise<PipelineExecutionResult> {
  const startedAt = new Date().toISOString();
  const errors: PipelineExecutionError[] = [];
  const steps = initializeSteps();
  const context: PipelineContext = { config };

  console.log('');
  console.log('Pipeline:');

  for (let i = 0; i < ANALYSIS_PIPELINE.length; i++) {
    const domainStep = ANALYSIS_PIPELINE[i];
    const step = steps[i];

    step.status = 'running';
    step.startedAt = new Date().toISOString();

    try {
      const result = await runStepHandler(context, domainStep);

      step.status = result.status;
      step.finishedAt = new Date().toISOString();
      step.message = result.message;
    } catch (err) {
      step.status = 'failed';
      step.finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      step.message = message;
      errors.push({ stepName: step.name, message, cause: err });
      printStep(step);
      markRemainingStepsSkipped(steps, i + 1);
      break;
    }

    printStep(step);
  }

  return {
    success: errors.length === 0,
    steps,
    startedAt,
    finishedAt: new Date().toISOString(),
    errors,
    projectKnowledge: context.projectKnowledge,
  };
}
