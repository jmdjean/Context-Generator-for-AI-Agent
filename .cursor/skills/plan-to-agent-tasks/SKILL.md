---
name: plan-to-agent-tasks
description: Analyzes a Markdown implementation plan and breaks it into agent-ready task files. Use when the user has a plan in `.md`, wants it decomposed into specific AI-agent tasks, or asks to create a root `ai-tasks/` folder with one Markdown file per task.
disable-model-invocation: true
---

# Plan To Agent Tasks

## Goal

Turn one Markdown plan into a root-level `ai-tasks/` workspace containing focused task files that can be assigned to individual AI agents.

Write all generated task artifacts in English.

## Inputs

- A plan file path ending in `.md`
- The current repository root
- Optional user constraints such as team ordering, preferred task count, or task naming

If the plan file path is missing, ask for it before proceeding.

## Workflow

1. Read the repository `AGENTS.md` first.
2. Read the target plan file in full.
3. Extract:
   - the final goal
   - explicit phases or milestones
   - referenced files, modules, or folders
   - constraints, risks, and validation steps
4. Build a task graph before writing files:
   - separate work by deliverable, module boundary, or validation surface
   - keep one clear owner objective per task
   - mark dependencies explicitly
   - identify which tasks can run in parallel
5. Create `ai-tasks/` at the repository root if it does not exist.
6. If `ai-tasks/` already contains unrelated work, create a subfolder using the plan slug, for example `ai-tasks/staged-multi-agent-documentation-plan/`.
7. Write:
   - `ai-tasks/README.md` or a plan-specific index file with execution order
   - one Markdown file per task using the template below

## Decomposition Rules

Split intelligently. Do not mirror headings mechanically.

Prefer a new task when a work item:

- changes a different module boundary
- has a separate validation path
- can be delegated to a different agent in parallel
- carries distinct risk or requires a handoff

Merge items when they are too small to justify a separate agent or only make sense as one atomic change.

Avoid:

- vague catch-all tasks such as "finish remaining work"
- tasks that mix unrelated code, docs, and tests without need
- tasks that cannot be validated independently
- placeholder tasks with no concrete deliverable

## Task Count Heuristic

- Small plan: `3-5` tasks
- Medium plan: `5-9` tasks
- Large staged plan: `8-12` tasks

Do not force the heuristic if the plan clearly needs fewer or more tasks.

## Required Outputs

### Index file

Create an index file that includes:

- source plan path
- short summary of the plan
- ordered task list
- dependency notes
- suggested parallel execution groups

### Task file naming

Use zero-padded prefixes and a short slug:

```text
01-foundation.md
02-architecture-stage.md
03-module-plan.md
```

## Task File Template

Use this structure for every generated task file:

```markdown
# Task 01 - [Short Title]

## Objective
[Exact outcome this agent must produce]

## Why This Task Exists
[How it contributes to the source plan]

## Scope
- [In scope item]
- [In scope item]

## Out Of Scope
- [Explicit non-goals]

## Likely Files Or Areas
- `src/...`
- `docs/...`

## Dependencies
- [None, or required earlier task IDs]

## Implementation Notes
- [Important constraints from the plan]
- [Repository conventions or architectural boundaries]

## Deliverables
- [Concrete artifact or behavior]
- [Concrete artifact or behavior]

## Validation
- [Command, test, or manual check]

## Suggested Agent Brief
[A compact assignment prompt for the agent who will execute this task]
```

## Quality Bar

Before finalizing the task set, verify that:

- every task has a concrete outcome
- the full plan is covered with no major gap
- dependencies are minimal and explicit
- parallelizable tasks are clearly identified
- each task can be given to one agent without extra interpretation
- validation is realistic for the scope of that task

## Response Pattern

When using this skill, first summarize the decomposition strategy in `1-2` sentences. Then create the files. After writing them, report:

- where the tasks were created
- how many tasks were generated
- the main dependency chain
- any assumptions made while splitting the plan
