import { PlannedDocument } from '../../domain/documentation-plan';
import { FolderKnowledge, ModuleKnowledge, ProjectKnowledge } from '../../knowledge';
import {
  displayRelativePath,
  finishDocument,
  inlineCode,
  renderDocumentHeader,
  tableCell,
} from './render-helpers';

const ENTRY_DOC_PATHS: ReadonlyArray<string> = [
  'AGENTS.md',
  'AI_START_HERE.md',
  'CONTEXT_ROUTER.md',
  'architecture.md',
  'PROJECT_MAP.md',
  'module-documentation-plan.md',
];

function renderEntryPoints(knowledge: ProjectKnowledge): string[] {
  const planned = new Set(
    knowledge.documentation.plan.documents.map((document) => document.relativePath),
  );
  const lines = ['', '## Documentation entry points', ''];
  const available = ENTRY_DOC_PATHS.filter((relativePath) => planned.has(relativePath));

  if (available.length === 0) {
    lines.push('No standard entry documents are in the current plan yet.');
    return lines;
  }

  available.forEach((relativePath, index) => {
    lines.push(`${index + 1}. ${inlineCode(relativePath)}`);
  });
  return lines;
}

function renderModulesMap(modules: ModuleKnowledge[] | undefined): string[] {
  const lines = ['', '## Modules', ''];

  if (!modules || modules.length === 0) {
    lines.push('No modules discovered yet.');
    return lines;
  }

  lines.push('| Module | Type | Responsibility |');
  lines.push('|---|---|---|');
  for (const module of modules) {
    lines.push(
      `| ${inlineCode(module.relativePath)} | ${module.type} | ${tableCell(module.responsibility)} |`,
    );
  }
  return lines;
}

function renderFoldersMap(folders: FolderKnowledge[] | undefined): string[] {
  const lines = ['', '## Important folders', ''];

  if (!folders || folders.length === 0) {
    lines.push('No folder contexts are available yet.');
    return lines;
  }

  const topLevel = folders
    .filter((folder) => folder.depth <= 2)
    .slice()
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  lines.push('| Folder | Classification | Responsibility |');
  lines.push('|---|---|---|');
  for (const folder of topLevel.slice(0, 24)) {
    lines.push(
      `| ${inlineCode(displayRelativePath(folder.relativePath))} | ${folder.classification} | ${tableCell(folder.responsibility)} |`,
    );
  }
  if (topLevel.length > 24) {
    lines.push('');
    lines.push(`…and ${topLevel.length - 24} more in \`folder-structure.md\`.`);
  }
  return lines;
}

function renderModuleDocIndex(knowledge: ProjectKnowledge): string[] {
  const moduleDocs = knowledge.documentation.plan.documents.filter(
    (document) => document.stage === 'module' || document.source === 'module',
  );
  const lines = ['', '## Module documentation index', ''];

  if (moduleDocs.length === 0) {
    lines.push('Per-module documents are not in the plan yet. Run module-plan expansion first.');
    return lines;
  }

  for (const document of moduleDocs) {
    const label = document.moduleName ?? document.title;
    lines.push(`- ${inlineCode(document.relativePath)} — ${label}`);
  }
  return lines;
}

export function renderProjectMapDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [
    ...renderDocumentHeader(document, knowledge),
    '',
    'Compact map of modules, folders, and documentation entry points derived from the PKM.',
    ...renderEntryPoints(knowledge),
    ...renderModulesMap(knowledge.analysis.modules),
    ...renderFoldersMap(knowledge.analysis.folderContexts),
    ...renderModuleDocIndex(knowledge),
  ];

  return finishDocument(lines);
}
