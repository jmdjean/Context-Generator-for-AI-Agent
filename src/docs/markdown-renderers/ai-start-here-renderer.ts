import { PlannedDocument } from '../../domain/documentation-plan';
import { ModuleKnowledge, ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  formatInlineList,
  inlineCode,
  renderDocumentHeader,
  tableCell,
} from './render-helpers';

const COMPONENT_LIMIT = 12;

function renderPurposeSection(knowledge: ProjectKnowledge): string[] {
  const frameworks = knowledge.technologies.frameworks;
  const frameworkClause =
    frameworks.length > 0
      ? ` Built around ${formatInlineList(frameworks)}.`
      : '';

  return [
    '',
    '## What this system is',
    '',
    `${knowledge.metadata.projectName} is a ${formatInlineList(knowledge.technologies.languages, 'software')} project.${frameworkClause} This orientation is derived from the Project Knowledge Model — not from free-form prose.`,
  ];
}

function renderComponentsSection(modules: ModuleKnowledge[] | undefined): string[] {
  const lines = ['', '## Main components', ''];

  if (!modules || modules.length === 0) {
    lines.push('No modules have been discovered yet. See `PROJECT_MAP.md` after module analysis completes.');
    return lines;
  }

  lines.push('| Path | Type | Role |');
  lines.push('|---|---|---|');
  for (const module of modules.slice(0, COMPONENT_LIMIT)) {
    lines.push(
      `| ${inlineCode(module.relativePath)} | ${module.type} | ${tableCell(module.responsibility)} |`,
    );
  }
  if (modules.length > COMPONENT_LIMIT) {
    lines.push('');
    lines.push(`…and ${modules.length - COMPONENT_LIMIT} more in \`PROJECT_MAP.md\` / \`architecture.md\`.`);
  }
  return lines;
}

function renderConstraintsSection(knowledge: ProjectKnowledge): string[] {
  const lines = ['', '## Key constraints', ''];
  const architectural = (knowledge.analysis.conventions ?? []).filter(
    (convention) =>
      convention.category === 'architecture' || convention.category === 'repository-structure',
  );

  if (architectural.length === 0) {
    lines.push('- Prefer PKM-backed docs over guessing architecture.');
    lines.push('- Start with `CONTEXT_ROUTER.md` for task-specific reading paths.');
    lines.push('- Do not invent modules or dependencies that are not in the PKM.');
    return lines;
  }

  for (const convention of architectural.slice(0, 6)) {
    lines.push(`- **${convention.name}**: ${convention.description}`);
  }
  return lines;
}

function renderNextStepsSection(): string[] {
  return [
    '',
    '## Where to go next',
    '',
    '1. `CONTEXT_ROUTER.md` — pick an ordered reading path for your task type',
    '2. `PROJECT_MAP.md` — locate modules and documentation entry points',
    '3. `architecture.md` — system design and boundaries',
    '4. `DOCUMENTATION_MAINTENANCE.md` — update agent docs after behavior changes',
  ];
}

export function renderAiStartHereDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [
    ...renderDocumentHeader(document, knowledge),
    ...renderPurposeSection(knowledge),
    ...renderComponentsSection(knowledge.analysis.modules),
    ...renderConstraintsSection(knowledge),
    ...renderNextStepsSection(),
  ];

  return finishDocument(lines);
}
