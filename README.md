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

The MVP flow is three steps: point the CLI at a repository, let the pipeline run, then hand the generated `.ai-docs/` folder to your AI coding agent.

```bash
npx ai-project-docs <target-path> [options]
```

1. **Run the CLI** against any project directory.
2. **Watch the pipeline** — each step prints a `✓` (completed), `○` (skipped), or `✗` (failed) line with a short result message.
3. **Read the final summary** — it reports what was analyzed, what was written, and whether validation passed.
4. **Use the output** — review `.ai-docs/README.md`, then share `.ai-docs/agent-navigation.md` with your AI coding agent.

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

Each pipeline step prints a one-line status while running, followed by a final run summary:

```
AI Project Docs

Target project: /absolute/path/to/my-project
Docs directory: .ai-docs

Pipeline:
✓ Resolve Configuration — target: /absolute/path/to/my-project
✓ Load Repository Metadata — loaded metadata for "my-project"
✓ Scan Repository Structure — scanned 97 file(s) across 14 director(ies)
✓ Detect Technologies — detected 1 language(s)
○ Build Repository Model — skipped: Build Repository Model is not implemented yet
○ Analyze Architecture — skipped: Analyze Architecture is not implemented yet
✓ Generate Documentation Plan — planned 11 documents (strategy: standard)
✓ Build Project Knowledge — assembled PKM for "my-project" (schema: 1.0.0)
✓ Analyze Folder Knowledge — analyzed 14 folder(s), 14 documentable
✓ Analyze Modules — discovered 12 module(s), 12 high confidence
✓ Analyze Dependency Graph — built dependency graph with 10 node(s) and 21 edge(s)
✓ Analyze Conventions — detected 30 convention(s), 27 high confidence
✓ Build AI Navigation Map — built navigation map with 8 entr(ies), 8 high confidence
✓ Write Documentation — written 11, skipped 0
✓ Validate Documentation — passed with 0 error(s), 0 warning(s)
✓ Persist Project Knowledge — persisted 11 knowledge files

AI Project Docs completed

Project: my-project
Target: /absolute/path/to/my-project
Docs: .ai-docs
Technologies: TypeScript, npm

Knowledge:
- Repository tree: generated
- Files scanned: 97
- Folders analyzed: 14
- Modules discovered: 12
- Dependency edges: 21
- Conventions detected: 30
- Navigation entries: 8

Documentation:
- Written: 11
- Skipped: 0

Validation:
- Errors: 0
- Warnings: 0
- Status: passed

Next steps:
- Review .ai-docs/README.md
- Share .ai-docs/agent-navigation.md with your AI coding agent
```

If any step fails, the summary header becomes `AI Project Docs completed with errors`, an `Errors:` section lists each failed step, the `Next steps` section is omitted, and the process exits with code 1.

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
| Documentation validation | ✅ Done |
| Final run summary | ✅ Done |
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
