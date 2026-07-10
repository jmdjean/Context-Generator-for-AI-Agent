# src/templates

**Responsibility:** Lightweight template engine for generated documentation. Separates PKM data, document renderers, Markdown templates, and file writing.

This module is **presentation only**. Templates consume `ProjectKnowledge`, render deterministic Markdown strings, and return results to the documentation writer. They never scan the repository, call AI, or write files.

---

## Pipeline position

```
DocumentationPlan + ProjectKnowledge
        ↓
   TemplateEngine (this module)
        ↓
   Rendered documents (content only)
        ↓
   DocumentationWriter (src/docs/)
        ↓
   .ai-docs/*.md
```

The PKM remains the source of truth. Templates translate PKM sections into Markdown. The writer handles path resolution, generated-file protection, and disk I/O.

---

## Files

| File | Role |
|---|---|
| `template-context.ts` | `TemplateContext`, `TemplateDefinition`, `TemplateRenderResult` contracts |
| `template-registry.ts` | Lookup for registered templates by output path |
| `markdown-template.ts` | Built-in Markdown template definitions wrapping PKM renderers |
| `template-engine.ts` | `buildTemplateContext()`, `renderDocumentWithTemplate()`, `renderDocumentationPlan()` |
| `template-engine.test.ts` | Registry and rendering tests |

---

## Template contract

```typescript
interface TemplateContext {
  knowledge: ProjectKnowledge;
  generatedAt: string;
  docsDir: string;
}

interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  outputPath: string;
  render(context: TemplateContext, document: PlannedDocument): string;
}

interface TemplateRenderResult {
  outputPath: string;
  content: string;
  templateId: string;
  generatedAt: string;
}
```

Templates receive PKM data through `TemplateContext` and planned-document metadata through the `document` argument passed by the template engine.

---

## Built-in Markdown templates

| Template ID | Output | Renderer (implementation) |
|---|---|---|
| `markdown.architecture` | `architecture.md` | `architecture-renderer.ts` |
| `markdown.folder-structure` | `folder-structure.md` | `folder-structure-renderer.ts` |
| `markdown.dependency-map` | `dependency-map.md` | `dependency-map-renderer.ts` |
| `markdown.conventions` | `conventions.md` | `conventions-renderer.ts` |
| `markdown.agent-navigation` | `agent-navigation.md` | `agent-navigation-renderer.ts` |
| `markdown.ai-context` | `ai-context.md` | `ai-context-renderer.ts` |
| `markdown.implementation-guide` | `implementation-guide.md` | `implementation-guide-renderer.ts` |
| `markdown.ai-readiness` | `ai-readiness.md` | `src/readiness/ai-readiness-renderer.ts` |
| `markdown.generic` | *(fallback)* | `document-template.ts` |

Documents without a registered template use `markdown.generic`. Technology-specific and agent docs (`README.md`, `AGENTS.md`, etc.) continue to use the generic fallback until they get dedicated templates.

Renderers live in `src/docs/markdown-renderers/` as small, deterministic functions (the AI readiness renderer lives with its feature in `src/readiness/` and is registered here). Templates wrap those renderers today; future user-customizable templates can replace or extend the registry without changing the writer.

The `markdown.ai-readiness` template is presentation-only like every other template: it renders the deterministic AI Readiness Score already stored in `analysis.aiReadiness` and never calculates, rescans, or calls AI. During the main documentation pass (before the readiness step has run) it renders an honest placeholder; the `Calculate AI Readiness` pipeline step re-renders the document through this same template once the score exists.

---

## Rules

- Templates consume **PKM only** — no `RuntimeConfig`, no filesystem reads, no OpenRouter calls.
- Templates must be **deterministic**: the same PKM snapshot always yields the same Markdown.
- Templates **do not write files** — `src/docs/documentation-writer.ts` owns disk output and generated-file protection.
- Renderers behind templates must not perform repository analysis — facts come from analyzers and the PKM.

---

## Adding a new template

1. Implement a renderer in `src/docs/markdown-renderers/<name>-renderer.ts` that reads only from `ProjectKnowledge`.
2. Register a `TemplateDefinition` in `markdown-template.ts`.
3. Add assertions to `template-engine.test.ts` and `markdown-renderers.test.ts`.
4. Update `src/docs/README.md` and architecture docs if the document is a key agent context file.

User-provided custom templates are not supported yet. The registry is internal and built-in only for v1.

---

## What belongs here

- Template contracts and registry.
- Built-in Markdown template definitions.
- Rendering orchestration (PKM → content string).

## What does NOT belong here

- Documentation planning — `src/docs/documentation-planner.ts`.
- File writing and overwrite policy — `src/docs/documentation-writer.ts`.
- PKM assembly or persistence — `src/knowledge/`.
- Repository analysis — `src/analyzers/` and plugins.
