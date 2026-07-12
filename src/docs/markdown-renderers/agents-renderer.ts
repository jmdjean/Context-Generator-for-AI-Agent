import { PlannedDocument } from '../../domain/documentation-plan';
import { ModuleKnowledge, ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

const MODULE_LIMIT = 10;

function renderWorkflowTable(modules: ModuleKnowledge[]): string[] {
  const productModules = modules.filter((m) => m.type !== 'documentation').slice(0, MODULE_LIMIT);
  if (productModules.length === 0) {
    return [
      '',
      '## Working on something? Start here',
      '',
      'No modules discovered yet. Re-run analysis to populate this table.',
    ];
  }

  const lines = [
    '',
    '## Working on something? Start here',
    '',
    '| Working on… | Read these first |',
    '|---|---|',
  ];

  for (const module of productModules) {
    const docPath = `code/components/${module.relativePath.replace(/\//g, '__')}.md`;
    lines.push(
      `| ${module.name} (${module.type}) | ${inlineCode(docPath)}, ${inlineCode('architecture.md')} |`,
    );
  }

  return lines;
}

function renderHardRules(): string[] {
  return [
    '',
    '## Hard rules for agents',
    '',
    '- Always read `AI_START_HERE.md` before any other doc in this repository.',
    '- Use `CONTEXT_ROUTER.md` to pick a reading path before changing code.',
    '- Do not invent modules, dependencies, or env vars not listed in the PKM.',
    '- After code changes, update the relevant docs — see `DOCUMENTATION_MAINTENANCE.md`.',
    '- Prefer PKM-backed facts over guessing. Mark conclusions as enrichment.',
  ];
}

function renderEntryFlow(): string[] {
  return [
    '',
    '## Orientation flow',
    '',
    '```',
    'AI_START_HERE.md',
    '  → CONTEXT_ROUTER.md  (pick reading path)',
    '  → PROJECT_MAP.md     (locate modules)',
    '  → code/components/   (module cards)',
    '  → real source code',
    '```',
  ];
}

export function renderAgentsDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const modules = knowledge.analysis.modules ?? [];

  const lines = [
    ...renderDocumentHeader(document, knowledge),
    ...renderWorkflowTable(modules),
    ...renderHardRules(),
    ...renderEntryFlow(),
  ];

  return finishDocument(lines);
}
