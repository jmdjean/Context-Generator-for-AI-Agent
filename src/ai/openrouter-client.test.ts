import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OpenRouterClient } from './openrouter-client';

describe('OpenRouterClient', () => {
  it('does not retry non-retryable HTTP errors', async () => {
    let attempts = 0;
    const client = new OpenRouterClient({
      apiKey: 'test-key',
      maxRetries: 2,
      timeoutMs: 5_000,
      fetchImpl: async () => {
        attempts += 1;
        return new Response('invalid key', { status: 401 });
      },
    });

    await assert.rejects(
      () =>
        client.complete({
          model: 'openai/gpt-4.1-mini',
          messages: [{ role: 'user', content: 'test' }],
        }),
      /OpenRouter request failed \(401\)/,
    );
    assert.equal(attempts, 1);
  });

  it('retries retryable HTTP errors', async () => {
    let attempts = 0;
    const client = new OpenRouterClient({
      apiKey: 'test-key',
      maxRetries: 2,
      timeoutMs: 5_000,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 3) {
          return new Response('rate limited', { status: 429 });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"architectureSummary":"ok"}' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });

    const result = await client.complete({
      model: 'openai/gpt-4.1-mini',
      messages: [{ role: 'user', content: 'test' }],
    });

    assert.equal(result.content, '{"architectureSummary":"ok"}');
    assert.equal(result.model, 'openai/gpt-4.1-mini');
    assert.equal(attempts, 3);
  });

  it('returns reported model and token usage when present in the payload', async () => {
    const client = new OpenRouterClient({
      apiKey: 'test-key',
      maxRetries: 0,
      timeoutMs: 5_000,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: 'openai/gpt-4.1-mini-2025',
            choices: [{ message: { content: '{"architectureSummary":"ok"}' } }],
            usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });

    const result = await client.complete({
      model: 'openai/gpt-4.1-mini',
      messages: [{ role: 'user', content: 'test' }],
    });

    assert.equal(result.model, 'openai/gpt-4.1-mini-2025');
    assert.deepEqual(result.usage, {
      promptTokens: 120,
      completionTokens: 40,
      totalTokens: 160,
    });
  });

  it('aborts hung requests after the configured timeout', async () => {
    const client = new OpenRouterClient({
      apiKey: 'test-key',
      maxRetries: 0,
      timeoutMs: 50,
      fetchImpl: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }
        }),
    });

    await assert.rejects(
      () =>
        client.complete({
          model: 'openai/gpt-4.1-mini',
          messages: [{ role: 'user', content: 'test' }],
        }),
      /timed out/i,
    );
  });
});
