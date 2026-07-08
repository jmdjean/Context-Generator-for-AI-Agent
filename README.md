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

## What it does

| Stage | Output |
|---|---|
| Repository scan | Folder tree with ignore rules and safety limits |
| Technology detection | Languages, frameworks, package managers |
| PKM assembly | Single machine-readable knowledge model |
| Deterministic analyzers | Folders, modules, dependencies, conventions, navigation map |
| Markdown generation | Docs rendered **from the PKM** (not by re-scanning the repo) |
| Validation + summary | Exit code, counts, and next steps in the terminal |
| Change detection | Compares current PKM to previous snapshot; persists `change-summary.json` |
| Selective regeneration | Rewrites only impacted generated Markdown based on PKM section changes |

The authoritative output is `.ai-docs/knowledge/project-knowledge.json`. Markdown files are derived presentations.

---

## What it does not do yet

- Cursor rules, skills, or other agent-specific exporters
- File watching or git-based incremental sync
- Any modification of project source files

Optional OpenRouter AI analysis is available with `--ai` (see CLI reference). When enabled, insights are persisted in the PKM under `analysis.aiInsights` and rendered into selected Markdown documents as **non-authoritative enrichment**. Deterministic PKM sections remain the source of truth; renderers read already-persisted PKM data and never call OpenRouter directly.

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
| `--ai` | Run optional OpenRouter AI analysis (requires API key) | off |
| `--export-agents` | Export agent-specific context files from the PKM | off |
| `--target <name>` | Export target: `generic`, `cursor`, or `all` (requires `--export-agents`) | `generic` |
| `--openrouter-key <key>` | OpenRouter API key | `OPENROUTER_API_KEY` |
| `--model <id>` | OpenRouter model identifier | `openai/gpt-4.1-mini` |
| `--help`, `-h` | Show usage | — |

### Examples

```bash
ai-project-docs ./my-project
ai-project-docs ./my-project --docs-dir .project-docs
ai-project-docs ./my-project --ai --openrouter-key "$OPENROUTER_API_KEY"
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

When the run completes, the summary includes an **AI Analysis** section (`Enabled`, `Model`, `Insights generated`) — including `no (see warnings)` when `--ai` ran but insights could not be validated.

When `--export-agents` is passed, the summary also includes **Agent exporters** (`Enabled`, `Targets`, `Files written`, `Files skipped`).

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
| PKM-powered Markdown + validation | Done |
| OpenRouter integration (optional `--ai`) | Done |
| Change detection (PKM diff) | Done |
| Selective regeneration from change summary | Done |
| Generic agent exporter (`--export-agents`) | Done |
| Cursor exporter (`--export-agents --target cursor`) | Done |
| Agent exporters (Claude Code, Codex, Copilot) | Planned |

---

## Architecture

```
Repository → Scanner → Detection → PKM → Generators → .ai-docs/
```

Details: [`docs/architecture.md`](docs/architecture.md)

---

## Contributing

- [`AGENTS.md`](AGENTS.md) — conventions, PKM rules, safety constraints
- [`docs/release-checklist.md`](docs/release-checklist.md) — pre-release verification

---

## License

MIT — see [LICENSE](LICENSE).
