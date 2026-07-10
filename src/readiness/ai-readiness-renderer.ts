import { PlannedDocument } from '../domain/documentation-plan';
import {
  finishDocument,
  renderDocumentHeader,
  tableCell,
} from '../docs/markdown-renderers/render-helpers';
import { ProjectKnowledge } from '../knowledge/project-knowledge';
import { TemplateDefinition } from '../templates/template-context';
import {
  AI_READINESS_DOCUMENT_PATH,
  AIReadinessKnowledge,
} from './ai-readiness-model';

const DISCLAIMER =
  'The AI Readiness Score is a deterministic Context Engineering assessment. It does not guarantee implementation quality and does not replace human review.';

const METHODOLOGY_LINES: ReadonlyArray<string> = [
  'Each category is evaluated through deterministic findings derived exclusively from the persisted Project Knowledge Model (PKM) and the documentation validation result.',
  'Findings earn points (`passed` = full, `partial` = half, `failed` = none); `not-applicable` findings are excluded so small repositories are not unfairly penalized.',
  'A category score is the earned share of applicable points, scaled to 0–100. The overall score is the weighted average of all category scores, with weights totaling 100%.',
  'No repository rescan, AI provider call, or non-deterministic input is involved. Identical PKM input always produces the identical score.',
];

function renderCategoryTable(readiness: AIReadinessKnowledge): string[] {
  const lines = [
    '',
    '## Categories',
    '',
    '| Category | Score | Weight |',
    '| --- | ---: | ---: |',
  ];

  for (const category of readiness.categories) {
    lines.push(
      `| ${tableCell(category.name)} | ${category.score}/100 | ${category.weight}% |`,
    );
  }

  return lines;
}

function renderFindingDetails(readiness: AIReadinessKnowledge): string[] {
  const lines = ['', '## Findings by category'];

  for (const category of readiness.categories) {
    lines.push('', `### ${category.name} — ${category.score}/100`);
    for (const finding of category.findings) {
      lines.push(
        `- \`${finding.status}\` ${finding.description} (${finding.points}/${finding.maxPoints} pts)`,
      );
      for (const evidence of finding.evidence) {
        lines.push(`  - Evidence: ${evidence}`);
      }
    }
  }

  return lines;
}

function renderListSection(title: string, items: readonly string[], emptyNote: string): string[] {
  const lines = ['', `## ${title}`, ''];

  if (items.length === 0) {
    lines.push(emptyNote);
    return lines;
  }

  for (const item of items) {
    lines.push(`- ${item}`);
  }

  return lines;
}

export function renderAiReadinessDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [...renderDocumentHeader(document, knowledge)];
  const readiness = knowledge.analysis.aiReadiness;

  lines.push('', `> ${DISCLAIMER}`);

  if (!readiness) {
    lines.push(
      '',
      'The AI Readiness Score has not been calculated for this snapshot yet. Run the full pipeline to populate this document.',
    );
    return finishDocument(lines);
  }

  lines.push(
    '',
    '## Overall result',
    '',
    `- Overall score: **${readiness.overallScore}/100**`,
    `- Readiness level: **${readiness.level}**`,
    `- Scoring version: ${readiness.scoringVersion}`,
    `- Calculated at: ${readiness.calculatedAt}`,
  );

  lines.push(...renderCategoryTable(readiness));
  lines.push(
    ...renderListSection(
      'Strengths',
      readiness.strengths,
      'No passed findings stood out for this snapshot.',
    ),
  );
  lines.push(
    ...renderListSection(
      'Gaps',
      readiness.gaps.map((gap) => `${gap.description} (${gap.severity})`),
      'No gaps were detected for this snapshot.',
    ),
  );
  lines.push(
    ...renderListSection(
      'Prioritized recommendations',
      readiness.recommendations.map(
        (recommendation, index) => `${index + 1}. ${recommendation.action}`,
      ),
      'No recommendations: every applicable finding passed.',
    ),
  );

  lines.push('', '## Scoring methodology');
  for (const methodologyLine of METHODOLOGY_LINES) {
    lines.push('', methodologyLine);
  }

  lines.push(...renderFindingDetails(readiness));

  return finishDocument(lines);
}

export const AI_READINESS_TEMPLATE: TemplateDefinition = {
  id: 'markdown.ai-readiness',
  name: 'AI Readiness Document',
  description:
    'Renders ai-readiness.md from the deterministic AI Readiness Score stored in analysis.aiReadiness.',
  outputPath: AI_READINESS_DOCUMENT_PATH,
  render(context, document) {
    return renderAiReadinessDocument(document, context.knowledge);
  },
};

/**
 * Formats the pipeline console block shown right after the readiness step.
 */
export function formatAiReadinessConsoleReport(readiness: AIReadinessKnowledge): string[] {
  const lines = [
    '',
    'AI Readiness:',
    `Overall score: ${readiness.overallScore}/100`,
    `Level: ${readiness.level}`,
    '',
    'Categories:',
  ];

  for (const category of readiness.categories) {
    lines.push(`- ${category.name}: ${category.score}`);
  }

  if (readiness.gaps.length > 0) {
    lines.push('', 'Top gaps:');
    for (const gap of readiness.gaps.slice(0, 3)) {
      lines.push(`- ${gap.description}`);
    }
  }

  lines.push('');
  return lines;
}
