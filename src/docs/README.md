# src/docs

**Responsibility:** Writing the `.ai-docs/` documentation folder into the target repository.

This module takes structured documentation content (produced by `src/ai/`) and writes it to disk. It owns the output folder structure, file naming, and incremental update logic.

## What belongs here

- Creating and managing the `.ai-docs/` output directory.
- Writing individual documentation sections to files.
- Incremental update strategy: comparing new content to existing files and only rewriting sections that changed.
- Any formatting applied to the output (Markdown structure, front matter, etc.).

## What does NOT belong here

- Generating documentation content — that belongs in `ai/`.
- Reading the target repository — that belongs in `scanner/`.
- Configuration parsing.

## Current status

Not yet implemented. Placeholder for the documentation writing layer.

## Expected output structure (planned)

```
<target-repo>/
└── .ai-docs/
    ├── project-overview.md
    ├── navigation-guide.md
    ├── folder-structure.md
    ├── conventions.md
    ├── dependency-map.md
    └── recent-changes.md
```

## Expected interface (planned)

```typescript
export interface DocumentationContent {
  [sectionName: string]: string;
}

export async function writeDocumentation(
  targetPath: string,
  content: DocumentationContent
): Promise<void>
```
