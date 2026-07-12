import { PlannedDocument } from '../../domain/documentation-plan';
import { NavigationEntry, ProjectKnowledge, RouterStageEntry } from '../../knowledge';
import { sanitizeAiInsightText } from '../../utils/ai-text-sanitizer';
import {
  finishDocument,
  humanizeIdentifier,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

function renderStaticNavEntry(entry: NavigationEntry): string[] {
  const lines = [
    '',
    `### ${humanizeIdentifier(entry.taskType)}`,
    '',
    entry.description,
    '',
  ];

  if (entry.recommendedDocuments.length === 0) {
    lines.push('1. `AI_START_HERE.md`');
    lines.push('2. `architecture.md`');
    lines.push('3. `DOCUMENTATION_MAINTENANCE.md`');
  } else {
    entry.recommendedDocuments.forEach((relativePath, index) => {
      lines.push(`${index + 1}. ${inlineCode(relativePath)}`);
    });
    lines.push(`${entry.recommendedDocuments.length + 1}. \`DOCUMENTATION_MAINTENANCE.md\``);
  }

  if (entry.warnings.length > 0) {
    lines.push('', 'Warnings:', '');
    for (const warning of entry.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines;
}

function renderAiRouteEntry(route: RouterStageEntry): string[] {
  const lines = [
    '',
    `### ${sanitizeAiInsightText(route.taskType)}`,
    '',
    sanitizeAiInsightText(route.summary),
    '',
  ];

  if (route.readingPath.length > 0) {
    route.readingPath.forEach((readingPath: string, index: number) => {
      lines.push(`${index + 1}. ${inlineCode(sanitizeAiInsightText(readingPath))}`);
    });
  }

  return lines;
}

function renderAreaTable(knowledge: ProjectKnowledge): string[] {
  const modules = (knowledge.analysis.modules ?? []).filter(
    (module) => module.type !== 'documentation',
  );
  const capabilityMap = knowledge.analysis.stagedDocumentation?.capabilityMap;

  const lines: string[] = ['', '## By area', ''];

  if (capabilityMap && capabilityMap.status === 'completed') {
    const allItems = [
      ...capabilityMap.features,
      ...capabilityMap.domains,
      ...capabilityMap.integrations,
    ].slice(0, 12);

    if (allItems.length > 0) {
      lines.push('| Area | Entry paths |');
      lines.push('|---|---|');
      for (const item of allItems) {
        const paths = item.entryPaths.length > 0
          ? item.entryPaths.map((p) => inlineCode(p)).join(', ')
          : item.relatedModules.map((m) => inlineCode(m)).join(', ') || '—';
        lines.push(`| ${sanitizeAiInsightText(item.name)} | ${paths} |`);
      }
      return lines;
    }
  }

  if (modules.length > 0) {
    lines.push('| Module | Path | Type |');
    lines.push('|---|---|---|');
    for (const module of modules.slice(0, 12)) {
      lines.push(`| ${module.name} | ${inlineCode(module.relativePath)} | ${module.type} |`);
    }
    return lines;
  }

  lines.push('No modules discovered yet. Re-run analysis to populate this section.');
  return lines;
}

export function renderContextRouterDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const lines = [
    ...renderDocumentHeader(document, knowledge),
    '',
    'Match your task to a category below. Read the listed documents in order, then stop when you have enough context. Prefer 4–8 steps; do not read the entire docs folder.',
  ];

  const aiRouter = knowledge.analysis.stagedDocumentation?.router;
  const navigationMap = knowledge.analysis.navigationMap;

  if (aiRouter && aiRouter.status === 'completed' && aiRouter.routes.length > 0) {
    lines.push('', '## Reading paths by task type');
    for (const route of aiRouter.routes) {
      lines.push(...renderAiRouteEntry(route));
    }
  } else if (navigationMap && navigationMap.entries.length > 0) {
    lines.push('', '## Reading paths by task type');
    for (const entry of navigationMap.entries) {
      lines.push(...renderStaticNavEntry(entry));
    }
  } else {
    lines.push('', '### Any task', '');
    lines.push('1. `AI_START_HERE.md`');
    lines.push('2. `architecture.md`');
    lines.push('3. `agent-navigation.md`');
    lines.push('4. `folder-structure.md`');
    lines.push('5. `DOCUMENTATION_MAINTENANCE.md`');
    lines.push('');
    lines.push(
      'The navigation map is not populated yet. Re-run analysis to replace this fallback with task-specific routes.',
    );
  }

  lines.push(...renderAreaTable(knowledge));

  lines.push(
    '',
    '## Router rules',
    '',
    '- Order from general to specific.',
    '- Stop when enough context is loaded.',
    '- Prefer impact and architecture docs before risky shared changes.',
    '- Use `DOCUMENTATION_STATUS.md` to judge how much trust to place in a document.',
  );

  return finishDocument(lines);
}
