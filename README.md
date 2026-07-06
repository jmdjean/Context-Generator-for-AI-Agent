# AI Project Docs

A local CLI tool that analyzes any software repository and generates high-quality, AI-readable documentation so that AI coding agents can understand the project architecture before modifying code.

---

## Vision

AI coding agents often fail not because they lack capability, but because they lack context. They read files blindly, guess at conventions, and hallucinate structure.

**AI Project Docs** solves this by generating a `.ai-docs/` folder inside any target repository. That folder becomes the authoritative context layer for agents: it tells them where to start, what each module does, what the conventions are, and what has changed recently.

The goal is not to replace code comments or wikis. It is to create a structured, always-current documentation layer that agents can load *before* they touch any code.

---

## Core Principles

- **Agents should not read the whole repository blindly.** They need a guided entry point.
- **Structure guides context.** Each folder should explain its own responsibility.
- **Documentation reduces hallucination.** The more precise the context, the fewer the mistakes.
- **Documentation is part of the source code.** It must be maintained like any other module.

---

## Usage

```bash
npx ai-project-docs ./my-project
```

The tool accepts a path to any local software project.

### Example output

```
AI Project Docs

Target project: ./my-project
Status: project foundation ready
```

---

## Current Implementation Status

| Feature | Status |
|---|---|
| CLI entry point | ✅ Done |
| Project structure | ✅ Done |
| Initial documentation | ✅ Done |
| Target path validation | ✅ Done |
| Repository scanner | 🔜 Planned |
| OpenRouter integration | 🔜 Planned |
| `.ai-docs/` generation | 🔜 Planned |
| Incremental updates | 🔜 Planned |

This is the **project foundation** phase. The CLI accepts a target path and confirms it was provided. No scanning or documentation generation occurs yet.

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
  cli.ts          — CLI entry point
  core/           — Orchestration logic
  config/         — Configuration loading and validation
  scanner/        — Repository analysis (planned)
  docs/           — Documentation generation (planned)
  ai/             — OpenRouter integration (planned)
  utils/          — Shared utilities
docs/
  architecture.md        — System architecture
  folder-structure.md    — Folder responsibility map
  context-engineering.md — Documentation philosophy
```

See [`docs/folder-structure.md`](docs/folder-structure.md) for a full breakdown.

---

## Contributing

Read [`AGENTS.md`](AGENTS.md) before making any changes. It explains how to navigate this codebase and what conventions to follow.
