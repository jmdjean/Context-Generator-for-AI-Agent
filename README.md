# AI Project Docs

**Context Engineering CLI** — analyzes a software repository and generates AI-agent-friendly documentation plus a persisted **Project Knowledge Model (PKM)**.

```bash
npm install -g ai-project-docs   # after publish
ai-project-docs ./my-project
```

No API key required. No source code modified. Outputs land in `.ai-docs/` inside the target repo and can be safely regenerated.

---

## Quick start

```bash
git clone https://github.com/jmdjean/Context-Generator-for-AI-Agent.git
cd Context-Generator-for-AI-Agent
npm install
npm run build
node dist/cli.js ./my-project
```

Open `.ai-docs/agent-navigation.md` with your AI coding agent, or load `.ai-docs/knowledge/project-knowledge.json` for machine-readable context.

---

## MVP usage flow

1. **Run the CLI** against any project directory: `ai-project-docs ./my-project`.
2. **Watch the pipeline checklist** — each step prints `✓` (completed), `○` (skipped by design), or `✗` (failed).
3. **Read the final run summary** — it tells you exactly what happened:

```
AI Project Docs completed

Project: my-project
Target: /path/to/my-project
Docs: .ai-docs
Duration: 29ms
Pipeline: 15 completed, 4 skipped
Technologies: TypeScript, React

Knowledge:
- Repository tree: generated
- Files scanned: 42
- Folders analyzed: 24
- Modules discovered: 12
- Dependency edges: 18
- Conventions detected: 9
- Navigation entries: 8
- Knowledge files persisted: 13

Change detection:
- Initial run: yes (baseline created)

Documentation:
- Planned: 13
- Written: 13
- Skipped unchanged: 0
- Skipped protected: 0

Validation:
- Errors: 0
- Warnings: 2
- Status: passed

Next steps:
- Review .ai-docs/README.md
- Share .ai-docs/agent-navigation.md with your AI coding agent
- Load .ai-docs/knowledge/project-knowledge.json for machine-readable context
```

4. **Follow the next steps** — open `.ai-docs/README.md` yourself and hand `.ai-docs/agent-navigation.md` to your AI coding agent.
5. **Re-run after changes** — the summary switches to incremental mode: `Change detection` lists changed PKM sections, `Document impact` shows how many documents were affected, and only impacted Markdown is rewritten (`Skipped unchanged` counts the rest).

Sections for optional features appear only when you enable them: `AI Analysis` with `--ai`, `Agent exporters` with `--export-agents`. A non-zero exit code plus an `Errors:` section means the run needs attention (see exit codes below).

---

## What it does

| Stage | Output |
|---|---|
| Repository scan | Folder tree with ignore rules and safety limits |
| Technology detection | Languages, frameworks, package managers |
| PKM assembly | Single machine-readable knowledge model |
| Deterministic analyzers | Folders, modules, dependencies, conventions, navigation map (via plugins) |
| Markdown generation | Docs rendered **from the PKM** via the template engine (not by re-scanning the repo) |
| Validation + summary | Exit code, counts, and next steps in the terminal |
| Change detection | Compares current PKM to previous snapshot; persists `change-summary.json` |
| Selective regeneration | Rewrites only impacted generated Markdown based on PKM section changes |

The authoritative output is `.ai-docs/knowledge/project-knowledge.json`. Markdown files are derived presentations.

### Plugin architecture

Analysis is **plugin-driven**. The core loads the repository, builds the PKM, and executes registered plugins through `PluginManager`. Framework-specific logic (Angular, React, NestJS, and future stacks) lives in technology plugins — not in the core.

Built-in analyzer plugins wrap the existing deterministic analyzers and return `PluginContributions` merged by `PluginManager`. Observable CLI behavior and generated outputs are unchanged. See [`docs/plugins.md`](docs/plugins.md).

---

## What it does not do yet

- Cursor rules, skills, or other agent-specific exporters
- File watching or git-based incremental sync
- Any modification of project source files

Optional AI analysis is available with `--ai` (see CLI reference). It runs through a **provider-based architecture**: the analysis service depends on an `AIProvider` contract, and concrete backends are resolved by id (`--ai-provider`, default `openrouter`). OpenRouter is the only built-in provider today; OpenAI, Anthropic, Gemini, Azure OpenAI, Ollama, and local models can be added by registering new providers without touching the analysis service. When enabled, insights are persisted in the PKM under `analysis.aiInsights` and rendered into selected Markdown documents as **non-authoritative enrichment**. Deterministic PKM sections remain the source of truth; providers receive only a compact PKM summary prompt (never source code), and renderers read already-persisted PKM data without calling any AI backend.

---

## Installation

### npm (after publish)

```bash
npm install -g ai-project-docs
ai-project-docs ./my-project
```

### Local development

```bash
npm install
npm run build
node dist/cli.js ./my-project
```

### Global link (development)

```bash
npm run build
npm link
ai-project-docs ./my-project
# remove later: npm unlink -g ai-project-docs
```

---

## CLI reference

```bash
ai-project-docs <target-path> [options]
```

| Argument / option | Description | Default |
|---|---|---|
| `<target-path>` | Project directory to analyze (required) | — |
| `--docs-dir <name>` | Output folder inside the target repo | `.ai-docs` |
| `--ai` | Run optional AI analysis (requires API key) | off |
| `--ai-provider <name>` | AI provider to use (`openrouter` today; more planned) | `openrouter` |
| `--export-agents` | Export agent-specific context files from the PKM | off |
| `--target <name>` | Export target: `generic`, `cursor`, or `all` (requires `--export-agents`) | `generic` |
| `--openrouter-key <key>` | OpenRouter API key | `OPENROUTER_API_KEY` |
| `--model <id>` | Model identifier passed to the provider | `openai/gpt-4.1-mini` |
| `--help`, `-h` | Show usage | — |

Passing an unsupported `--ai-provider` value fails immediately with the list of supported providers (exit code `1`).

### Examples

```bash
ai-project-docs ./my-project
ai-project-docs ./my-project --docs-dir .project-docs
ai-project-docs ./my-project --ai --openrouter-key "$OPENROUTER_API_KEY"
ai-project-docs ./my-project --ai --ai-provider openrouter
ai-project-docs ./my-project --export-agents
ai-project-docs ./my-project --export-agents --target cursor
ai-project-docs ./my-project --export-agents --target all
ai-project-docs --help
```

### Exit codes

| Code | When |
|---|---|
| `0` | Success — PKM persisted, docs written, validation passed |
| `1` | Config error — missing path, path not found, not a directory, invalid `--docs-dir`, unknown flag |
| `2` | Validation failed — generated docs missing or malformed |
| `3` | Runtime error — pipeline step failed, permission error during write |

When `--ai` is passed, the summary includes an **AI Analysis** section (`Provider`, `Model`, `Insights generated`) — including `no (see warnings)` when the run failed to produce validated insights.

When `--export-agents` is passed, the summary includes an **Agent exporters** section (`Targets`, `Files written`, `Files skipped`). Neither section appears when its flag is off.

---

## Generated output

```
.ai-docs/
  README.md                 # Human overview
  AGENTS.md                   # Agent entry point
  agent-navigation.md         # Task → document routing; includes optional AI insights when present
  architecture.md             # PKM-powered; includes optional AI insights when present
  folder-structure.md         # PKM-powered
  dependency-map.md           # PKM-powered
  conventions.md              # PKM-powered
  ai-context.md               # PKM-powered; includes optional AI insights when present
  implementation-guide.md     # PKM-powered; includes optional AI insights when present
  technology-overview.md
  change-log.md
  agent-pack/
    AGENTS.generated.md     # Generic agent context pack (--export-agents --target generic)
  knowledge/
    project-knowledge.json    # Full PKM (start here for tooling)
    repository.json
    repository-tree.json
    technologies.json
    analysis.json
    folders.json
    modules.json
    dependencies.json
    conventions.json
    navigation-map.json
    change-summary.json       # PKM diff vs previous run (when a prior snapshot exists)
    agent-exports.json        # Agent export results (when --export-agents ran)

.cursor/                      # Cursor exporter output (--export-agents --target cursor)
  rules/
    ai-project-docs.mdc       # Always-on Cursor rule derived from the PKM
```

**Regeneration policy:** files starting with `<!-- Generated by AI Project Docs. Safe to update. -->` are tool-managed. Files without that marker are preserved.

---

## For AI coding agents

1. Load `.ai-docs/agent-navigation.md` — it routes task types to the right docs and PKM sections.
2. Read `.ai-docs/AGENTS.md` — mandatory conventions for working in the repo.
3. Use `.ai-docs/knowledge/project-knowledge.json` when you need structured, machine-readable context.

The tool never touches source code — only the configured docs folder and tool-managed agent export paths (such as `.cursor/rules/` when using the Cursor exporter).

---

## Development commands

```bash
npm run build    # compile TypeScript → dist/
npm test         # unit tests
npm run smoke    # end-to-end CLI smoke test
node dist/cli.js .   # analyze this repository
```

---

## MVP limitations

- AI analysis is opt-in (`--ai`) — default runs are deterministic only
- Full scan every run — PKM analysis always runs; only Markdown regeneration is selective on incremental runs
- Markdown is the primary human/agent output format; agent packs are optional via `--export-agents`
- Large repos may hit scanner depth/file limits (`truncated` flagged in PKM)
- Permission-denied directories are skipped during scan

---

## Roadmap

| Feature | Status |
|---|---|
| CLI, scanner, detectors | Done |
| PKM + deterministic analyzers | Done |
| Plugin architecture (built-in + technology placeholders) | Done |
| PKM-powered Markdown + template engine + validation | Done |
| OpenRouter integration (optional `--ai`) | Done |
| Provider-based AI architecture (`--ai-provider`, OpenRouter default) | Done |
| Additional AI providers (OpenAI, Anthropic, Gemini, Azure OpenAI, Ollama, local) | Planned |
| Change detection (PKM diff) | Done |
| Selective regeneration from change summary | Done |
| Generic agent exporter (`--export-agents`) | Done |
| Cursor exporter (`--export-agents --target cursor`) | Done |
| Agent exporters (Claude Code, Codex, Copilot) | Planned |

---

## Architecture

```
Repository → Scanner → Detection → PKM → Plugins → Template Engine → Generators → .ai-docs/
```

PKM data flows through a lightweight template engine (`src/templates/`) before Markdown is written. Templates are presentation-only and deterministic; the PKM remains the source of truth.

The core no longer embeds framework-specific analysis. Technology behavior is implemented as plugins.

Details: [`docs/architecture.md`](docs/architecture.md) · [`docs/plugins.md`](docs/plugins.md)

---

## Contributing

- Project documentation should be kept in English across `README.md`, `docs/`, `AGENTS.md`, and folder-level `README.md` files.
- [`AGENTS.md`](AGENTS.md) — conventions, PKM rules, safety constraints
- [`docs/release-checklist.md`](docs/release-checklist.md) — pre-release verification

---

## License

MIT — see [LICENSE](LICENSE).
