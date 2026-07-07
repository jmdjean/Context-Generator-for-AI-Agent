# AI Project Docs

A local CLI tool that analyzes any software repository and generates high-quality, AI-readable documentation so that AI coding agents can understand the project architecture before modifying code.

---

## Vision

AI coding agents often fail not because they lack capability, but because they lack context. They read files blindly, guess at conventions, and hallucinate structure.

**AI Project Docs** solves this by analyzing a repository, assembling a **Project Knowledge Model (PKM)**, and generating structured outputs — starting with a `.ai-docs/` folder inside the target repository. That folder becomes the authoritative context layer for agents: it tells them where to start, what each module does, what the conventions are, and what has changed recently.

The goal is not to replace code comments or wikis. It is to create a structured, always-current knowledge layer that agents can load *before* they touch any code.

---

## Architecture

The tool follows a compiler-like pipeline: analysis stages populate a single knowledge model; generators read from that model.

```
Repository
    ↓
Repository Loader + Scanner
    ↓
Technology Detection
    ↓
Project Knowledge Model (PKM)
    ↓
Generators (Markdown, Cursor rules, skills, agent packs…)
    ↓
Outputs (.ai-docs/knowledge/*.json, .ai-docs/*.md, future formats)
```

The PKM is persisted to `.ai-docs/knowledge/` as machine-readable JSON. Markdown files are one derived output format — not the source of truth. Each key Markdown document (`architecture.md`, `folder-structure.md`, `dependency-map.md`, `conventions.md`, `agent-navigation.md`, `ai-context.md`, `implementation-guide.md`) is produced by a small deterministic renderer in `src/docs/markdown-renderers/` that only presents PKM data — Markdown generation never analyzes the repository itself.

---

## Core Principles

- **Agents should not read the whole repository blindly.** They need a guided entry point.
- **Structure guides context.** Each folder should explain its own responsibility.
- **Documentation reduces hallucination.** The more precise the context, the fewer the mistakes.
- **Documentation is part of the source code.** It must be maintained like any other module.

---

## Usage

```bash
npx ai-project-docs <target-path> [options]
```

### Arguments

| Argument | Description |
|---|---|
| `<target-path>` | Path to the project directory to analyze (required) |

### Options

| Option | Description | Default |
|---|---|---|
| `--openrouter-key <key>` | OpenRouter API key for AI-powered analysis | `OPENROUTER_API_KEY` env var |
| `--docs-dir <name>` | Output docs folder name | `.ai-docs` |
| `--help` | Show usage information | — |

### Examples

```bash
# Analyze a project (API key resolved from environment variable)
ai-project-docs ./my-project

# Pass the API key directly
ai-project-docs ./my-project --openrouter-key sk-or-xxx

# Use a custom docs folder name
ai-project-docs ./my-project --docs-dir .project-docs

# All options combined
ai-project-docs ./my-project --openrouter-key sk-or-xxx --docs-dir .project-docs

# Show help
ai-project-docs --help
```

### Example output

```
AI Project Docs

Target project: /absolute/path/to/my-project
Docs directory: .ai-docs
OpenRouter key: detected
Status: configuration resolved
```

If the API key is not provided:

```
AI Project Docs

Target project: /absolute/path/to/my-project
Docs directory: .ai-docs
OpenRouter key: missing

Warning: OPENROUTER_API_KEY was not provided. AI-powered analysis will be skipped in future steps.

Status: configuration resolved
```

---

## Current Implementation Status

| Feature | Status |
|---|---|
| CLI entry point | ✅ Done |
| Project structure | ✅ Done |
| Initial documentation | ✅ Done |
| Argument parsing | ✅ Done |
| Runtime configuration resolver | ✅ Done |
| Target path validation | ✅ Done |
| OpenRouter key resolution (flag + env) | ✅ Done |
| Repository scanner | ✅ Done |
| Folder knowledge analyzer | ✅ Done |
| Module discovery analyzer | ✅ Done |
| Dependency graph analyzer | ✅ Done |
| Convention analyzer | ✅ Done |
| AI navigation map | ✅ Done |
| Project Knowledge Model (PKM) | ✅ Done |
| PKM persistence (`.ai-docs/knowledge/`) | ✅ Done |
| OpenRouter integration | 🔜 Planned |
| `.ai-docs/` Markdown generation | ✅ Done |
| PKM-powered Markdown renderers | ✅ Done |
| Incremental diffing | 🔜 Planned |

---

## Installation (development)

```bash
git clone <repo-url>
cd context-generator-for-ai-agent
npm install
npm run build
node dist/cli.js ./my-project
```

---

## Project Structure

```
src/
  cli.ts          — CLI entry point (argument parsing, delegates to core)
  core/           — Orchestration (runs the pipeline in order)
  config/         — Configuration resolver (flags, env vars, validation)
  scanner/        — Repository analysis
  detectors/      — Technology detection
  knowledge/      — Project Knowledge Model (PKM) — single source of truth
  analyzers/      — Deterministic PKM enrichment (folder, module, dependency graph, conventions, navigation map)
  docs/           — Documentation planning, PKM-powered Markdown renderers, and writing (generators)
  ai/             — OpenRouter integration (planned)
  utils/          — Shared utilities (filesystem helpers, etc.)
docs/
  architecture.md        — System architecture
  folder-structure.md    — Folder responsibility map
  context-engineering.md — Documentation philosophy
```

See [`docs/folder-structure.md`](docs/folder-structure.md) for a full breakdown.

---

## Contributing

Read [`AGENTS.md`](AGENTS.md) before making any changes. It explains how to navigate this codebase and what conventions to follow.
