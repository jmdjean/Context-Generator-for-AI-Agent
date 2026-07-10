import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OpenRouterClient } from '../openrouter-client';
import { AI_ANALYSIS_SYSTEM_INSTRUCTION } from '../prompt-builder';
import { AIProvider, normalizeAiProviderId } from './ai-provider';
import { OpenRouterProvider, OPENROUTER_PROVIDER_ID } from './openrouter-provider';
import {
  createAiProvider,
  DEFAULT_AI_PROVIDER_ID,
  isSupportedAiProviderId,
  listSupportedAiProviderIds,
} from './provider-factory';
import { AIProviderRegistry, createDefaultAiProviderRegistry } from './provider-registry';

describe('normalizeAiProviderId', () => {
  it('trims and lowercases provider ids', () => {
    assert.equal(normalizeAiProviderId('  OpenRouter '), 'openrouter');
  });
});

describe('OpenRouterProvider', () => {
  it('identifies itself and matches case-insensitive ids', () => {
    const provider = new OpenRouterProvider();

    assert.equal(provider.id, OPENROUTER_PROVIDER_ID);
    assert.equal(provider.name, 'OpenRouter');
    assert.equal(provider.supports('openrouter'), true);
    assert.equal(provider.supports('OPENROUTER'), true);
    assert.equal(provider.supports('openai'), false);
  });

  it('sends the system instruction plus the prompt and maps the client result', async () => {
    const requests: unknown[] = [];
    const fakeClient = {
      complete: async (request: unknown) => {
        requests.push(request);
        return {
          content: '{"architectureSummary":"ok"}',
          model: 'openai/gpt-4.1-mini-2025',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          raw: { id: 'resp-1' },
        };
      },
    };
    const provider = new OpenRouterProvider({ client: fakeClient as unknown as OpenRouterClient });

    const response = await provider.analyze('analyze this PKM summary', {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
    });

    assert.deepEqual(requests[0], {
      model: 'openai/gpt-4.1-mini',
      messages: [
        { role: 'system', content: AI_ANALYSIS_SYSTEM_INSTRUCTION },
        { role: 'user', content: 'analyze this PKM summary' },
      ],
    });
    assert.equal(response.content, '{"architectureSummary":"ok"}');
    assert.equal(response.model, 'openai/gpt-4.1-mini-2025');
    assert.equal(response.provider, 'openrouter');
    assert.deepEqual(response.usage, { promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    assert.deepEqual(response.raw, { id: 'resp-1' });
  });

  it('forwards temperature and maxTokens to the client when provided', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fakeClient = {
      complete: async (request: Record<string, unknown>) => {
        requests.push(request);
        return { content: 'ok', model: 'm', raw: {} };
      },
    };
    const provider = new OpenRouterProvider({ client: fakeClient as unknown as OpenRouterClient });

    await provider.analyze('prompt', {
      apiKey: 'test-key',
      model: 'openai/gpt-4.1-mini',
      temperature: 0.7,
      maxTokens: 2_000,
    });

    assert.equal(requests[0]?.['temperature'], 0.7);
    assert.equal(requests[0]?.['maxTokens'], 2_000);
  });
});

describe('AIProviderRegistry', () => {
  it('resolves registered providers case-insensitively', () => {
    const registry = createDefaultAiProviderRegistry();

    assert.equal(registry.resolve('openrouter')?.id, 'openrouter');
    assert.equal(registry.resolve(' OpenRouter ')?.id, 'openrouter');
    assert.equal(registry.resolve('openai'), undefined);
  });

  it('rejects duplicate provider registrations', () => {
    const registry = new AIProviderRegistry();
    registry.register(new OpenRouterProvider());

    assert.throws(
      () => registry.register(new OpenRouterProvider()),
      /already registered: openrouter/,
    );
  });

  it('accepts additional custom providers', () => {
    const registry = createDefaultAiProviderRegistry();
    const custom: AIProvider = {
      id: 'custom',
      name: 'Custom',
      supports: (providerId) => providerId === 'custom',
      analyze: async () => ({ content: '{}', model: 'm', provider: 'custom' }),
    };

    registry.register(custom);

    assert.deepEqual(registry.ids(), ['openrouter', 'custom']);
    assert.equal(registry.resolve('custom'), custom);
  });
});

describe('provider factory', () => {
  it('defaults to the OpenRouter provider', () => {
    assert.equal(DEFAULT_AI_PROVIDER_ID, 'openrouter');
    assert.equal(createAiProvider().id, 'openrouter');
    assert.equal(createAiProvider('openrouter').id, 'openrouter');
  });

  it('throws a clear error for unsupported providers', () => {
    assert.throws(
      () => createAiProvider('gemini'),
      /Unsupported AI provider: gemini\. Supported providers: openrouter\./,
    );
  });

  it('reports supported provider ids', () => {
    assert.deepEqual(listSupportedAiProviderIds(), ['openrouter']);
    assert.equal(isSupportedAiProviderId('openrouter'), true);
    assert.equal(isSupportedAiProviderId('OPENROUTER'), true);
    assert.equal(isSupportedAiProviderId('ollama'), false);
  });
});
