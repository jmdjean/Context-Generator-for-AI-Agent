import { AIProvider, normalizeAiProviderId } from './ai-provider';
import { OpenAIProvider } from './openai-provider';
import { OpenRouterProvider } from './openrouter-provider';

export class AIProviderRegistry {
  private readonly providers: AIProvider[] = [];

  register(provider: AIProvider): void {
    if (this.providers.some((existing) => existing.id === provider.id)) {
      throw new Error(`AI provider already registered: ${provider.id}`);
    }
    this.providers.push(provider);
  }

  resolve(providerId: string): AIProvider | undefined {
    const normalized = normalizeAiProviderId(providerId);
    return this.providers.find((provider) => provider.supports(normalized));
  }

  list(): readonly AIProvider[] {
    return this.providers;
  }

  ids(): string[] {
    return this.providers.map((provider) => provider.id);
  }
}

/**
 * Built-in providers. Future backends (Anthropic, Gemini, Azure OpenAI,
 * Ollama, local models) register here — nothing else changes.
 */
export function createDefaultAiProviderRegistry(): AIProviderRegistry {
  const registry = new AIProviderRegistry();
  registry.register(new OpenRouterProvider());
  registry.register(new OpenAIProvider());
  return registry;
}
