import { DEFAULT_OPENROUTER_TIMEOUT_MS } from './constants';

export interface OpenRouterChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterCompletionRequest {
  model: string;
  messages: OpenRouterChatMessage[];
}

export interface OpenRouterClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  timeoutMs?: number;
  appReferer?: string;
  appTitle?: string;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_APP_REFERER = 'https://github.com/jmdjean/Context-Generator-for-AI-Agent';
const DEFAULT_APP_TITLE = 'ai-project-docs';
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

class OpenRouterRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterRetryableError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  if (err.name === 'AbortError') {
    return true;
  }

  const message = err.message.toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('timed out')
  );
}

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly appReferer: string;
  private readonly appTitle: string;

  constructor(options: OpenRouterClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS;
    this.appReferer = options.appReferer ?? DEFAULT_APP_REFERER;
    this.appTitle = options.appTitle ?? DEFAULT_APP_TITLE;
  }

  private async executeOnce(request: OpenRouterCompletionRequest): Promise<string> {
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
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.appReferer,
          'X-Title': this.appTitle,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new OpenRouterRetryableError(
          `OpenRouter request timed out after ${this.timeoutMs}ms`,
        );
      }
      if (isRetryableNetworkError(err)) {
        throw new OpenRouterRetryableError(
          err instanceof Error ? err.message : 'OpenRouter network request failed',
        );
      }
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text();
      const message = `OpenRouter request failed (${response.status}): ${body.slice(0, 300)}`;
      if (isRetryableStatus(response.status)) {
        throw new OpenRouterRetryableError(message);
      }
      throw new Error(message);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (content === undefined || content.trim() === '') {
      throw new Error('OpenRouter response did not include message content');
    }
    return content;
  }

  async complete(request: OpenRouterCompletionRequest): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.executeOnce(request);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        const shouldRetry =
          error instanceof OpenRouterRetryableError && attempt < this.maxRetries;
        if (!shouldRetry) {
          throw error;
        }

        await sleep(500 * 2 ** attempt);
      }
    }

    throw lastError ?? new Error('OpenRouter request failed');
  }
}

export function createOpenRouterClient(
  apiKey: string,
  options?: Omit<OpenRouterClientOptions, 'apiKey'>,
): OpenRouterClient {
  return new OpenRouterClient({ apiKey, ...options });
}
