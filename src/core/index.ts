import { RuntimeConfig } from '../config';

export async function run(config: RuntimeConfig): Promise<void> {
  console.log(`Target project: ${config.targetProjectPath}`);
  console.log(`Docs directory: ${config.docsDir}`);
  console.log(`OpenRouter key: ${config.openRouterApiKey ? 'detected' : 'missing'}`);

  if (!config.openRouterApiKey) {
    console.log('');
    console.warn('Warning: OPENROUTER_API_KEY was not provided. AI-powered analysis will be skipped in future steps.');
  }

  console.log('');
  console.log('Status: configuration resolved');
  console.log('');
}
