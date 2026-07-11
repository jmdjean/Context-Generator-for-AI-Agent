import { RuntimeConfig } from '../config';
import { ANALYSIS_PIPELINE, PipelineStepStatus } from '../domain';
import { formatErrorMessage } from '../utils/error-format';
import { createEmptyPipelineMetrics, PipelineRunMetrics } from './pipeline-metrics';
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
  metrics: PipelineRunMetrics;
  projectKnowledge?: PipelineContext['projectKnowledge'];
}

export interface PipelineProgressEvent {
  stepIndex: number;
  stepName: string;
  status: 'started' | 'completed' | 'skipped' | 'failed';
}

export interface ExecutePipelineOptions {
  onProgress?: (event: PipelineProgressEvent) => void;
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

function emitProgress(
  onProgress: ExecutePipelineOptions['onProgress'],
  event: PipelineProgressEvent,
): void {
  onProgress?.(event);
}

function markRemainingStepsSkipped(
  steps: ExecutedPipelineStep[],
  startIndex: number,
  onProgress: ExecutePipelineOptions['onProgress'],
): void {
  for (let i = startIndex; i < steps.length; i++) {
    steps[i].status = 'skipped';
    steps[i].message = 'skipped: previous step failed';
    emitProgress(onProgress, {
      stepIndex: i,
      stepName: steps[i].name,
      status: 'skipped',
    });
  }
}

export async function executePipeline(
  config: RuntimeConfig,
  options?: ExecutePipelineOptions,
): Promise<PipelineExecutionResult> {
  const onProgress = options?.onProgress;
  const startedAt = new Date().toISOString();
  const errors: PipelineExecutionError[] = [];
  const steps = initializeSteps();
  const context: PipelineContext = {
    config,
    metrics: createEmptyPipelineMetrics(),
  };

  console.log('Pipeline:');

  for (let i = 0; i < ANALYSIS_PIPELINE.length; i++) {
    const domainStep = ANALYSIS_PIPELINE[i];
    const step = steps[i];

    step.status = 'running';
    step.startedAt = new Date().toISOString();
    emitProgress(onProgress, {
      stepIndex: i,
      stepName: step.name,
      status: 'started',
    });

    try {
      const result = await runStepHandler(context, domainStep);

      step.finishedAt = new Date().toISOString();
      step.message = result.message;

      if (result.status === 'failed') {
        step.status = 'failed';
        errors.push({ stepName: step.name, message: result.message });
        printStep(step);
        emitProgress(onProgress, {
          stepIndex: i,
          stepName: step.name,
          status: 'failed',
        });
        markRemainingStepsSkipped(steps, i + 1, onProgress);
        break;
      }

      step.status = result.status;
    } catch (err) {
      step.status = 'failed';
      step.finishedAt = new Date().toISOString();
      const message = formatErrorMessage(err);
      step.message = message;
      errors.push({ stepName: step.name, message, cause: err });
      printStep(step);
      emitProgress(onProgress, {
        stepIndex: i,
        stepName: step.name,
        status: 'failed',
      });
      markRemainingStepsSkipped(steps, i + 1, onProgress);
      break;
    }

    printStep(step);
    emitProgress(onProgress, {
      stepIndex: i,
      stepName: step.name,
      status: step.status === 'skipped' ? 'skipped' : 'completed',
    });
  }

  return {
    success: errors.length === 0,
    steps,
    startedAt,
    finishedAt: new Date().toISOString(),
    errors,
    metrics: context.metrics,
    projectKnowledge: context.projectKnowledge,
  };
}
