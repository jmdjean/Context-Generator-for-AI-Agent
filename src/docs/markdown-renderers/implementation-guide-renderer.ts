import { PlannedDocument } from '../../domain/documentation-plan';
import { NavigationEntry, ProjectKnowledge } from '../../knowledge';
import {
  finishDocument,
  formatInlineCodeList,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';
import { renderAiInsightsSection } from './ai-insights-renderer';

function renderNewFeatureSection(knowledge: ProjectKnowledge, entry: NavigationEntry | undefined): string[] {
  const moduleNames = (knowledge.analysis.modules ?? []).map((module) => module.relativePath);

  const lines = [
    '',
    '## How to add a new feature safely',
    '',
    '1. Read `ai-context.md` and `agent-navigation.md` before opening source files.',
    `2. Pick the module the feature belongs to. Known modules: ${formatInlineCodeList(moduleNames, 'none discovered yet — check the repository tree')}.`,
    '3. Check `dependency-map.md` to see which modules depend on the code you are about to change.',
    '4. Follow the high-confidence entries in `conventions.md` as hard constraints.',
    '5. Keep the change inside one module where possible; cross-module changes need `architecture.md` context.',
  ];

  if (entry && entry.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings from the navigation map:');
    lines.push('');
    for (const warning of entry.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  return lines;
}

function renderNewAnalyzerSection(): string[] {
  return [
    '',
    '## How to add a new analyzer',
    '',
    'Analyzers enrich the Project Knowledge Model (PKM) deterministically:',
    '',
    '1. Consume `ProjectKnowledge` — read the repository tree and prior analysis from the PKM, never re-scan the filesystem.',
    '2. Write results into a typed PKM section (`analysis.*`), extending the schema when a new section is needed.',
    '3. Keep detection deterministic: the same PKM input must always produce the same output.',
    '4. Wire the analyzer into the pipeline as its own step, after the sections it depends on are populated.',
  ];
}

function renderNewGeneratorSection(): string[] {
  return [
    '',
    '## How to add a new generator or renderer',
    '',
    'Generators translate the PKM into output formats (Markdown today; other formats later):',
    '',
    '1. Receive `ProjectKnowledge` as the only analysis input.',
    '2. Keep renderers small, deterministic, and presentation-only — formatting decisions belong here, facts do not.',
    '3. When data a renderer needs is missing, render an honest "not available yet" note instead of inventing content.',
    '4. Preserve the generated-file marker so user-created files are never overwritten.',
  ];
}

function renderWhyPkmSection(knowledge: ProjectKnowledge): string[] {
  return [
    '',
    '## Why new outputs must consume the PKM',
    '',
    'The PKM is the single source of truth assembled once per pipeline run. If each output format analyzed',
    'the repository on its own, outputs would disagree with each other and with the persisted knowledge in',
    `${inlineCode(`${knowledge.metadata.docsDir}/knowledge/`)}. Consuming the PKM guarantees every output reflects the same facts,`,
    'stays reproducible, and gets richer automatically whenever an analyzer improves.',
  ];
}

function renderDoNotBypassSection(): string[] {
  return [
    '',
    '## What not to bypass',
    '',
    '- Do not scan the filesystem or parse config files inside generators or renderers — that is analyzer work.',
    '- Do not pass raw stage outputs (repository info, technology profile, documentation plan) directly to generators — use the PKM.',
    '- Do not overwrite files that lack the generated-file marker; user-created documentation is never touched.',
    '- Do not delete files from the docs directory.',
    '- Do not hardcode project facts in renderers — read them from the PKM so they stay current.',
  ];
}

export function renderImplementationGuideDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const newFeatureEntry = knowledge.analysis.navigationMap?.entries.find(
    (entry) => entry.taskType === 'new-feature',
  );

  const lines = [
    ...renderDocumentHeader(document, knowledge),
    ...renderNewFeatureSection(knowledge, newFeatureEntry),
    ...renderNewAnalyzerSection(),
    ...renderNewGeneratorSection(),
    ...renderWhyPkmSection(knowledge),
    ...renderDoNotBypassSection(),
    ...renderAiInsightsSection(knowledge),
  ];

  return finishDocument(lines);
}
