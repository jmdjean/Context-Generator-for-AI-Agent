import { PlannedDocument } from '../../domain/documentation-plan';
import { DependencyEdge, DependencyGraphKnowledge, ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  inlineCode,
  renderDocumentHeader,
  tableCell,
} from './render-helpers';

const EVIDENCE_PER_EDGE_LIMIT = 3;

function renderNodesSection(graph: DependencyGraphKnowledge): string[] {
  const lines = ['', '## Nodes', ''];

  if (graph.nodes.length === 0) {
    lines.push('No modules were available to act as graph nodes.');
    return lines;
  }

  lines.push('| Module | Type | Path |');
  lines.push('|---|---|---|');
  for (const node of graph.nodes) {
    lines.push(`| ${tableCell(node.name)} | ${node.type} | ${inlineCode(node.relativePath)} |`);
  }
  return lines;
}

function renderEdgeEvidence(edge: DependencyEdge): string[] {
  const lines: string[] = [];
  for (const evidence of edge.evidence.slice(0, EVIDENCE_PER_EDGE_LIMIT)) {
    lines.push(`  - ${inlineCode(evidence.sourceFile)} imports ${inlineCode(evidence.importPath)}`);
  }
  if (edge.evidence.length > EVIDENCE_PER_EDGE_LIMIT) {
    lines.push(`  - …and ${edge.evidence.length - EVIDENCE_PER_EDGE_LIMIT} more import(s)`);
  }
  return lines;
}

function renderEdgesSection(graph: DependencyGraphKnowledge): string[] {
  const lines = ['', '## Edges', ''];

  if (graph.edges.length === 0) {
    lines.push('No dependency edges were detected between modules.');
    return lines;
  }

  lines.push('Each edge lists the imports that prove the relationship:');
  lines.push('');
  for (const edge of graph.edges) {
    lines.push(`- ${inlineCode(edge.from)} → ${inlineCode(edge.to)} (${edge.type}, confidence: ${edge.confidence})`);
    lines.push(...renderEdgeEvidence(edge));
  }
  return lines;
}

function renderLimitationsSection(): string[] {
  return [
    '',
    '## Limitations',
    '',
    '> **Warning:** this graph is deterministic and intentionally lightweight. It is built from',
    '> regex-based parsing of relative `import`/`require` statements between discovered modules.',
    '> It does not detect dynamic imports, path aliases (`@/…`), template-literal specifiers, or',
    '> non-JS/TS dependencies. Treat missing edges as "not detected", not "does not exist".',
  ];
}

export function renderDependencyMapDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [...renderDocumentHeader(document, knowledge)];
  const graph = knowledge.analysis.dependencyGraph;

  if (!graph) {
    lines.push('');
    lines.push('The dependency graph has not been built for this snapshot. Run the full pipeline to populate it.');
    return finishDocument(lines);
  }

  lines.push(...renderNodesSection(graph));
  lines.push(...renderEdgesSection(graph));
  lines.push(...renderLimitationsSection());

  return finishDocument(lines);
}
