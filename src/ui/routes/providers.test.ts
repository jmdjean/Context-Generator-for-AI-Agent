import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleGetProviders } from './providers';

describe('handleGetProviders', () => {
  it('returns registry providers with defaults', () => {
    const result = handleGetProviders();
    assert.equal(result.status, 200);
    const body = result.body as {
      providers: Array<{
        id: string;
        name: string;
        requiresApiKey: boolean;
        defaultModel: string;
      }>;
      defaultProvider: string;
      defaultModel: string;
    };
    assert.ok(body.providers.length >= 2);
    assert.equal(body.providers[0].id, 'openrouter');
    assert.equal(body.providers[0].name, 'OpenRouter');
    assert.equal(body.providers[0].requiresApiKey, true);
    assert.equal(body.providers[0].defaultModel, 'openai/gpt-4.1-mini');
    const openai = body.providers.find((provider) => provider.id === 'openai');
    assert.ok(openai);
    assert.equal(openai.name, 'OpenAI');
    assert.equal(openai.requiresApiKey, true);
    assert.equal(openai.defaultModel, 'gpt-4.1-mini');
    assert.equal(body.defaultProvider, 'openrouter');
    assert.equal(body.defaultModel, 'openai/gpt-4.1-mini');
  });
});
