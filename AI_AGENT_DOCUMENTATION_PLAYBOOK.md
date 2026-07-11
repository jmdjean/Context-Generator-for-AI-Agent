# AI Agent Documentation Playbook

A practical playbook for documenting any repository so AI coding agents can work faster, load less context, and make fewer wrong assumptions.

This guide is for people designing the documentation system around a project, not for describing one specific codebase. The job is not to generate a beautiful encyclopedia. The job is to create a reliable navigation layer between tasks, docs, and source code.

## What "good for AI agents" means

An agent-friendly documentation set should let an AI:

1. Understand what the system does in a few minutes.
2. Find the right files for a specific task without scanning the whole repo.
3. See where the risky boundaries are before editing shared code.
4. Verify claims in source instead of trusting generic prose.
5. Keep documentation aligned with code in the same session as a change.

If your docs do not help with those five outcomes, they are probably optimized for appearance instead of execution.

## Core idea

Document the repository as a retrieval system:

- Route by task, not by folder dump.
- Prefer short canonical docs over many overlapping docs.
- Link to code and source-of-truth docs instead of copying them.
- Tell the agent what to read next.

The best agent docs reduce search space. They do not try to replace the codebase.

## Non-negotiable principles

| Principle | Why it matters |
| --- | --- |
| Code is truth | If code and docs disagree, the docs are wrong. |
| Minimum context | Agents lose time and accuracy when asked to read too much. |
| One fact, one file | Duplication creates drift and contradictory answers. |
| Same-session sync | Stale agent docs are worse than missing docs. |
| Honest status | "Partial" is useful; fake completeness is dangerous. |
| Pointers over dumps | Agents should open files, not read pasted source in Markdown. |
| Real structure only | Never invent packages, domains, APIs, or frameworks. |

## The mental model

Think in layers. Each layer answers a different question.

| Layer | Question it answers | Typical contents |
| --- | --- | --- |
| `AGENTS.md` | Where do I start for this task? | Fast routing table and hard rules |
| `AI_START_HERE.md` | What is this system? | Purpose, main components, key constraints |
| `CONTEXT_ROUTER.md` | What docs should I read for this task type? | Ordered reading paths |
| `features/` | What does this user-visible capability do? | Behavior, entry points, dependencies |
| `domains/` | What business boundary owns this logic? | Rules, ownership, invariants |
| `integrations/` | How does this repo talk to outside systems? | Contracts, payloads, protocol notes |
| `impact/` | What can break if I change this? | Shared-risk checklists and consumers |
| `code/` | Which source files matter most? | Entry-point cards and module summaries |
| `docs/` | What do humans need to operate or understand? | Setup, architecture, runbooks, public contracts |

This separation is important. Human docs explain the system. Agent docs route work through the system.

## Recommended repository shape

Adapt the names to the repo. The pattern matters more than the exact paths.

```text
AGENTS.md
docs/
  index.md
  architecture.md
<agent-workspace>/
  AI_START_HERE.md
  CONTEXT_ROUTER.md
  DOCUMENTATION_MAINTENANCE.md
  DOCUMENTATION_STATUS.md
  PROJECT_MAP.md
  architecture/
  domains/
  features/
  integrations/
  impact/
  knowledge-graph/
  code/
    index.md
    components/
```

Small repositories do not need every folder. A small project can still be excellent with:

- `AGENTS.md`
- `AI_START_HERE.md`
- `CONTEXT_ROUTER.md`
- `DOCUMENTATION_MAINTENANCE.md`
- `PROJECT_MAP.md`
- `features/`
- `code/`

## What each document should do

### 1. `AGENTS.md`

This is the 30-second entry point at the repository root.

It should contain:

- A short "Working on X -> Read Y" table
- A few hard rules
- A tiny flow showing how an agent should navigate

It should not contain:

- Deep architecture explanation
- Long setup instructions
- Repeated protocol tables

### 2. `AI_START_HERE.md`

This is a once-per-session orientation doc.

It should contain:

- One paragraph describing what the system does
- A table of main components with path and role
- Critical environment variables or runtime knobs
- Links to domain, feature, and integration indexes
- Important scope boundaries or known external dependencies

It should be short enough that an agent can read it quickly and move on.

### 3. `CONTEXT_ROUTER.md`

This is the most important file in the system.

Each task category should map to a short ordered reading list, for example:

```markdown
### Mobile UI change
1. AI_START_HERE.md
2. architecture/mobile-ui.md
3. features/chat/index.md
4. code/index.md
5. DOCUMENTATION_MAINTENANCE.md
```

Good router rules:

- Order from general to specific
- Stop when enough context is loaded
- Prefer 4 to 8 steps
- Add a row only for recurring task shapes
- Send the agent to impact docs before risky shared changes

Bad router behavior:

- "Read the whole docs folder"
- Dumping every document path into one category
- Routing by team preference instead of task pattern

### 4. Feature, domain, and integration briefs

These are the working docs the router points to.

A good brief usually contains:

- Purpose
- Entry points
- Key behaviors or contracts
- Dependencies
- Out of scope
- Status or accuracy notes

Keep them specific. A brief should help an agent decide where to inspect code next.

### 5. `impact/` docs

Use these for high-risk surfaces such as:

- Shared APIs
- WebSocket or event contracts
- Auth boundaries
- Persistence schemas
- State synchronization flows
- Cross-package abstractions

An impact doc should answer:

- What depends on this
- What can break if it changes
- What must be checked before merging

### 6. `code/` component cards

Do not document every file. Document important source entry points.

Good candidates:

- App roots
- HTTP or RPC servers
- Shared protocol files
- State containers
- Navigation shells
- High-churn orchestrators
- Complex adapters

Each card should stay short and tell the agent:

- What this file or module is responsible for
- What it exposes
- What it depends on
- Which higher-level docs describe its behavior

### 7. `DOCUMENTATION_MAINTENANCE.md`

This is the rulebook for keeping docs honest after code changes.

It should define:

- Change type -> docs to update
- When to add new router categories
- What not to touch in unrelated changes
- Completion checks before finishing a task

### 8. `DOCUMENTATION_STATUS.md`

This is the trust ledger.

Use simple states like:

- `Documented`
- `Partial`
- `Missing`
- `Stale`

Never treat status as vanity scoring. Status exists so agents know how much trust to place in a document.

## Writing rules that make docs useful to AI

Write for retrieval, not for performance review.

Prefer:

- Concrete paths
- Explicit ownership
- Named contracts
- Short behavior summaries
- "See `path/to/file`" pointers
- Honest unknowns

Avoid:

- Marketing language
- Generic architecture praise
- Vague claims like "modern best practices"
- Long repeated file inventories
- Advice disconnected from actual code

## Accuracy markers

Use explicit markers when facts are incomplete:

- `Inferred from code - <path>`
- `Unknown - not verified in code`
- `[TBD]` for intentionally missing follow-up areas

These markers are important. They teach the agent how much confidence to assign to the doc.

## Bootstrapping a project from zero

If a repo has no agent docs yet, build them in this order.

### Phase 0: inventory

Inspect only enough to understand the structure:

1. Root README
2. Package manifests
3. Top-level apps, packages, and services
4. Run scripts and env samples
5. Shared contract files such as OpenAPI, protobuf, schema, or shared types

Do not start by generating dozens of folders.

### Phase 1: build the routing skeleton

Create the minimum system:

1. `AGENTS.md`
2. `AI_START_HERE.md`
3. `CONTEXT_ROUTER.md`
4. `DOCUMENTATION_MAINTENANCE.md`
5. `DOCUMENTATION_STATUS.md`
6. `PROJECT_MAP.md`

At this stage, the goal is safe navigation, not completeness.

### Phase 2: document high-risk reality

Next, document the areas where wrong edits are most expensive:

1. External integrations
2. Shared protocols
3. Auth and security boundaries
4. Persistence and migrations
5. Core user-facing flows

### Phase 3: add code cards where routing keeps landing

If multiple task routes repeatedly end in the same source files, create component cards for those files.

### Phase 4: connect human docs

Link agent docs to human-facing docs for:

- setup
- architecture
- operational runbooks
- public contracts

Link instead of copying.

## How to decide what deserves its own document

Create a dedicated brief when one of these is true:

- Multiple tasks touch the same concept
- The concept crosses folders or packages
- A change can break several consumers
- The code boundary is non-obvious
- The agent would otherwise need repeated broad searches

Do not create a doc just because a folder exists.

## Review checklist for an existing doc set

Use these questions when auditing a repo:

1. Can an agent explain the product from `AI_START_HERE.md` alone?
2. Does `CONTEXT_ROUTER.md` cover the top recurring task categories?
3. Do shared-risk areas have impact docs?
4. Are major claims verified by code, manifests, or contracts?
5. Are there duplicated facts across `README`, `AGENTS.md`, and feature docs?
6. Does maintenance guidance clearly tell the agent what to update after a change?
7. Are status labels honest?
8. Would an agent know which file to open next after reading each doc?

If the answer to the last question is "no," the doc is probably descriptive but not operational.

## Common anti-patterns

### 1. Template farms

Many files exist, but all of them say nearly the same thing.

Why this fails:

- Agents still need to search broadly
- Important facts are buried in boilerplate
- Maintainers stop trusting the docs

### 2. Fake completeness

Examples:

- "Frameworks: none" when imports clearly show a framework
- "Documented" labels on guessed docs
- Dependency maps with no verified edges presented as final

Why this fails:

- Agents trust confident lies
- Bad docs create bad changes faster

### 3. Folder mirrors instead of task routes

This happens when docs simply reflect the repository tree.

Why this fails:

- Real work is task-shaped, not folder-shaped
- Agents need decision paths, not a prettier `ls`

### 4. Generic AI enrichment

Examples:

- "This project uses scalable architecture"
- "Follow best practices"
- "Consider improving maintainability"

Why this fails:

- It adds tokens without adding navigation value
- It often ignores the actual stack and constraints

### 5. Copy-pasted canonical facts

Examples:

- The same API table appears in `README`, `AGENTS.md`, and three feature docs
- Env vars are repeated in multiple places with slight drift

Why this fails:

- The repo now has several competing truths

## Quality bar

A project is meaningfully agent-ready when:

- An agent can identify system purpose quickly
- The main task types have specific routes
- High-risk shared surfaces are called out explicitly
- Important code entry points are discoverable without broad search
- Documentation status reflects reality
- Behavior changes trigger doc updates in the same session
- No critical fact exists in multiple conflicting places

Agent-ready does not mean "fully documented." It means "safe and efficient to navigate."

## Minimal templates

### `AGENTS.md`

```markdown
# Agent Router

Load minimum context. Do not read the full repository.

## Working on X -> Read Y

| Task | Start here |
| --- | --- |
| Any task | `<agent-workspace>/CONTEXT_ROUTER.md` |
| First session | `<agent-workspace>/AI_START_HERE.md` |
| Code entry points | `<agent-workspace>/code/index.md` |
| After behavior change | `<agent-workspace>/DOCUMENTATION_MAINTENANCE.md` |

## Hard Rules

1. Code wins over docs.
2. Route before broad search.
3. One fact, one file.
4. Sync docs in the same session as behavior changes.

## Flow

User task -> AGENTS.md -> AI_START_HERE -> CONTEXT_ROUTER -> specific docs -> code -> implement -> documentation maintenance
```

### Feature brief

```markdown
# Feature: <Name>

## Purpose
<2 to 4 sentences. Inferred from code - <paths>>

## Entry Points
| Path | Role |
| --- | --- |
| `...` | ... |

## Key Behavior
- ...

## Dependencies
- ...

## Out of Scope
- ...

## Status
Partial
```

### Component card

```markdown
# Component: <Path or module name>

## Responsibility
<Short summary>

## Public Surface
- Exports:
- Routes:
- Messages:

## Dependencies
- Internal:
- External:

## Related Docs
- features/...
- integrations/...
```

## Prompt to give another AI

Use this when asking an AI to create or repair agent-facing docs in a repository:

> Document this repository for AI coding agents using a minimum-context navigation system. Discover structure from code, manifests, and verified contracts only. Do not invent frameworks, modules, or dependencies. Create a small but reliable agent workspace with `AGENTS.md`, `AI_START_HERE.md`, `CONTEXT_ROUTER.md`, `DOCUMENTATION_MAINTENANCE.md`, `DOCUMENTATION_STATUS.md`, and `PROJECT_MAP.md`, then deepen only the high-risk areas such as integrations, shared protocols, auth, persistence, and key feature flows. Prefer accurate partial docs over polished but wrong prose. Link to human docs instead of duplicating them. After any behavior change, update affected agent docs in the same session.

## Final rule

Good AI documentation is not a static knowledge dump. It is an operating map for real tasks in a real codebase.

If a document does not help an agent decide what to read, what to verify, or what can break, make it smaller, sharper, and more connected to source.
