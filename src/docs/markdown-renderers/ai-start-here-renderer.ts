import { PlannedDocument } from '../../domain/documentation-plan';
import { ModuleKnowledge, OperationalContextKnowledge, ProjectKnowledge } from '../../knowledge';
import { sanitizeAiInsightText } from '../../utils/ai-text-sanitizer';
import {
  finishDocument,
  formatInlineList,
  inlineCode,
  renderDocumentHeader,
  tableCell,
} from './render-helpers';

const COMPONENT_LIMIT = 12;

function renderPurposeSection(knowledge: ProjectKnowledge): string[] {
  const arch = knowledge.analysis.stagedDocumentation?.architecture;
  const purpose =
    arch?.purpose ??
    knowledge.analysis.operationalContext?.purpose;

  if (purpose) {
    return ['', '## Project purpose', '', sanitizeAiInsightText(purpose)];
  }

  const frameworks = knowledge.technologies.frameworks;
  const frameworkClause =
    frameworks.length > 0 ? ` Built around ${formatInlineList(frameworks)}.` : '';
  return [
    '',
    '## Project purpose',
    '',
    `${knowledge.metadata.projectName} is a ${formatInlineList(knowledge.technologies.languages, 'software')} project.${frameworkClause}`,
  ];
}

function renderArchitectureSection(knowledge: ProjectKnowledge): string[] {
  const arch = knowledge.analysis.stagedDocumentation?.architecture;
  if (!arch || arch.status !== 'completed') {
    return [];
  }

  const lines: string[] = ['', '## Architecture'];

  if (arch.summary) {
    lines.push('', sanitizeAiInsightText(arch.summary));
  }

  if (arch.asciiDiagram) {
    lines.push('', '```', sanitizeAiInsightText(arch.asciiDiagram), '```');
  }

  if (arch.layers && arch.layers.length > 0) {
    lines.push('', '**Layers:**');
    for (const layer of arch.layers) {
      lines.push(`- ${sanitizeAiInsightText(layer)}`);
    }
  }

  if (arch.keyConstraints && arch.keyConstraints.length > 0) {
    lines.push('', '**Key constraints:**');
    for (const constraint of arch.keyConstraints) {
      lines.push(`- ${sanitizeAiInsightText(constraint)}`);
    }
  }

  if (arch.risks && arch.risks.length > 0) {
    lines.push('', '**Risks:**');
    for (const risk of arch.risks) {
      lines.push(`- ${sanitizeAiInsightText(risk)}`);
    }
  }

  return lines;
}

function renderEnvironmentSection(
  operational: OperationalContextKnowledge | undefined,
  arch: { envVars?: string[] } | undefined,
): string[] {
  const envVarsFromArch = arch?.envVars ?? [];
  const envVarsFromOps = (operational?.envVars ?? []).map((entry) => entry.key);
  const envKeys = [...new Set([...envVarsFromArch, ...envVarsFromOps])];

  if (envKeys.length === 0) {
    return [];
  }

  const lines = ['', '## Environment setup', ''];
  lines.push('Required environment variables (keys only — set values from your secrets store):');
  lines.push('');
  for (const key of envKeys.slice(0, 20)) {
    lines.push(`- ${inlineCode(key)}`);
  }
  return lines;
}

function renderRunSection(
  operational: OperationalContextKnowledge | undefined,
  arch: { runCommands?: string[] } | undefined,
): string[] {
  const fromArch = arch?.runCommands ?? [];
  const fromOps = (operational?.runCommands ?? []).slice(0, 10).map(
    (cmd) => `${cmd.name}: ${cmd.command}`,
  );

  const items = fromArch.length > 0 ? fromArch : fromOps;
  if (items.length === 0) {
    return [];
  }

  const lines = ['', '## How to run', ''];
  for (const item of items.slice(0, 8)) {
    lines.push(`- ${sanitizeAiInsightText(item)}`);
  }
  return lines;
}

function renderComponentsSection(modules: ModuleKnowledge[] | undefined): string[] {
  const lines = ['', '## Main components', ''];

  if (!modules || modules.length === 0) {
    lines.push(
      'No modules have been discovered yet. See `PROJECT_MAP.md` after module analysis completes.',
    );
    return lines;
  }

  const productModules = modules.filter((m) => m.type !== 'documentation');
  const displayModules = productModules.length > 0 ? productModules : modules;

  lines.push('| Path | Type | Role |');
  lines.push('|---|---|---|');
  for (const module of displayModules.slice(0, COMPONENT_LIMIT)) {
    lines.push(
      `| ${inlineCode(module.relativePath)} | ${module.type} | ${tableCell(module.responsibility)} |`,
    );
  }
  if (displayModules.length > COMPONENT_LIMIT) {
    lines.push('');
    lines.push(
      `…and ${displayModules.length - COMPONENT_LIMIT} more in \`PROJECT_MAP.md\`.`,
    );
  }
  return lines;
}

function renderAgentGuidanceSection(arch: { agentGuidance?: string[] } | undefined): string[] {
  if (!arch?.agentGuidance || arch.agentGuidance.length === 0) {
    return [];
  }
  const lines = ['', '## Agent guidance', ''];
  for (const guidance of arch.agentGuidance) {
    lines.push(`- ${sanitizeAiInsightText(guidance)}`);
  }
  return lines;
}

function renderNextStepsSection(): string[] {
  return [
    '',
    '## What to load next',
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
  const arch = knowledge.analysis.stagedDocumentation?.architecture;
  const operational = knowledge.analysis.operationalContext;

  const lines = [
    ...renderDocumentHeader(document, knowledge),
    ...renderPurposeSection(knowledge),
    ...renderArchitectureSection(knowledge),
    ...renderEnvironmentSection(operational, arch),
    ...renderRunSection(operational, arch),
    ...renderComponentsSection(knowledge.analysis.modules),
    ...renderAgentGuidanceSection(arch),
    ...renderNextStepsSection(),
  ];

  return finishDocument(lines);
}
