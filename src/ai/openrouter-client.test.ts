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

    const content = await client.complete({
      model: 'openai/gpt-4.1-mini',
      messages: [{ role: 'user', content: 'test' }],
    });

    assert.equal(content, '{"architectureSummary":"ok"}');
    assert.equal(attempts, 3);
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
