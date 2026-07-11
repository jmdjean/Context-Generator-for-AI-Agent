import { createOpenRouterClient, OpenRouterClient } from '../openrouter-client';
import { AI_ANALYSIS_SYSTEM_INSTRUCTION } from '../prompt-builder';
import {
  AIProvider,
  AIProviderOptions,
  AIProviderResponse,
  normalizeAiProviderId,
} from './ai-provider';

export const OPENROUTER_PROVIDER_ID = 'openrouter';

export interface OpenRouterProviderDependencies {
  /** Injected for tests. When omitted, a client is created per analyze() call from options.apiKey. */
  client?: OpenRouterClient;
  createClient?: (apiKey: string) => OpenRouterClient;
}

export class OpenRouterProvider implements AIProvider {
  readonly id = OPENROUTER_PROVIDER_ID;
  readonly name = 'OpenRouter';

  private readonly client?: OpenRouterClient;
  private readonly createClient: (apiKey: string) => OpenRouterClient;

  constructor(dependencies: OpenRouterProviderDependencies = {}) {
    this.client = dependencies.client;
    this.createClient = dependencies.createClient ?? ((apiKey) => createOpenRouterClient(apiKey));
  }

  supports(providerId: string): boolean {
    return normalizeAiProviderId(providerId) === this.id;
  }

  async analyze(prompt: string, options: AIProviderOptions): Promise<AIProviderResponse> {
    const client = this.client ?? this.createClient(options.apiKey);

    const result = await client.complete({
      model: options.model,
      messages: [
        { role: 'system', content: options.systemInstruction ?? AI_ANALYSIS_SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
    });

    return {
      content: result.content,
      model: result.model,
      provider: this.id,
      ...(result.usage !== undefined ? { usage: result.usage } : {}),
      raw: result.raw,
    };
  }
}
