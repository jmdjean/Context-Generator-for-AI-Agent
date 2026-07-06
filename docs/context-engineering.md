# Context Engineering

## The problem this project solves

AI coding agents are limited not by their reasoning ability but by the quality of context they receive. When an agent opens a repository it has never seen before, it must guess: What does this project do? Where does the business logic live? What are the naming conventions? What changed recently?

Without good answers, the agent either reads too much (wastes tokens, loses focus) or too little (misses critical constraints and makes wrong assumptions). Both failure modes produce low-quality output.

**Context engineering** is the practice of structuring a project so that an agent can load exactly the right context — no more, no less — before it starts working.

---

## The documentation layer

The output of `ai-project-docs` is a `.ai-docs/` folder inside the target repository. This folder is not a wiki. It is a structured context layer designed specifically for agents.

It answers the questions an agent asks at the start of every task:

- **What is this project?** → `project-overview.md`
- **Where do I start?** → `navigation-guide.md`
- **What does each folder do?** → `folder-structure.md`
- **What are the conventions?** → `conventions.md`
- **What are the key dependencies?** → `dependency-map.md`
- **What has changed recently?** → `recent-changes.md`

Each file is written so that an agent loading it gains enough context to make correct decisions without reading the source code first.

---

## Principles

### 1. Agents should not read the whole repository blindly

A repository with 200 files and 50,000 lines of code cannot be fully loaded into an agent's context. The documentation layer provides a pre-digested map. The agent reads the map, identifies the relevant area, and reads only those source files.

### 2. Structure guides context

The folder structure of a project communicates intent. The documentation layer makes that intent explicit: each folder has a declared responsibility, and agents know where to look for what they need.

### 3. Precision reduces hallucination

Vague documentation produces confident but wrong answers. Every documentation section should be specific enough that an agent reading it makes the same decision a human expert would make.

### 4. Documentation must be kept current

Stale documentation is worse than no documentation. It misleads agents into making decisions based on outdated information. The tool supports incremental updates — re-running it rewrites only the sections that reflect actual changes.

### 5. The documentation layer is not hand-edited

The `.ai-docs/` folder is owned by the tool. Users configure what to generate; they do not edit the output directly. This ensures the documentation stays in sync with the repository.

---

## What good context looks like

Good context is:

- **Specific to the project.** Not generic ("this is a Node.js project") but precise ("the main orchestration flow starts in `src/core/run.ts` and delegates to the scanner before calling the AI").
- **Structured for navigation.** An agent reading `navigation-guide.md` should know in two minutes where to make a change.
- **Honest about what is incomplete.** If a section is unimplemented, the documentation says so explicitly. Agents should not assume that silence means completeness.
- **Written at the right altitude.** Architecture docs describe the system; folder docs describe a module; convention docs describe a pattern. Mixing altitudes produces noise.

---

## How this project documents itself

This repository follows the same principles it promotes.

- `AGENTS.md` is the mandatory entry point for any agent working here.
- Each `src/` subfolder has a `README.md` that declares its responsibility and constraints.
- `docs/` contains architecture and philosophy documentation that an agent can load before touching source code.
- The `README.md` tracks implementation status so agents know what is done and what is planned.

Maintaining this documentation is not optional. It is part of the definition of done for every change.
