import { RuntimeConfig } from '../config';
import {
  getDocsDir,
  getDocumentationPlan,
  getProjectRoot,
  isAnalysisComplete,
  ProjectKnowledge,
} from '../knowledge';import { executePipeline } from './pipeline-orchestrator';

export { executePipeline };
export type {
  PipelineExecutionResult,
  ExecutedPipelineStep,
  PipelineExecutionError,
} from './pipeline-orchestrator';

function printProjectKnowledge(knowledge: ProjectKnowledge): void {
  const { metadata, technologies } = knowledge;
  const documentationPlan = getDocumentationPlan(knowledge);

  console.log('');
  console.log('Project Knowledge Model:');
  console.log(`Project: ${metadata.projectName}`);
  console.log(`Schema: ${metadata.schemaVersion}`);
  console.log(`Generated: ${metadata.generatedAt}`);
  console.log(`Docs directory: ${getDocsDir(knowledge)}`);
  console.log(`Root path: ${getProjectRoot(knowledge)}`);
  const technologySections: [string, string[]][] = [
    ['Languages', technologies.languages],
    ['Frameworks', technologies.frameworks],
    ['Package managers', technologies.packageManagers],
    ['Tooling', technologies.tooling],
  ];

  const nonEmptyTechnology = technologySections.filter(([, items]) => items.length > 0);

  if (nonEmptyTechnology.length > 0) {
    console.log('');
    console.log('Technologies:');
    for (let i = 0; i < nonEmptyTechnology.length; i++) {
      const [label, items] = nonEmptyTechnology[i];
      console.log(`${label}:`);
      for (const item of items) {
        console.log(`- ${item}`);
      }
      if (i < nonEmptyTechnology.length - 1) {
        console.log('');
      }
    }
  }

  const requiredDocuments = documentationPlan.documents.filter(
    (document) => document.source === 'core' || document.source === 'agent',
  );
  const technologyDocuments = documentationPlan.documents.filter(
    (document) => document.source === 'technology',
  );

  console.log('');
  console.log('Documentation plan:');
  console.log(`Strategy: ${documentationPlan.strategy}`);
  if (requiredDocuments.length > 0) {
    console.log('');
    console.log('Required documents:');
    for (const document of requiredDocuments) {
      console.log(`- ${document.relativePath}`);
    }
  }

  if (technologyDocuments.length > 0) {
    console.log('');
    console.log('Technology documents:');
    for (const document of technologyDocuments) {
      console.log(`- ${document.relativePath}`);
    }
  }

  console.log(`Analysis: ${isAnalysisComplete(knowledge) ? 'complete' : knowledge.analysis.status}`);}

export async function run(config: RuntimeConfig): Promise<void> {
  console.log(`Target project: ${config.targetProjectPath}`);
  console.log(`Docs directory: ${config.docsDir}`);
  console.log(`OpenRouter key: ${config.openRouterApiKey ? 'detected' : 'missing'}`);

  const result = await executePipeline(config);

  if (result.projectKnowledge) {
    printProjectKnowledge(result.projectKnowledge);
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
