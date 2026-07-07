import { PlannedDocument } from '../../domain/documentation-plan';
import { ConventionCategory, ConventionKnowledge, ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  humanizeIdentifier,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

const CATEGORY_ORDER: ReadonlyArray<ConventionCategory> = [
  'architecture',
  'repository-structure',
  'language',
  'testing',
  'tooling',
  'package-management',
  'documentation',
  'generated-context',
  'unknown',
];

function renderConvention(convention: ConventionKnowledge): string[] {
  const lines = [
    '',
    `### ${convention.name}`,
    '',
    convention.description,
    '',
    `- Category: ${convention.category}`,
    `- Confidence: ${convention.confidence}`,
  ];

  if (convention.evidence.length > 0) {
    lines.push('- Evidence:');
    for (const evidence of convention.evidence) {
      lines.push(`  - ${evidence.type} — ${inlineCode(evidence.source)}: ${evidence.detail}`);
    }
  }
  return lines;
}

function renderCategorySections(conventions: ConventionKnowledge[]): string[] {
  const lines: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const matching = conventions.filter((convention) => convention.category === category);
    if (matching.length === 0) {
      continue;
    }

    lines.push('');
    lines.push(`## ${humanizeIdentifier(category)}`);
    for (const convention of matching) {
      lines.push(...renderConvention(convention));
    }
  }
  return lines;
}

export function renderConventionsDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [...renderDocumentHeader(document, knowledge)];
  const conventions = knowledge.analysis.conventions;

  if (!conventions || conventions.length === 0) {
    lines.push('');
    lines.push('No conventions have been detected yet. Convention analysis has not run for this snapshot.');
    return finishDocument(lines);
  }

  lines.push('');
  lines.push(`The convention analyzer detected ${conventions.length} convention(s). Treat high-confidence entries as hard constraints and low-confidence entries as hints. Every convention can be verified from its evidence.`);
  lines.push(...renderCategorySections(conventions));

  return finishDocument(lines);
}
