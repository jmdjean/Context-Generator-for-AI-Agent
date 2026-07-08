import { GENERATED_FILE_MARKER } from '../docs/document-template';
import {
  finishDocument,
  inlineCode,
} from '../docs/markdown-renderers/render-helpers';
import { ModuleKnowledge, ProjectKnowledge } from '../knowledge';
import {
  plannedDocumentPaths,
  renderConventionSummarySection,
  renderDependencySummarySection,
  renderNavigationMapSection,
  renderProjectAnalysisStats,
  renderReadingOrderSection,
  renderSafetyRulesSection,
  renderSourceOfTruthSection,
  selectKeyModules,
} from './agent-export-sections';
import { GENERIC_AGENT_PACK_RELATIVE_PATH } from './exporter-constants';
import { formatDocsRelativePath } from './exporter-paths';

const KEY_MODULE_LIMIT = 8;

function renderPackHeader(knowledge: ProjectKnowledge, exportedAt: string): string[] {
  return [
    GENERATED_FILE_MARKER,
    '',
    '# Generic agent context pack',
    '',
    'Portable context for AI coding agents. Derived from the Project Knowledge Model — not from a fresh repository scan.',
    '',
    `- Project: ${knowledge.metadata.projectName}`,
    `- Exported: ${exportedAt}`,
    `- PKM assembled: ${knowledge.metadata.generatedAt}`,
    `- PKM schema: ${knowledge.metadata.schemaVersion}`,
    `- Analysis status: ${knowledge.analysis.status}`,
  ];
}

function renderProjectSummarySection(knowledge: ProjectKnowledge): string[] {
  return ['', '## Project summary', '', ...renderProjectAnalysisStats(knowledge)];
}

function renderKeyModulesSection(
  modules: ModuleKnowledge[] | undefined,
  docsDir: string,
  plannedPaths: ReadonlySet<string>,
): string[] {
  const lines = ['', '## Key modules', ''];

  if (!modules || modules.length === 0) {
    lines.push('No modules are known yet. Module analysis has not run for this snapshot.');
    return lines;
  }

  const keyModules = selectKeyModules(modules, KEY_MODULE_LIMIT);

  for (const module of keyModules) {
    lines.push(`- ${inlineCode(module.relativePath)} (${module.type}) — ${module.responsibility}`);
  }

  if (modules.length > keyModules.length) {
    const suffix = plannedPaths.has('architecture.md')
      ? `more in ${inlineCode(formatDocsRelativePath(docsDir, 'architecture.md'))}`
      : 'more in the full PKM';
    lines.push(`- …and ${modules.length - keyModules.length} ${suffix}`);
  }

  return lines;
}

export function renderGenericAgentPack(knowledge: ProjectKnowledge, exportedAt: string): string {
  const docsDir = knowledge.metadata.docsDir;
  const plannedPaths = plannedDocumentPaths(knowledge);
  const lines = [
    ...renderPackHeader(knowledge, exportedAt),
    ...renderProjectSummarySection(knowledge),
    ...renderReadingOrderSection(knowledge, {
      title: 'Where to read first',
      includePackReference: GENERIC_AGENT_PACK_RELATIVE_PATH,
    }),
    ...renderNavigationMapSection(knowledge, 'Recommended task navigation'),
    ...renderKeyModulesSection(knowledge.analysis.modules, docsDir, plannedPaths),
    ...renderConventionSummarySection(knowledge.analysis.conventions, docsDir, plannedPaths, {
      title: 'Conventions',
    }),
    ...renderDependencySummarySection(knowledge.analysis.dependencyGraph, docsDir, plannedPaths),
    ...renderSafetyRulesSection(knowledge, { title: 'Safety rules for agents' }),
    ...renderSourceOfTruthSection(knowledge, {
      formatLabel: 'This file',
      regenerateCommand: 'ai-project-docs --export-agents',
    }),
  ];

  return finishDocument(lines);
}
