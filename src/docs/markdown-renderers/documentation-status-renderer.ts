import { PlannedDocument } from '../../domain/documentation-plan';
import {
  ModuleDocumentationPlanEntry,
  ModuleDocumentationResultKnowledge,
  ProjectKnowledge,
  StagedDocumentationStageExecution,
  StagedDocumentationStatus,
} from '../../knowledge';
import {
  finishDocument,
  inlineCode,
  renderDocumentHeader,
  tableCell,
} from './render-helpers';

function coverageLabel(status: StagedDocumentationStatus | undefined): string {
  switch (status) {
    case 'completed':
      return 'Documented';
    case 'partial':
    case 'in-progress':
      return 'Partial';
    case 'failed':
      return 'Stale';
    case 'skipped':
    case 'pending':
    case undefined:
      return 'Missing';
    default:
      return 'Missing';
  }
}

function renderStageExecutionTable(
  execution: readonly StagedDocumentationStageExecution[],
): string[] {
  const lines = [
    '',
    '## Staged pipeline coverage',
    '',
    '| Stage | Status | Trust |',
    '|---|---|---|',
  ];

  if (execution.length === 0) {
    lines.push('| *(none yet)* | pending | Missing |');
    return lines;
  }

  for (const entry of execution) {
    lines.push(
      `| ${inlineCode(entry.stageId)} | ${entry.status} | ${coverageLabel(entry.status)} |`,
    );
  }
  return lines;
}

function findModuleResult(
  results: readonly ModuleDocumentationResultKnowledge[] | undefined,
  moduleId: string,
): ModuleDocumentationResultKnowledge | undefined {
  return results?.find((result) => result.moduleId === moduleId);
}

function renderModulePlanCoverage(
  entries: readonly ModuleDocumentationPlanEntry[],
  results: readonly ModuleDocumentationResultKnowledge[] | undefined,
): string[] {
  const lines = [
    '',
    '## Module documentation coverage',
    '',
    '| Module | Planned document | Plan status | Result status | Trust |',
    '|---|---|---|---|---|',
  ];

  if (entries.length === 0) {
    lines.push('| *(no modules planned)* | — | pending | — | Missing |');
    return lines;
  }

  for (const entry of entries) {
    const result = findModuleResult(results, entry.moduleId);
    const resultStatus = result?.status;
    const trust = coverageLabel(resultStatus ?? entry.status);
    lines.push(
      `| ${tableCell(entry.moduleName)} | ${inlineCode(entry.documentPath)} | ${entry.status} | ${resultStatus ?? '—'} | ${trust} |`,
    );
  }
  return lines;
}

function renderPlaybookDocumentStatus(knowledge: ProjectKnowledge): string[] {
  const playbookPaths = knowledge.documentation.plan.documents
    .filter((document) => document.source === 'playbook' || document.stage === 'routing')
    .map((document) => document.relativePath);

  const lines = [
    '',
    '## Playbook document ledger',
    '',
    '| Document | In plan | Notes |',
    '|---|---|---|',
  ];

  const uniquePaths = [...new Set(playbookPaths)].sort((left, right) => left.localeCompare(right));
  if (uniquePaths.length === 0) {
    lines.push('| *(no playbook docs in plan)* | no | Expand the module documentation plan first |');
    return lines;
  }

  for (const relativePath of uniquePaths) {
    lines.push(`| ${inlineCode(relativePath)} | yes | Planned; regenerate with the documentation writer |`);
  }
  return lines;
}

export function renderDocumentationStatusDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const staged = knowledge.analysis.stagedDocumentation;
  const lines = [
    ...renderDocumentHeader(document, knowledge),
    '',
    'Honest coverage status for staged and playbook outputs. Status is a trust signal, not a vanity score.',
    ...renderStageExecutionTable(staged?.execution ?? []),
    ...renderModulePlanCoverage(staged?.modulePlan?.entries ?? [], staged?.moduleResults?.results),
    ...renderPlaybookDocumentStatus(knowledge),
    '',
    '## How to read trust labels',
    '',
    '- **Documented** — stage or module result completed.',
    '- **Partial** — work started or only some modules finished.',
    '- **Missing** — not planned or not generated yet.',
    '- **Stale** — generation failed; do not trust until regenerated.',
  ];

  return finishDocument(lines);
}
