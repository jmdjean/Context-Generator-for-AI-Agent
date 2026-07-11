import { DEFAULT_AI_MODEL } from '../../config/constants';
import { DEFAULT_OPENAI_MODEL } from '../../ai/providers/openai-provider';
import { DEFAULT_AI_PROVIDER_ID } from '../../ai/providers/provider-factory';
import { createDefaultAiProviderRegistry } from '../../ai/providers/provider-registry';
import type { JsonHttpResult } from './run';

export interface ProviderListItem {
  readonly id: string;
  readonly name: string;
  readonly requiresApiKey: boolean;
  readonly defaultModel: string;
}

export interface ProvidersResponse {
  readonly providers: ProviderListItem[];
  readonly defaultProvider: string;
  readonly defaultModel: string;
}

function defaultModelForProvider(providerId: string): string {
  if (providerId === 'openai') {
    return DEFAULT_OPENAI_MODEL;
  }
  return DEFAULT_AI_MODEL;
}

/**
 * Handles GET /api/providers — lists registered AI providers for the UI.
 * Built-in providers require an API key.
 */
export function handleGetProviders(): JsonHttpResult {
  const registry = createDefaultAiProviderRegistry();
  const body: ProvidersResponse = {
    providers: registry.list().map((provider) => ({
      id: provider.id,
      name: provider.name,
      requiresApiKey: true,
      defaultModel: defaultModelForProvider(provider.id),
    })),
    defaultProvider: DEFAULT_AI_PROVIDER_ID,
    defaultModel: DEFAULT_AI_MODEL,
  };

  return { status: 200, body };
}
