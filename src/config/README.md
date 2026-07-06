# src/config

**Responsibility:** Runtime configuration resolution.

This is the only module in the application that reads `process.argv` and `process.env`. It parses CLI flags, falls back to environment variables, applies defaults, validates all inputs, and produces a single typed `RuntimeConfig` object. Every other module receives `RuntimeConfig` — it never accesses raw environment state directly.

---

## Exports

### `RuntimeConfig`

The validated configuration type passed to the rest of the application.

```typescript
interface RuntimeConfig {
  targetProjectPath: string;  // Resolved absolute path to the target repository
  docsDir: string;            // Output docs folder name (default: '.ai-docs')
  openRouterApiKey?: string;  // API key — present if resolved from flag or env var
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
| 3 | Default value | `docsDir` (→ `.ai-docs`) |

---

## Validation rules

| Input | Rules |
|---|---|
| `targetProjectPath` | Required. Must exist on disk. Must be a directory. |
| `docsDir` | Must not be empty or blank. |
| `openRouterApiKey` | Optional. No format validation — passed through as-is. |

---

## Internal structure

The module has three internal concerns kept as private functions:

- `parseArgs(argv)` — extracts positional and named flags from the raw argument array.
- `resolveApiKey(flagValue)` — returns the flag value if present, otherwise falls back to `process.env['OPENROUTER_API_KEY']`.
- Validation inside `resolveConfig()` — uses `src/utils/fs.ts` helpers (`pathExists`, `isDirectory`).

---

## Adding a new configuration option

1. Add the field to `RuntimeConfig`.
2. Add the CLI flag to `parseArgs()`.
3. Add the environment variable fallback to `resolveConfig()` if applicable.
4. Add a default value if the option is optional.
5. Add validation if needed.
6. Update `printHelp()` to document the new option.
7. Update `docs/architecture.md` to reflect the new configuration surface.
