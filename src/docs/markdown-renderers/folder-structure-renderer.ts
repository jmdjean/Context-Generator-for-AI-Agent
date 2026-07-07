import { PlannedDocument } from '../../domain/documentation-plan';
import { FolderClassification, FolderKnowledge, ProjectKnowledge } from '../../knowledge';
import {
  displayRelativePath,
  finishDocument,
  formatInlineCodeList,
  humanizeIdentifier,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

const CLASSIFICATION_ORDER: ReadonlyArray<FolderClassification> = [
  'source',
  'test',
  'config',
  'documentation',
  'scripts',
  'tooling',
  'asset',
  'build-output',
  'dependency-cache',
  'unknown',
];

const IGNORED_PATHS_LIMIT = 15;

function renderFolderEntry(folder: FolderKnowledge): string[] {
  const lines = [
    `- ${inlineCode(displayRelativePath(folder.relativePath))} — ${folder.responsibility} (confidence: ${folder.confidence})`,
  ];

  if (folder.importantFiles.length > 0) {
    lines.push(`  - Important files: ${formatInlineCodeList(folder.importantFiles)}`);
  }
  if (folder.childFolders.length > 0) {
    lines.push(`  - Child folders: ${formatInlineCodeList(folder.childFolders)}`);
  }
  return lines;
}

function renderClassificationSections(folderContexts: FolderKnowledge[]): string[] {
  const lines: string[] = [];
  for (const classification of CLASSIFICATION_ORDER) {
    const folders = folderContexts.filter((folder) => folder.classification === classification);
    if (folders.length === 0) {
      continue;
    }

    lines.push('');
    lines.push(`### ${humanizeIdentifier(classification)} folders`);
    lines.push('');
    for (const folder of folders) {
      lines.push(...renderFolderEntry(folder));
    }
  }
  return lines;
}

function renderFolderContextsSection(folderContexts: FolderKnowledge[] | undefined): string[] {
  const lines = ['', '## Folder contexts', ''];

  if (!folderContexts || folderContexts.length === 0) {
    lines.push('No folder contexts are available yet. Folder analysis has not run for this snapshot.');
    return lines;
  }

  lines.push(`The folder analyzer documented ${folderContexts.length} folder(s). Each entry below carries a deterministic classification and an inferred responsibility.`);
  lines.push(...renderClassificationSections(folderContexts));
  return lines;
}

function renderIgnoredFoldersSection(knowledge: ProjectKnowledge): string[] {
  const lines = [
    '',
    '## Documentable vs ignored folders',
    '',
    'Not every folder is documented. The analyzer skips folders that carry no architectural meaning for agents:',
    '',
    '- Dependency caches (`node_modules`) and version control internals (`.git`).',
    '- Build outputs (`dist`, `build`, `coverage`) — generated artifacts, never edited directly.',
    '- The generated knowledge directory inside the docs folder.',
  ];

  const ignoredPaths = knowledge.repository.ignoredPaths;
  if (ignoredPaths.length > 0) {
    lines.push('');
    lines.push('Ignore patterns applied during the repository scan:');
    lines.push('');
    for (const ignoredPath of ignoredPaths.slice(0, IGNORED_PATHS_LIMIT)) {
      lines.push(`- ${inlineCode(ignoredPath)}`);
    }
    if (ignoredPaths.length > IGNORED_PATHS_LIMIT) {
      lines.push(`- …and ${ignoredPaths.length - IGNORED_PATHS_LIMIT} more`);
    }
  }

  return lines;
}

export function renderFolderStructureDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [
    ...renderDocumentHeader(document, knowledge),
    ...renderFolderContextsSection(knowledge.analysis.folderContexts),
    ...renderIgnoredFoldersSection(knowledge),
  ];

  return finishDocument(lines);
}
