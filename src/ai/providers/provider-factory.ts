import { AIProvider, normalizeAiProviderId } from './ai-provider';
import { OPENROUTER_PROVIDER_ID } from './openrouter-provider';
import { AIProviderRegistry, createDefaultAiProviderRegistry } from './provider-registry';

export const DEFAULT_AI_PROVIDER_ID = OPENROUTER_PROVIDER_ID;

export function listSupportedAiProviderIds(
  registry: AIProviderRegistry = createDefaultAiProviderRegistry(),
): string[] {
  return registry.ids();
}

export function isSupportedAiProviderId(
  providerId: string,
  registry: AIProviderRegistry = createDefaultAiProviderRegistry(),
): boolean {
  return registry.resolve(providerId) !== undefined;
}

export function createAiProvider(
  providerId: string = DEFAULT_AI_PROVIDER_ID,
  registry: AIProviderRegistry = createDefaultAiProviderRegistry(),
): AIProvider {
  const normalized = normalizeAiProviderId(providerId);
  const provider = registry.resolve(normalized);

  if (provider === undefined) {
    throw new Error(
      `Unsupported AI provider: ${providerId}. Supported providers: ${registry.ids().join(', ')}.`,
    );
  }

  return provider;
}
