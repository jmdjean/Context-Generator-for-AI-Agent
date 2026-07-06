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

This principle also applies to how this project is built. The `src/domain/` layer defines explicit types for every concept before any implementation code is written. When the scanner returns a `RepositoryNode`, the AI module receives an `AnalysisResult`, and the docs module consumes a `DocumentModel[]` — there is no ambiguity about what data flows between stages. Named, typed contracts eliminate the gaps that hallucination fills.

### 4. Documentation must be kept current

Stale documentation is worse than no documentation. It misleads agents into making decisions based on outdated information. The tool supports incremental updates: step 10 of the pipeline (Save Incremental State) persists a snapshot of the current analysis so that future runs only regenerate sections that reflect actual changes.

### 5. The documentation layer is not hand-edited

The `.ai-docs/` folder is owned by the tool. Users configure what to generate; they do not edit the output directly. This ensures the documentation stays in sync with the repository.

---

## How the domain model reduces hallucination

Without shared type contracts, agents implementing different pipeline stages would make independent assumptions:
- The scanner might call a field `filePath`; the AI module might expect `path`.
- The docs module might expect `modules` to be a list of strings; the analysis might return objects.

These mismatches are invisible until runtime, and they invite the agent to guess at the right structure.

`src/domain/` removes guesswork by declaring every data structure before any implementation exists. When an agent is asked to implement the scanner, it reads `RepositoryNode` and `RepositoryInfo` and knows exactly what shape to produce. When an agent is asked to implement the AI integration, it reads `ProjectContext` and `AnalysisResult` and knows exactly what to consume and return.

The domain layer is the single source of truth for the shape of data in this application. Agents do not invent data structures; they implement against contracts.

---

## How the pipeline supports incremental documentation

Generating documentation for a large repository is expensive. Doing it on every save is impractical. The pipeline addresses this with step 10 (Save Incremental State):

- After a successful run, a `.ai-docs/.state.json` file records which `DocumentModel` sections were generated and from what input hash.
- On the next run, the pipeline compares the current `ProjectContext` against the saved state.
- Only sections whose inputs have changed since the last run are regenerated.

This means that fixing a typo in one file does not re-analyze the entire repository. The incremental model also makes the tool composable: a CI system can run it on every commit, and only the documentation sections affected by that commit's changes will be updated.

---

## How AI agents should use these types before adding features

Before implementing any pipeline stage:

1. Read `src/domain/README.md` to understand the full type landscape.
2. Find the pipeline step you are implementing in `ANALYSIS_PIPELINE` (in `src/domain/pipeline.ts`). Read its `input` and `output` fields — these are your contract.
3. Find the domain types your step produces and consumes. Read their interface definitions.
4. Implement the stage to accept the declared input type and return the declared output type.
5. Do not modify domain types to fit your implementation. Adapt the implementation to fit the domain.

This sequence prevents the most common agent failure: implementing something that works in isolation but doesn't connect cleanly to the rest of the pipeline.

---

## What good context looks like

Good context is:

- **Specific to the project.** Not generic ("this is a Node.js project") but precise ("the main orchestration flow starts in `src/core/index.ts` and will delegate to scanner, AI, and docs modules once implemented — see `ANALYSIS_PIPELINE` in `src/domain/pipeline.ts`").
- **Structured for navigation.** An agent reading `navigation-guide.md` should know in two minutes where to make a change.
- **Honest about what is incomplete.** If a section is unimplemented, the documentation says so explicitly. Agents should not assume that silence means completeness.
- **Written at the right altitude.** Architecture docs describe the system; folder docs describe a module; convention docs describe a pattern. Mixing altitudes produces noise.

---

## How this project documents itself

This repository follows the same principles it promotes.

- `AGENTS.md` is the mandatory entry point for any agent working here.
- `src/domain/` defines all data contracts before any implementation — the same principle the tool applies to target repositories.
- Each `src/` subfolder has a `README.md` that declares its responsibility and constraints.
- `docs/` contains architecture and philosophy documentation that an agent can load before touching source code.
- `README.md` tracks implementation status so agents know what is done and what is planned.

Maintaining this documentation is not optional. It is part of the definition of done for every change.
