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
  openRouterApiKey?: string;      // API key — present if resolved from flag or env var
  enableAiAnalysis: boolean;      // true when --ai is passed
  aiProvider: string;             // AI provider id (default: 'openrouter'; validated against the provider registry)
  aiModel: string;                // Model id passed to the provider (default: openai/gpt-4.1-mini)
  enableAgentExports: boolean;    // true when --export-agents is passed
  exportTargets: AgentExportTarget[]; // resolved from --target (default: ['generic'])
}
```

### `resolveConfig(argv: string[]): RuntimeConfig`

Parses the provided argument array, resolves environment variable fallbacks, validates all inputs, and returns `RuntimeConfig`. Throws an `Error` with a descriptive message if any validation fails. The caller (`cli.ts`) catches and surfaces the message.

### `printHelp(): void`

Prints the full usage information to stdout.

### `isHelpRequested(argv: string[]): boolean`

Returns `true` if `--help` or `-h` is present in `argv`.

---

## Configuration sources and priority

| Priority | Source | Applied to |
|---|---|---|
| 1 (highest) | CLI flag `--openrouter-key` | `openRouterApiKey` |
| 2 | Environment variable `OPENROUTER_API_KEY` | `openRouterApiKey` |
| 3 | CLI flag `--ai` | `enableAiAnalysis` |
| 4 | CLI flag `--ai-provider` | `aiProvider` |
| 5 | CLI flag `--model` | `aiModel` |
| 6 | Default value | `docsDir` (→ `.ai-docs`), `aiProvider` (→ `openrouter`), `aiModel` (→ `openai/gpt-4.1-mini`) |

---

## Validation rules

| Input | Rules |
|---|---|
| `targetProjectPath` | Required. Must exist on disk. Must be a directory. Permission errors produce a clear message. |
| `docsDir` | Must not be empty or blank after trimming. Must be a single relative folder name (not `.`, `/`, `\`, or `..`, and not absolute). |
| `openRouterApiKey` | Optional. No format validation — passed through as-is. |
| `enableAiAnalysis` | Optional. Set by `--ai`; defaults to `false`. |
| `aiProvider` | Optional. Set by `--ai-provider`; defaults to `openrouter`. Normalized to lowercase and validated against the AI provider registry (`src/ai/providers/`); unsupported names fail with the supported list. |
| `aiModel` | Optional. Set by `--model`; defaults to `openai/gpt-4.1-mini`. Passed through to the selected provider. |
| Unknown flags | Rejected with a descriptive error. |
| Flags without values | Rejected (`--docs-dir` and `--openrouter-key` require a value). |

---

## Internal structure

The module has three internal concerns kept as private functions:

- `parseArgs(argv)` — extracts positional and named flags from the raw argument array.
- `resolveApiKey(flagValue)` — returns the flag value if present, otherwise falls back to `process.env['OPENROUTER_API_KEY']`.
- Validation inside `resolveConfig()` — uses `assertReadableDirectory()` from `src/utils/fs.ts` for existence, directory, and permission checks.

---

## Adding a new configuration option

1. Add the field to `RuntimeConfig`.
2. Add the CLI flag to `parseArgs()`.
3. Add the environment variable fallback to `resolveConfig()` if applicable.
4. Add a default value if the option is optional.
5. Add validation if needed.
6. Update `printHelp()` to document the new option.
7. Update `docs/architecture.md` to reflect the new configuration surface.
