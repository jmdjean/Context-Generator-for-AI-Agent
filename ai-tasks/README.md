# AI Tasks — Agent Docs Quality

Source plan: [`AGENT_DOCS_QUALITY_PLAN.md`](../AGENT_DOCS_QUALITY_PLAN.md)

## Summary

Make `ai-project-docs` generate **stack-agnostic** agent navigation docs (START_HERE → router → module cards) for any repository. Fix multi-manifest module discovery first, add operational PKM facts, expand AI mapping stages, then upgrade playbook renderers. Jarvis is a smoke target and UX reference only — never hardcode Angular/Electron/product partitions into core.

## Ordered task list

| ID | File | Title | Depends on |
|---|---|---|---|
| 01 | [01-multi-manifest-module-discovery.md](01-multi-manifest-module-discovery.md) | Multi-manifest module discovery | — |
| 02 | [02-operational-context-pkm.md](02-operational-context-pkm.md) | Operational context in PKM | 01 |
| 03 | [03-nested-technology-detection.md](03-nested-technology-detection.md) | Nested package technology detection | 01 |
| 04 | [04-architecture-stage-upgrade.md](04-architecture-stage-upgrade.md) | Architecture AI stage schema upgrade | 01, 02 |
| 05 | [05-capability-map-and-router-stages.md](05-capability-map-and-router-stages.md) | Capability map + router AI stages | 01, 04 |
| 06 | [06-module-docs-fanout-and-cards.md](06-module-docs-fanout-and-cards.md) | Module AI fan-out + structured cards | 01 |
| 07 | [07-playbook-entry-renderers.md](07-playbook-entry-renderers.md) | AI_START_HERE, AGENTS, CONTEXT_ROUTER | 02, 04, 05, 06 |
| 08 | [08-planner-capability-docs.md](08-planner-capability-docs.md) | code/index + feature/integration stubs | 05, 07 |
| 09 | [09-multi-target-verification.md](09-multi-target-verification.md) | Multi-target verification | 01–08 |

## Dependency chain

```text
01 ──┬──► 02 ──┐
     ├──► 03   ├──► 04 ──► 05 ──┐
     └──► 06 ──┘                ├──► 07 ──► 08 ──► 09
                                └──(06 already done)─┘
```

## Suggested parallel groups

| Group | Tasks | Notes |
|---|---|---|
| A | **01** alone | Blocks almost everything |
| B | **02**, **03**, **06** | After 01; different modules |
| C | **04** then **05** | Sequential AI stage work |
| D | **07** then **08** | Renderers then planner expansion |
| E | **09** alone | Final validation |

## Constraints (all agents)

- English-only project artifacts
- Generators/renderers consume `ProjectKnowledge` only
- Analyzers use `RepositoryBoundary` for safe config reads — no arbitrary source scrape
- Do not hardcode Angular, Java, C#, Electron, or jarvis product partitions in core
- Framework-specific depth → `src/plugins/technology/`
- Prefer honest `Unknown` / `Partial` over invented facts
- `npm run build` and targeted `npm test` before marking a task done
