# src/config

**Responsibility:** Runtime configuration resolution.

This is the only module in the application that reads `process.argv` and `process.env`. It parses CLI flags, falls back to environment variables, applies defaults, validates all inputs, and produces a single typed `RuntimeConfig` object. Every other module receives `RuntimeConfig` — it never accesses raw environment state directly.

---

## Exports

### `RuntimeConfig`

The validated configuration type passed to the rest of the application.

```typescript
interface RuntimeConfig {
  targetProjectPath: string;      // Resolved absolute path to the target repository
  docsDir: string;                // Output docs folder name (default: '.ai-docs')
  openRouterApiKey?: string;      // Derived from apiKeys.openrouter (OpenRouter backward compat)
  apiKeys?: Partial<Record<string, string>>; // Per-provider keys (openrouter, openai, …)
  enableAiAnalysis: boolean;      // true when --ai is passed
  enableModuleDocumentation: boolean; // per-module AI fan-out when AI is on (default true; `--skip-module-docs`)
  aiProvider: string;             // AI provider id (default: 'openrouter'; validated against the provider registry)
  aiModel: string;                // Model id passed to the provider (default: openai/gpt-4.1-mini)
  enableAgentExports: boolean;    // true when --export-agents is passed
  exportTargets: AgentExportTarget[]; // resolved from --target (default: ['generic'])
}
```

### `RuntimeConfigInput` / `buildRuntimeConfig(input)` / `resolveProviderApiKey(config)`

Shared validation path used by the CLI and the Web UI. Accepts a structured input object — not argv — and returns `RuntimeConfig`.

```typescript
interface RuntimeConfigInput {
  targetProjectPath: string;
  docsDir?: string;
  enableAiAnalysis?: boolean;
  enableModuleDocumentation?: boolean; // default true; false via --skip-module-docs
  aiProvider?: string;
  aiModel?: string;
  openRouterApiKey?: string;   // CLI --openrouter-key
  openAiApiKey?: string;       // CLI --openai-key
  apiKeys?: Partial<Record<string, string>>;
  enableAgentExports?: boolean;
  exportTargetSelector?: string; // 'generic' | 'cursor' | 'all'
}

function buildRuntimeConfig(input: RuntimeConfigInput): RuntimeConfig;
function resolveProviderApiKey(config: RuntimeConfig): string | undefined;
```

Env fallbacks for `OPENROUTER_API_KEY` and `OPENAI_API_KEY` stay inside this module. Callers must not read `process.env` themselves.

### `resolveConfig(argv: string[]): RuntimeConfig`

CLI wrapper: parses argv via `parseArgs()`, maps flags to `RuntimeConfigInput`, then calls `buildRuntimeConfig()`. Throws an `Error` with a descriptive message if any validation fails. The caller (`cli.ts`) catches and surfaces the message.

### `printHelp(): void`

Prints the full usage information to stdout.

### `isHelpRequested(argv: string[]): boolean`

Returns `true` if `--help` or `-h` is present in `argv`.

---

## Configuration sources and priority

| Priority | Source | Applied to |
|---|---|---|
| 1 (highest) | CLI `--openrouter-key` / `openRouterApiKey` / `apiKeys.openrouter` | `apiKeys.openrouter` (+ derived `openRouterApiKey`) |
| 2 | Environment variable `OPENROUTER_API_KEY` | `apiKeys.openrouter` |
| 1 (highest) | CLI `--openai-key` / `openAiApiKey` / `apiKeys.openai` | `apiKeys.openai` |
| 2 | Environment variable `OPENAI_API_KEY` | `apiKeys.openai` |
| 3 | CLI flag `--ai` / `enableAiAnalysis` | `enableAiAnalysis` |
| 3b | CLI flag `--skip-module-docs` / `enableModuleDocumentation` | `enableModuleDocumentation` (default `true`) |
| 4 | CLI flag `--ai-provider` / `aiProvider` | `aiProvider` |
| 5 | CLI flag `--model` / `aiModel` | `aiModel` |
| 6 | Default value | `docsDir` (→ `.ai-docs`), `aiProvider` (→ `openrouter`), `aiModel` (→ `openai/gpt-4.1-mini`), `enableModuleDocumentation` (→ `true`) |

---

## Validation rules

| Input | Rules |
|---|---|
| `targetProjectPath` | Required. Must exist on disk. Must be a directory. Permission errors produce a clear message. |
| `docsDir` | Must not be empty or blank after trimming. Must be a single relative folder name (not `.`, `/`, `\`, or `..`, and not absolute). |
| `apiKeys` / provider keys | Optional. No format validation — passed through as-is after trim. |
| `enableAiAnalysis` | Optional. Set by `--ai`; defaults to `false`. |
| `enableModuleDocumentation` | Optional. Defaults to `true`. Set `false` with `--skip-module-docs` to skip per-module AI fan-out while still running architecture context when `--ai` is set. |
| `aiProvider` | Optional. Set by `--ai-provider`; defaults to `openrouter`. Normalized to lowercase and validated against the AI provider registry (`src/ai/providers/`); unsupported names fail with the supported list. |
| `aiModel` | Optional. Set by `--model`; defaults to `openai/gpt-4.1-mini`. Passed through to the selected provider. |
| Unknown flags | Rejected with a descriptive error (CLI `parseArgs` only). |
| Flags without values | Rejected (`--docs-dir`, `--openrouter-key`, `--openai-key` require a value). |

---

## Internal structure

| File | Role |
|---|---|
| `index.ts` | `RuntimeConfig`, CLI `parseArgs` / `resolveConfig` / `printHelp` (only place that reads `process.argv`) |
| `runtime-config-builder.ts` | `RuntimeConfigInput`, `buildRuntimeConfig()`, `resolveProviderApiKey()` — shared validation and env key fallback |
| `constants.ts` | Default docs dir and AI model |

---

## Adding a new configuration option

1. Add the field to `RuntimeConfig`.
2. Add the field to `RuntimeConfigInput` and validate it in `buildRuntimeConfig()`.
3. Add the CLI flag to `parseArgs()` and map it in `resolveConfig()`.
4. Add the environment variable fallback in the builder if applicable.
5. Add a default value if the option is optional.
6. Update `printHelp()` to document the new option.
7. Update `docs/architecture.md` to reflect the new configuration surface.
