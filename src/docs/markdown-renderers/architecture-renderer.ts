import { PlannedDocument } from '../../domain/documentation-plan';
import {
  ConventionKnowledge,
  DependencyGraphKnowledge,
  ModuleKnowledge,
  NavigationEntry,
  ProjectKnowledge,
} from '../../knowledge';
import {
  finishDocument,
  formatInlineCodeList,
  formatInlineList,
  humanizeIdentifier,
  inlineCode,
  renderDocumentHeader,
  tableCell,
} from './render-helpers';

const ARCHITECTURE_CONVENTION_CATEGORIES: ReadonlyArray<string> = [
  'architecture',
  'repository-structure',
];

const HIGH_CONFIDENCE_EDGE_LIMIT = 10;

function renderTechnologySection(knowledge: ProjectKnowledge): string[] {
  const { technologies } = knowledge;
  return [
    '',
    '## Detected technologies',
    '',
    `- Languages: ${formatInlineList(technologies.languages)}`,
    `- Frameworks: ${formatInlineList(technologies.frameworks)}`,
    `- Package managers: ${formatInlineList(technologies.packageManagers)}`,
    `- Tooling: ${formatInlineList(technologies.tooling)}`,
    `- Detection confidence: ${technologies.confidence}`,
  ];
}

function renderModulesSection(modules: ModuleKnowledge[] | undefined): string[] {
  const lines = ['', '## Modules', ''];

  if (!modules || modules.length === 0) {
    lines.push('No modules have been discovered yet. Module analysis has not run for this snapshot.');
    return lines;
  }

  lines.push('| Module | Type | Responsibility | Confidence |');
  lines.push('|---|---|---|---|');
  for (const module of modules) {
    lines.push(
      `| ${inlineCode(module.relativePath)} | ${module.type} | ${tableCell(module.responsibility)} | ${module.confidence} |`,
    );
  }
  return lines;
}

function renderCoreArchitectureSection(modules: ModuleKnowledge[] | undefined): string[] {
  const lines = ['', '## Core architecture', ''];

  if (!modules || modules.length === 0) {
    lines.push('Architectural units are unknown until module analysis has populated the PKM.');
    return lines;
  }

  const modulesByType = new Map<string, string[]>();
  for (const module of modules) {
    const paths = modulesByType.get(module.type) ?? [];
    paths.push(module.relativePath);
    modulesByType.set(module.type, paths);
  }

  lines.push('Architectural units grouped by module type:');
  lines.push('');
  for (const [type, paths] of modulesByType) {
    lines.push(`- **${humanizeIdentifier(type)}**: ${formatInlineCodeList(paths)}`);
  }
  return lines;
}

function renderConventionsSection(conventions: ConventionKnowledge[] | undefined): string[] {
  const lines = ['', '## Architectural conventions', ''];
  const architectural = (conventions ?? []).filter((convention) =>
    ARCHITECTURE_CONVENTION_CATEGORIES.includes(convention.category),
  );

  if (architectural.length === 0) {
    lines.push('No architectural conventions have been detected yet. See `conventions.md` once convention analysis has run.');
    return lines;
  }

  for (const convention of architectural) {
    lines.push(`- **${convention.name}** (${convention.confidence} confidence): ${convention.description}`);
  }
  lines.push('');
  lines.push('The full evidence-backed convention list lives in `conventions.md`.');
  return lines;
}

function renderDependencySummarySection(graph: DependencyGraphKnowledge | undefined): string[] {
  const lines = ['', '## Dependency graph summary', ''];

  if (!graph) {
    lines.push('The dependency graph has not been built for this snapshot.');
    return lines;
  }

  lines.push(`- Nodes (modules): ${graph.nodes.length}`);
  lines.push(`- Edges (detected relationships): ${graph.edges.length}`);

  const highConfidenceEdges = graph.edges.filter((edge) => edge.confidence === 'high');
  if (highConfidenceEdges.length > 0) {
    lines.push('');
    lines.push('High-confidence relationships:');
    lines.push('');
    for (const edge of highConfidenceEdges.slice(0, HIGH_CONFIDENCE_EDGE_LIMIT)) {
      lines.push(`- ${inlineCode(edge.from)} → ${inlineCode(edge.to)} (${edge.type})`);
    }
    if (highConfidenceEdges.length > HIGH_CONFIDENCE_EDGE_LIMIT) {
      lines.push(`- …and ${highConfidenceEdges.length - HIGH_CONFIDENCE_EDGE_LIMIT} more`);
    }
  }

  lines.push('');
  lines.push('See `dependency-map.md` for the full node and edge list with evidence.');
  return lines;
}

function renderAgentGuidanceSection(entry: NavigationEntry | undefined): string[] {
  const lines = ['', '## How AI agents should approach architecture changes', ''];

  if (!entry) {
    lines.push('- Read this document and `dependency-map.md` before moving or renaming modules.');
    lines.push('- Check which modules depend on the code you are changing before changing it.');
    lines.push('- Keep documentation in sync with any structural change.');
    return lines;
  }

  lines.push(entry.description);
  lines.push('');
  lines.push(`- Load these PKM sections first: ${formatInlineCodeList(entry.recommendedKnowledge)}`);
  lines.push(`- Read these documents: ${formatInlineCodeList(entry.recommendedDocuments)}`);
  lines.push(`- Related modules: ${formatInlineCodeList(entry.relatedModules, 'None resolved')}`);
  lines.push(`- Guidance confidence: ${entry.confidence}`);

  if (entry.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    lines.push('');
    for (const warning of entry.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  return lines;
}

export function renderArchitectureDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const architectureEntry = knowledge.analysis.navigationMap?.entries.find(
    (entry) => entry.taskType === 'architecture-change',
  );

  const lines = [
    ...renderDocumentHeader(document, knowledge),
    ...renderTechnologySection(knowledge),
    ...renderModulesSection(knowledge.analysis.modules),
    ...renderCoreArchitectureSection(knowledge.analysis.modules),
    ...renderConventionsSection(knowledge.analysis.conventions),
    ...renderDependencySummarySection(knowledge.analysis.dependencyGraph),
    ...renderAgentGuidanceSection(architectureEntry),
  ];

  return finishDocument(lines);
}
