import { RuntimeConfig } from '../config';
import { executePipeline } from './pipeline-orchestrator';

export { executePipeline };
export type {
  PipelineExecutionResult,
  ExecutedPipelineStep,
  PipelineExecutionError,
} from './pipeline-orchestrator';

export async function run(config: RuntimeConfig): Promise<void> {
  console.log(`Target project: ${config.targetProjectPath}`);
  console.log(`Docs directory: ${config.docsDir}`);
  console.log(`OpenRouter key: ${config.openRouterApiKey ? 'detected' : 'missing'}`);

  const result = await executePipeline(config);

  console.log('');
  if (result.success) {
    console.log('Status: pipeline skeleton completed');
  } else {
    console.log('Status: pipeline completed with errors');
    for (const error of result.errors) {
      console.error(`  Error in "${error.stepName}": ${error.message}`);
    }
  }
  console.log('');
}
