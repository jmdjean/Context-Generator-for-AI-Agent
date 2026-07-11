import { AI_ANALYSIS_SYSTEM_INSTRUCTION } from '../prompt-builder';
import { DEFAULT_OPENROUTER_TIMEOUT_MS } from '../constants';
import {
  AIProvider,
  AIProviderOptions,
  AIProviderResponse,
  normalizeAiProviderId,
} from './ai-provider';

export const OPENAI_PROVIDER_ID = 'openai';
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TEMPERATURE = 0.2;

export interface OpenAIProviderDependencies {
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * OpenAI Chat Completions transport. Receives a fully assembled prompt and
 * returns raw model output — no PKM access, prompt building, or filesystem I/O.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = OPENAI_PROVIDER_ID;
  readonly name = 'OpenAI';

  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(dependencies: OpenAIProviderDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
    this.baseUrl = dependencies.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = dependencies.timeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS;
  }

  supports(providerId: string): boolean {
    return normalizeAiProviderId(providerId) === this.id;
  }

  async analyze(prompt: string, options: AIProviderOptions): Promise<AIProviderResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            { role: 'system', content: options.systemInstruction ?? AI_ANALYSIS_SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
          ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
        }),
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`OpenAI request timed out after ${this.timeoutMs}ms`);
      }
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const content = payload.choices?.[0]?.message?.content;
    if (content === undefined || content.trim() === '') {
      throw new Error('OpenAI response did not include message content');
    }

    const result: AIProviderResponse = {
      content,
      model: payload.model ?? options.model,
      provider: this.id,
      raw: payload,
    };

    if (payload.usage !== undefined) {
      result.usage = {
        ...(payload.usage.prompt_tokens !== undefined
          ? { promptTokens: payload.usage.prompt_tokens }
          : {}),
        ...(payload.usage.completion_tokens !== undefined
          ? { completionTokens: payload.usage.completion_tokens }
          : {}),
        ...(payload.usage.total_tokens !== undefined
          ? { totalTokens: payload.usage.total_tokens }
          : {}),
      };
    }

    return result;
  }
}
