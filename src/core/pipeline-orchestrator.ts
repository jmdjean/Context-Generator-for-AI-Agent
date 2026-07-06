import { RuntimeConfig } from '../config';
import { ANALYSIS_PIPELINE, AnalysisPipelineStep, PipelineStepStatus } from '../domain';

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
}

function initializeSteps(): ExecutedPipelineStep[] {
  return ANALYSIS_PIPELINE.map((step) => ({
    name: step.name,
    description: step.description,
    status: 'pending' as PipelineStepStatus,
  }));
}

// Placeholder — replace with a real handler when implementing this step.
async function runPlaceholderStep(_step: AnalysisPipelineStep): Promise<string> {
  return 'placeholder: ready for implementation';
}

function printStep(step: ExecutedPipelineStep): void {
  const icon = step.status === 'completed' ? '✓' : '✗';
  console.log(`${icon} ${step.name}`);
}

export async function executePipeline(
  _config: RuntimeConfig,
): Promise<PipelineExecutionResult> {
  const startedAt = new Date().toISOString();
  const errors: PipelineExecutionError[] = [];
  const steps = initializeSteps();

  console.log('');
  console.log('Pipeline:');

  for (let i = 0; i < ANALYSIS_PIPELINE.length; i++) {
    const domainStep = ANALYSIS_PIPELINE[i];
    const step = steps[i];

    step.status = 'running';
    step.startedAt = new Date().toISOString();

    try {
      const message = await runPlaceholderStep(domainStep);
      step.status = 'completed';
      step.finishedAt = new Date().toISOString();
      step.message = message;
    } catch (err) {
      step.status = 'failed';
      step.finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      step.message = message;
      errors.push({ stepName: step.name, message, cause: err });
    }

    printStep(step);
  }

  return {
    success: errors.length === 0,
    steps,
    startedAt,
    finishedAt: new Date().toISOString(),
    errors,
  };
}
