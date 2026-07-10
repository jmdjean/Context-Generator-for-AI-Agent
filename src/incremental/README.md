# src/incremental



**Responsibility:** Incremental state loading, deterministic change detection, and selective documentation impact analysis between pipeline runs.



This module compares the current in-memory `ProjectKnowledge` against the previously persisted snapshot on disk, records what changed, and maps PKM section diffs to Markdown documents that need regeneration.



---



## Why this module exists



Context Engineering outputs are expensive to produce. The tool needs a reliable way to answer: *what changed since the last run?* and *which generated docs depend on those changes?*



The persisted PKM at `.ai-docs/knowledge/project-knowledge.json` is the baseline. Each run builds a fresh PKM in memory, loads the on-disk snapshot (if any), produces a `ChangeSummary`, then derives a `DocumentImpactSummary` for the documentation writer.



---



## Files



| File | Role |

|---|---|

| `change-summary.ts` | Re-exports `ChangeSummary` types from the PKM |

| `state-loader.ts` | Safe read of previous `project-knowledge.json` with baseline validation |

| `change-detector.ts` | Deterministic PKM section comparison |

| `change-summary-formatter.ts` | Run-summary formatting for change detection output |

| `document-impact-analyzer.ts` | Maps `changedSections` to impacted Markdown documents |
| `document-impact-formatter.ts` | Run-summary formatting for document impact output |

| `index.ts` | Enrichment helpers and public exports |



---



## Pipeline integration



Step **Detect Changes** runs after **Analyze AI Insights** and before **Write Documentation**:



1. Load previous PKM from `.ai-docs/knowledge/project-knowledge.json` (if it exists).

2. Compare previous vs current PKM sections.

3. Store the result in `analysis.changeSummary`.

4. Analyze document impact from the change summary and store `analysis.documentImpact`.

5. **Write Documentation** uses `documentImpact` to regenerate only impacted tool-managed files (all planned docs on initial run).

6. Persist split files during **Persist Project Knowledge** (`change-summary.json`, `document-impact.json`).



If no previous PKM exists, the run is treated as an initial generation (`baselineStatus: none`) and all planned documents are marked for regeneration.



If a snapshot exists but is unreadable, the run reports `baselineStatus: unreadable`, keeps `isInitialRun: false`, and skips comparison.



If the snapshot belongs to a different repository root, it is ignored (`baselineStatus: repository-mismatch`) and the run is treated as initial with a warning.



---



## Detected sections



| Section | What is compared |

|---|---|

| `detectedFiles` | Sorted `repository.detectedFiles` |

| `repositoryTree` | Sorted relative paths in the repository tree |

| `technologies` | Technology tokens and confidence |

| `folderContexts` | Folder paths and normalized folder content |

| `modules` | Module paths and normalized module content |

| `dependencyGraph` | Node signatures plus normalized edge evidence and confidence |

| `conventions` | Normalized convention entries including evidence |

| `navigationMap` | Normalized navigation entries |

| `aiInsights` | Normalized insight content (ignores `generatedAt`) |
| `documentation` | Documentation plan strategy/document list and `metadata.generatorVersion` |



The state loader strips `analysis.changeSummary`, `analysis.documentImpact`, and `analysis.agentExports` from the previous snapshot before comparison, and rejects snapshots whose `repository.rootPath` does not match the current target repository.



---



## Document impact mapping



`document-impact-analyzer.ts` maps changed PKM sections to Markdown documents in the documentation plan:



| Changed section | Regenerated documents |
|---|---|
| `detectedFiles` | `README.md`, `change-log.md`, `technology-overview.md` (when planned) |
| `repositoryTree` | `folder-structure.md`, `architecture.md`, `ai-context.md`, `agent-navigation.md` |
| `technologies` | `architecture.md`, `ai-context.md`, `implementation-guide.md`, plus all `source: technology` planned docs |
| `folderContexts` | `folder-structure.md`, `architecture.md`, `ai-context.md`, `agent-navigation.md` |

| `modules` | `architecture.md`, `dependency-map.md`, `ai-context.md`, `implementation-guide.md` |

| `dependencyGraph` | `dependency-map.md`, `architecture.md`, `ai-context.md` |

| `conventions` | `conventions.md`, `implementation-guide.md`, `ai-context.md`, `agent-navigation.md` |

| `navigationMap` | `agent-navigation.md`, `ai-context.md` |

| `aiInsights` | `architecture.md`, `ai-context.md`, `implementation-guide.md`, `agent-navigation.md` |
| `documentation` | All planned documents (plan or generator version changed) |

On `isInitialRun: true`, unreadable baseline, or `documentation` changes, every planned document is marked for regeneration.

When any other mapped section changes, `change-log.md` is also regenerated. Documents listed in `dependsOn` are invalidated transitively when an upstream planned document is impacted.



---



## What this module does not do



- File watching or background monitoring

- Git integration

- OpenRouter calls

- Filesystem writes (persistence belongs in `src/knowledge/knowledge-writer.ts`)

- Delete generated or user-managed documentation



Selective regeneration is based on PKM section changes from the previous persisted snapshot — not on filesystem events or git history.



---



## Constraints



- Deterministic and lightweight — sorted comparisons and stable serialization, no heavy dependencies.

- Read-only access to the previous PKM file through `resolveKnowledgeFilePath()`.

- Invalid or corrupt previous snapshots are ignored (treated as initial run).

- User-created docs without the generated marker remain preserved by the writer regardless of impact analysis.


