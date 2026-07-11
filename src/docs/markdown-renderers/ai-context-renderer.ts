import { PlannedDocument } from '../../domain/documentation-plan';
import { ConventionKnowledge, ModuleKnowledge, ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  formatInlineList,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';
import { hasRenderableAiInsights } from './ai-insights-renderer';
import { renderArchitectureEnrichmentSection } from './staged-architecture-renderer';

const KEY_ENTRY_LIMIT = 8;

const READ_FIRST_ORDER: ReadonlyArray<string> = [
  'AGENTS.md',
  'architecture.md',
  'agent-navigation.md',
  'folder-structure.md',
  'conventions.md',
];

function renderPkmSummarySection(knowledge: ProjectKnowledge): string[] {
  const { analysis, technologies, documentation } = knowledge;
  return [
    '',
    '## PKM summary',
    '',
    `- Languages: ${formatInlineList(technologies.languages)}`,
    `- Frameworks: ${formatInlineList(technologies.frameworks)}`,
    `- Planned documents: ${documentation.plan.documents.length}`,
    `- Folder contexts: ${analysis.folderContexts?.length ?? 0}`,
    `- Modules: ${analysis.modules?.length ?? 0}`,
    `- Dependency graph: ${analysis.dependencyGraph?.nodes.length ?? 0} node(s), ${analysis.dependencyGraph?.edges.length ?? 0} edge(s)`,
    `- Conventions: ${analysis.conventions?.length ?? 0}`,
    `- Navigation entries: ${analysis.navigationMap?.entries.length ?? 0}`,
  ];
}

function renderReadFirstSection(knowledge: ProjectKnowledge): string[] {
  const plannedPaths = new Set(
    knowledge.documentation.plan.documents.map((planned) => planned.relativePath),
  );
  const readingList = READ_FIRST_ORDER.filter((relativePath) => plannedPaths.has(relativePath));

  const lines = ['', '## What to read first', ''];
  if (readingList.length === 0) {
    lines.push('The documentation plan does not include the standard entry documents yet.');
    return lines;
  }

  readingList.forEach((relativePath, index) => {
    lines.push(`${index + 1}. ${inlineCode(relativePath)}`);
  });
  lines.push('');
  lines.push('Then use `agent-navigation.md` to pick the right documents for your specific task instead of reading everything.');
  return lines;
}

function renderKeyModulesSection(modules: ModuleKnowledge[] | undefined): string[] {
  const lines = ['', '## Key modules', ''];

  if (!modules || modules.length === 0) {
    lines.push('No modules are known yet. Module analysis has not run for this snapshot.');
    return lines;
  }

  const highConfidence = modules.filter((module) => module.confidence === 'high');
  const keyModules = (highConfidence.length > 0 ? highConfidence : modules).slice(0, KEY_ENTRY_LIMIT);

  for (const module of keyModules) {
    lines.push(`- ${inlineCode(module.relativePath)} (${module.type}) — ${module.responsibility}`);
  }
  if (modules.length > keyModules.length) {
    lines.push(`- …and ${modules.length - keyModules.length} more in \`architecture.md\``);
  }
  return lines;
}

function renderKeyConventionsSection(conventions: ConventionKnowledge[] | undefined): string[] {
  const lines = ['', '## Key conventions', ''];

  if (!conventions || conventions.length === 0) {
    lines.push('No conventions are known yet. Convention analysis has not run for this snapshot.');
    return lines;
  }

  const highConfidence = conventions.filter((convention) => convention.confidence === 'high');
  const keyConventions = (highConfidence.length > 0 ? highConfidence : conventions).slice(0, KEY_ENTRY_LIMIT);

  for (const convention of keyConventions) {
    lines.push(`- **${convention.name}** — ${convention.description}`);
  }
  if (conventions.length > keyConventions.length) {
    lines.push(`- …and ${conventions.length - keyConventions.length} more in \`conventions.md\``);
  }
  return lines;
}

function renderLimitationsSection(knowledge: ProjectKnowledge): string[] {
  const lines = ['', '## Current limitations', ''];

  const hasStagedArchitecture =
    knowledge.analysis.stagedDocumentation?.architecture !== undefined &&
    (knowledge.analysis.stagedDocumentation.architecture.content !== undefined ||
      knowledge.analysis.stagedDocumentation.architecture.summary !== undefined);

  if (hasStagedArchitecture || hasRenderableAiInsights(knowledge.analysis.aiInsights)) {
    lines.push(
      '- Deterministic analysis remains authoritative. Staged architecture / AI enrichment above is not ground truth — verify against code when behavior matters.',
    );
  } else {
    lines.push(
      '- Everything in this context layer comes from deterministic analysis. Pass `--ai` with an OpenRouter API key for optional AI enrichment.',
    );
  }

  lines.push(
    '- Dependency edges come from lightweight regex import parsing — dynamic imports and path aliases are not detected.',
    '- Folder responsibilities and module types are inferred from structural naming heuristics, not from reading file contents.',
    '- Cross-check code-level details in source files when a task depends on exact behavior.',
  );
  return lines;
}

export function renderAiContextDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [
    ...renderDocumentHeader(document, knowledge),
    ...renderPkmSummarySection(knowledge),
    ...renderReadFirstSection(knowledge),
    ...renderKeyModulesSection(knowledge.analysis.modules),
    ...renderKeyConventionsSection(knowledge.analysis.conventions),
    ...renderArchitectureEnrichmentSection(knowledge),
    ...renderLimitationsSection(knowledge),
  ];

  return finishDocument(lines);
}
