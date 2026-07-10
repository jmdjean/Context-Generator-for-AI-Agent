export interface AIProviderOptions {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AIProviderResponse {
  content: string;
  model: string;
  provider: string;
  usage?: AIProviderUsage;
  raw?: unknown;
}

/**
 * Transport contract for AI backends (OpenRouter today; OpenAI, Anthropic,
 * Gemini, Azure OpenAI, Ollama, local models later).
 *
 * Providers receive fully assembled prompt strings and return raw model
 * output. They must never scan repositories, read source files, build
 * prompts from PKM data, or mutate anything — prompt content is owned by
 * the prompt builder and response interpretation by the analysis service.
 */
export interface AIProvider {
  readonly id: string;
  readonly name: string;
  supports(providerId: string): boolean;
  analyze(prompt: string, options: AIProviderOptions): Promise<AIProviderResponse>;
}

export function normalizeAiProviderId(providerId: string): string {
  return providerId.trim().toLowerCase();
}
