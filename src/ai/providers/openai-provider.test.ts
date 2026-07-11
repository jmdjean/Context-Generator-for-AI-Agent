import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AI_ANALYSIS_SYSTEM_INSTRUCTION } from '../prompt-builder';
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_PROVIDER_ID,
  OpenAIProvider,
} from './openai-provider';

describe('OpenAIProvider', () => {
  it('identifies itself and matches case-insensitive ids', () => {
    const provider = new OpenAIProvider();

    assert.equal(provider.id, OPENAI_PROVIDER_ID);
    assert.equal(provider.name, 'OpenAI');
    assert.equal(provider.supports('openai'), true);
    assert.equal(provider.supports('OpenAI'), true);
    assert.equal(provider.supports('openrouter'), false);
    assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-4.1-mini');
  });

  it('posts chat completions and maps the response', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"architectureSummary":"ok"}' } }],
          model: 'gpt-4.1-mini-2025-04-14',
          usage: { prompt_tokens: 11, completion_tokens: 4, total_tokens: 15 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const provider = new OpenAIProvider({ fetchImpl });
    const response = await provider.analyze('analyze this', {
      apiKey: 'sk-test',
      model: 'gpt-4.1-mini',
      temperature: 0.5,
      maxTokens: 1_000,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer sk-test');

    const body = JSON.parse(String(calls[0].init.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature: number;
      max_tokens: number;
      response_format: { type: string };
    };
    assert.equal(body.model, 'gpt-4.1-mini');
    assert.equal(body.temperature, 0.5);
    assert.equal(body.max_tokens, 1_000);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.messages, [
      { role: 'system', content: AI_ANALYSIS_SYSTEM_INSTRUCTION },
      { role: 'user', content: 'analyze this' },
    ]);

    assert.equal(response.content, '{"architectureSummary":"ok"}');
    assert.equal(response.model, 'gpt-4.1-mini-2025-04-14');
    assert.equal(response.provider, 'openai');
    assert.deepEqual(response.usage, {
      promptTokens: 11,
      completionTokens: 4,
      totalTokens: 15,
    });
  });

  it('throws a clear error on non-OK HTTP responses', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('{"error":{"message":"bad key"}}', { status: 401 });

    const provider = new OpenAIProvider({ fetchImpl });
    await assert.rejects(
      () =>
        provider.analyze('prompt', {
          apiKey: 'bad',
          model: 'gpt-4.1-mini',
        }),
      /OpenAI request failed \(401\)/,
    );
  });

  it('throws when the response has no message content', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: {} }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const provider = new OpenAIProvider({ fetchImpl });
    await assert.rejects(
      () =>
        provider.analyze('prompt', {
          apiKey: 'sk-test',
          model: 'gpt-4.1-mini',
        }),
      /did not include message content/,
    );
  });
});
