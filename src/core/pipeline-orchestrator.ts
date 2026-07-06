import { RuntimeConfig } from '../config';
import {
  ANALYSIS_PIPELINE,
  AnalysisPipelineStep,
  PipelineStepStatus,
  RepositoryInfo,
  TechnologyProfile,
} from '../domain';
import { loadRepositoryMetadata } from '../scanner/repository-loader';
import { detectTechnologies } from '../detectors/technology-detector';
import { createDocumentationPlan } from '../docs/documentation-planner';
import { DocumentationPlan } from '../docs/documentation-plan';
import { writeDocumentation } from '../docs/documentation-writer';

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
  technologyProfile?: TechnologyProfile;
  documentationPlan?: DocumentationPlan;
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
  config: RuntimeConfig,
): Promise<PipelineExecutionResult> {
  const startedAt = new Date().toISOString();
  const errors: PipelineExecutionError[] = [];
  const steps = initializeSteps();

  let repositoryInfo: RepositoryInfo | undefined;
  let technologyProfile: TechnologyProfile | undefined;
  let documentationPlan: DocumentationPlan | undefined;

  console.log('');
  console.log('Pipeline:');

  for (let i = 0; i < ANALYSIS_PIPELINE.length; i++) {
    const domainStep = ANALYSIS_PIPELINE[i];
    const step = steps[i];

    step.status = 'running';
    step.startedAt = new Date().toISOString();

    try {
      let message: string;

      if (domainStep.name === 'Load Repository Metadata') {
        repositoryInfo = loadRepositoryMetadata(config);
        message = `loaded metadata for "${repositoryInfo.name}"`;
      } else if (domainStep.name === 'Detect Technologies') {
        if (repositoryInfo) {
          technologyProfile = detectTechnologies(repositoryInfo);
          message = `detected ${technologyProfile.languages.length} language(s)`;
        } else {
          message = await runPlaceholderStep(domainStep);
        }
      } else if (domainStep.name === 'Generate Documentation Plan') {
        if (repositoryInfo && technologyProfile) {
          documentationPlan = createDocumentationPlan(config, repositoryInfo, technologyProfile);
          message = `planned ${documentationPlan.documents.length} documents (strategy: ${documentationPlan.strategy})`;
        } else {
          message = await runPlaceholderStep(domainStep);
        }
      } else if (domainStep.name === 'Write Documentation') {
        if (repositoryInfo && technologyProfile && documentationPlan) {
          const writeResult = writeDocumentation(
            config,
            repositoryInfo,
            technologyProfile,
            documentationPlan,
          );
          console.log('');
          console.log('Documentation writer:');
          console.log(`Written: ${writeResult.writtenCount}`);
          console.log(`Skipped: ${writeResult.skippedCount}`);
          console.log(`Docs directory: ${writeResult.docsDirectoryPath}`);
          message = `written ${writeResult.writtenCount}, skipped ${writeResult.skippedCount}`;
        } else {
          message = await runPlaceholderStep(domainStep);
        }
      } else {
        message = await runPlaceholderStep(domainStep);
      }

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
    technologyProfile,
    documentationPlan,
  };
}
