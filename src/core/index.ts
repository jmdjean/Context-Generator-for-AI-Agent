import { RuntimeConfig } from '../config';
import { TechnologyProfile } from '../domain';
import { DocumentationPlan } from '../docs/documentation-plan';
import { executePipeline } from './pipeline-orchestrator';

export { executePipeline };
export type {
  PipelineExecutionResult,
  ExecutedPipelineStep,
  PipelineExecutionError,
} from './pipeline-orchestrator';

function printTechnologyProfile(profile: TechnologyProfile): void {
  console.log('');
  console.log('Technology profile:');

  const sections: [string, string[]][] = [
    ['Languages', profile.languages],
    ['Frameworks', profile.frameworks],
    ['Package managers', profile.packageManagers],
    ['Tooling', profile.tooling],
  ];

  const nonEmpty = sections.filter(([, items]) => items.length > 0);

  for (let i = 0; i < nonEmpty.length; i++) {
    const [label, items] = nonEmpty[i];
    console.log(`${label}:`);
    for (const item of items) {
      console.log(`- ${item}`);
    }
    if (i < nonEmpty.length - 1) {
      console.log('');
    }
  }
}

function printDocumentationPlan(plan: DocumentationPlan): void {
  console.log('');
  console.log('Documentation plan:');

  const required = plan.documents.filter(
    (d) => d.source === 'core' || d.source === 'agent',
  );
  const technology = plan.documents.filter((d) => d.source === 'technology');

  if (required.length > 0) {
    console.log('Required documents:');
    for (const doc of required) {
      console.log(`- ${doc.relativePath}`);
    }
  }

  if (technology.length > 0) {
    console.log('');
    console.log('Technology documents:');
    for (const doc of technology) {
      console.log(`- ${doc.relativePath}`);
    }
  }
}

export async function run(config: RuntimeConfig): Promise<void> {
  console.log(`Target project: ${config.targetProjectPath}`);
  console.log(`Docs directory: ${config.docsDir}`);
  console.log(`OpenRouter key: ${config.openRouterApiKey ? 'detected' : 'missing'}`);

  const result = await executePipeline(config);

  if (result.technologyProfile) {
    printTechnologyProfile(result.technologyProfile);
  }

  if (result.documentationPlan) {
    printDocumentationPlan(result.documentationPlan);
  }

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
