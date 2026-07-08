import * as path from 'node:path';
import {
  formatInlineCodeList,
  formatInlineList,
  humanizeIdentifier,
  inlineCode,
} from '../docs/markdown-renderers/render-helpers';
import {
  ConventionKnowledge,
  DependencyGraphKnowledge,
  getDocumentationPlan,
  ModuleKnowledge,
  NavigationEntry,
  ProjectKnowledge,
} from '../knowledge';
import { formatDocsRelativePath } from './exporter-paths';

export const EXPORT_READ_FIRST_ORDER: ReadonlyArray<string> = [
  'AGENTS.md',
  'architecture.md',
  'agent-navigation.md',
  'folder-structure.md',
  'conventions.md',
];

export const EXPORT_CONVENTION_LIMIT = 12;
export const EXPORT_DEPENDENCY_EDGE_LIMIT = 8;

export function plannedDocumentPaths(knowledge: ProjectKnowledge): ReadonlySet<string> {
  return new Set(getDocumentationPlan(knowledge).documents.map((document) => document.relativePath));
}

export function renderProjectAnalysisStats(knowledge: ProjectKnowledge): string[] {
  const { analysis, technologies, documentation } = knowledge;
  return [
    `- Languages: ${formatInlineList(technologies.languages)}`,
    `- Frameworks: ${formatInlineList(technologies.frameworks)}`,
    `- Package managers: ${formatInlineList(technologies.packageManagers)}`,
    `- Tooling: ${formatInlineList(technologies.tooling)}`,
    `- Detection confidence: ${technologies.confidence}`,
    `- Planned documents: ${documentation.plan.documents.length}`,
    `- Folder contexts: ${analysis.folderContexts?.length ?? 0}`,
    `- Modules: ${analysis.modules?.length ?? 0}`,
    `- Conventions: ${analysis.conventions?.length ?? 0}`,
    `- Navigation entries: ${analysis.navigationMap?.entries.length ?? 0}`,
  ];
}

export interface ReadingOrderSectionOptions {
  title: string;
  includePackReference?: string;
}

export function renderReadingOrderSection(
  knowledge: ProjectKnowledge,
  options: ReadingOrderSectionOptions,
): string[] {
  const docsDir = knowledge.metadata.docsDir;
  const plannedPaths = plannedDocumentPaths(knowledge);
  const readingList = EXPORT_READ_FIRST_ORDER.filter((relativePath) => plannedPaths.has(relativePath));
  const lines = ['', `## ${options.title}`, ''];

  if (readingList.length === 0) {
    lines.push('The documentation plan does not include the standard entry documents yet.');
    return lines;
  }

  readingList.forEach((relativePath, index) => {
    lines.push(`${index + 1}. ${inlineCode(formatDocsRelativePath(docsDir, relativePath))}`);
  });

  if (plannedPaths.has('agent-navigation.md')) {
    lines.push(
      '',
      `Then load ${inlineCode(formatDocsRelativePath(docsDir, 'agent-navigation.md'))} to pick task-specific documents instead of reading everything.`,
    );
  } else {
    lines.push(
      '',
      'Use the task navigation section below to pick task-specific documents instead of reading everything.',
    );
  }

  lines.push(
    '',
    `For machine-readable context, start with ${inlineCode(formatDocsRelativePath(docsDir, 'knowledge/project-knowledge.json'))}.`,
  );

  if (options.includePackReference !== undefined) {
    lines.push(
      '',
      `This pack (${inlineCode(formatDocsRelativePath(docsDir, options.includePackReference))}) is a single-file summary you can attach when an agent cannot load the full docs folder.`,
    );
  }

  return lines;
}

export function renderNavigationEntry(entry: NavigationEntry): string[] {
  const lines = [
    '',
    `### ${humanizeIdentifier(entry.taskType)}`,
    '',
    entry.description,
    '',
    `- Recommended PKM knowledge: ${formatInlineCodeList(entry.recommendedKnowledge, 'None')}`,
    `- Recommended documents: ${formatInlineCodeList(entry.recommendedDocuments, 'None')}`,
    `- Related modules: ${formatInlineCodeList(entry.relatedModules, 'None resolved')}`,
    `- Related folders: ${formatInlineCodeList(entry.relatedFolders, 'None resolved')}`,
    `- Confidence: ${entry.confidence}`,
  ];

  if (entry.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of entry.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines;
}

export function renderNavigationMapSection(
  knowledge: ProjectKnowledge,
  title = 'Navigation map by task type',
): string[] {
  const navigationMap = knowledge.analysis.navigationMap;
  const lines = ['', `## ${title}`, ''];

  if (!navigationMap || navigationMap.entries.length === 0) {
    lines.push('The AI navigation map has not been built for this snapshot.');
    return lines;
  }

  lines.push(
    'Match your current task to an entry below, then load only the recommended PKM sections and documents.',
  );

  for (const entry of navigationMap.entries) {
    lines.push(...renderNavigationEntry(entry));
  }

  return lines;
}

export function renderConventionSummarySection(
  conventions: ConventionKnowledge[] | undefined,
  docsDir: string,
  plannedPaths: ReadonlySet<string>,
  options: { title?: string; limit?: number } = {},
): string[] {
  const title = options.title ?? 'Convention summary';
  const limit = options.limit ?? EXPORT_CONVENTION_LIMIT;
  const lines = ['', `## ${title}`, ''];

  if (!conventions || conventions.length === 0) {
    lines.push('No conventions are known yet. Convention analysis has not run for this snapshot.');
    return lines;
  }

  const highConfidence = conventions.filter((convention) => convention.confidence === 'high');
  const keyConventions = (highConfidence.length > 0 ? highConfidence : conventions).slice(0, limit);

  for (const convention of keyConventions) {
    lines.push(
      `- **${convention.name}** (${convention.category}, ${convention.confidence}) — ${convention.description}`,
    );
  }

  if (conventions.length > keyConventions.length) {
    const suffix = plannedPaths.has('conventions.md')
      ? `more in ${inlineCode(formatDocsRelativePath(docsDir, 'conventions.md'))}`
      : 'more in the full PKM';
    lines.push(`- …and ${conventions.length - keyConventions.length} ${suffix}`);
  }

  return lines;
}

export function renderDependencySummarySection(
  graph: DependencyGraphKnowledge | undefined,
  docsDir: string,
  plannedPaths: ReadonlySet<string>,
  edgeLimit = EXPORT_DEPENDENCY_EDGE_LIMIT,
): string[] {
  const lines = ['', '## Dependency graph summary', ''];

  if (!graph) {
    lines.push('The dependency graph has not been built for this snapshot.');
    return lines;
  }

  lines.push(`- Nodes (modules): ${graph.nodes.length}`);
  lines.push(`- Edges (detected relationships): ${graph.edges.length}`);

  const highConfidenceEdges = graph.edges.filter((edge) => edge.confidence === 'high');
  if (highConfidenceEdges.length > 0) {
    lines.push('', 'High-confidence relationships:');
    for (const edge of highConfidenceEdges.slice(0, edgeLimit)) {
      lines.push(`- ${inlineCode(edge.from)} → ${inlineCode(edge.to)} (${edge.type})`);
    }
    if (highConfidenceEdges.length > edgeLimit) {
      lines.push(`- …and ${highConfidenceEdges.length - edgeLimit} more`);
    }
  }

  if (plannedPaths.has('dependency-map.md')) {
    lines.push(
      '',
      `See ${inlineCode(formatDocsRelativePath(docsDir, 'dependency-map.md'))} for the full node and edge list with evidence.`,
    );
  }

  return lines;
}

export interface SafetyRulesSectionOptions {
  title?: string;
  includeAgentExportPaths?: boolean;
}

export function renderSafetyRulesSection(
  knowledge: ProjectKnowledge,
  options: SafetyRulesSectionOptions = {},
): string[] {
  const docsDir = knowledge.metadata.docsDir;
  const title = options.title ?? 'Safety rules';
  const writeRule = options.includeAgentExportPaths
    ? `- Only write generated context inside ${inlineCode(docsDir)} or tool-managed agent export paths (such as ${inlineCode('.cursor/rules/')}).`
    : `- Only write inside ${inlineCode(docsDir)} when updating generated context.`;

  return [
    '',
    `## ${title}`,
    '',
    '- Never modify project source files unless the user explicitly asks for code changes.',
    writeRule,
    '- Do not overwrite user-managed files that lack the generated-file marker.',
    '- Do not re-scan the repository or call OpenRouter from derived outputs — consume the PKM instead.',
    '- Treat high-confidence conventions as hard constraints; verify low-confidence ones against code.',
    '- Check the dependency graph before changing shared modules.',
    '- When AI insights are present in the PKM, treat them as non-authoritative enrichment only.',
  ];
}

export interface SourceOfTruthSectionOptions {
  formatLabel: string;
  regenerateCommand: string;
}

export function renderSourceOfTruthSection(
  knowledge: ProjectKnowledge,
  options: SourceOfTruthSectionOptions,
): string[] {
  const docsDir = knowledge.metadata.docsDir;
  return [
    '',
    '## PKM is the source of truth',
    '',
    `${options.formatLabel} is a derived presentation layer generated from the Project Knowledge Model (PKM).`,
    'Facts come from deterministic analyzers assembled once per pipeline run.',
    '',
    `- Canonical snapshot: ${inlineCode(formatDocsRelativePath(docsDir, 'knowledge/project-knowledge.json'))}`,
    `- Split sections: ${inlineCode(path.posix.join(docsDir, 'knowledge/'))}`,
    '',
    'Markdown documents, agent packs, and agent-specific exports must never become the source of truth.',
    'When outputs disagree, trust the PKM.',
    `Regenerate with \`${options.regenerateCommand}\` after PKM sections change.`,
  ];
}

export function selectKeyModules(
  modules: ModuleKnowledge[],
  limit: number,
): ModuleKnowledge[] {
  const highConfidence = modules.filter((module) => module.confidence === 'high');
  return (highConfidence.length > 0 ? highConfidence : modules).slice(0, limit);
}

function escapeYamlDoubleQuotedScalar(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function formatYamlScalar(value: string): string {
  if (/[:#\n\r\t"'&*!?|>@[\]{},]/.test(value) || value.trim() !== value) {
    return `"${escapeYamlDoubleQuotedScalar(value)}"`;
  }
  return value;
}
