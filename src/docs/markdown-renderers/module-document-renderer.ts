import { PlannedDocument } from '../../domain/documentation-plan';
import {
  ModuleDocumentationResultKnowledge,
  ModuleKnowledge,
  ProjectKnowledge,
} from '../../knowledge';
import { sanitizeAiInsightMetadata, sanitizeAiInsightText } from '../../utils/ai-text-sanitizer';
import {
  finishDocument,
  formatInlineCodeList,
  inlineCode,
  renderDocumentHeader,
} from './render-helpers';

const MODULE_ENRICHMENT_DISCLAIMER =
  '> **Staged module enrichment.** Deterministic module facts below remain authoritative until a completed module result exists.';

function findModuleKnowledge(
  knowledge: ProjectKnowledge,
  document: PlannedDocument,
): ModuleKnowledge | undefined {
  const modules = knowledge.analysis.modules ?? [];
  if (document.moduleId !== undefined) {
    const byId = modules.find((module) => module.relativePath === document.moduleId);
    if (byId) {
      return byId;
    }
  }
  if (document.moduleName !== undefined) {
    return modules.find((module) => module.name === document.moduleName);
  }
  return undefined;
}

function findModuleResult(
  knowledge: ProjectKnowledge,
  document: PlannedDocument,
): ModuleDocumentationResultKnowledge | undefined {
  const results = knowledge.analysis.stagedDocumentation?.moduleResults?.results;
  if (!results || results.length === 0) {
    return undefined;
  }

  if (document.moduleId !== undefined) {
    const byId = results.find((result) => result.moduleId === document.moduleId);
    if (byId) {
      return byId;
    }
  }

  return results.find((result) => result.documentPath === document.relativePath);
}

function renderDeterministicModuleFacts(
  module: ModuleKnowledge | undefined,
  document: PlannedDocument,
): string[] {
  const lines = ['', '## Deterministic module facts', ''];

  if (!module) {
    lines.push(
      `No module knowledge matched ${inlineCode(document.moduleId ?? document.relativePath)}. Re-run module analysis or check the module plan entry.`,
    );
    return lines;
  }

  lines.push(`- Path: ${inlineCode(module.relativePath)}`);
  lines.push(`- Type: ${module.type}`);
  lines.push(`- Responsibility: ${module.responsibility}`);
  lines.push(`- Confidence: ${module.confidence}`);
  lines.push(`- Important files: ${formatInlineCodeList(module.importantFiles)}`);
  lines.push(`- Related folders: ${formatInlineCodeList(module.relatedFolders)}`);
  return lines;
}

function renderStagedModuleResult(result: ModuleDocumentationResultKnowledge): string[] {
  const lines: string[] = [
    '',
    '## Staged module documentation',
    '',
    MODULE_ENRICHMENT_DISCLAIMER,
  ];

  if (result.status === 'failed' || result.status === 'partial') {
    lines.push('');
    if (result.error) {
      lines.push(`> Error: ${sanitizeAiInsightText(result.error)}`);
    }
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        lines.push(`> Warning: ${sanitizeAiInsightText(warning)}`);
      }
    }
    return lines;
  }

  if (result.summary) {
    const summary = sanitizeAiInsightText(result.summary);
    if (summary.length > 0) {
      lines.push('', '### Summary', '', summary);
    }
  }

  if (result.content) {
    const content = sanitizeAiInsightText(result.content);
    if (content.length > 0) {
      lines.push('', content);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('', '> **Warnings**');
    for (const warning of result.warnings) {
      lines.push(`> - ${sanitizeAiInsightText(warning)}`);
    }
  }

  return lines;
}

function renderPendingModuleSection(): string[] {
  return [
    '',
    '## Staged module documentation',
    '',
    MODULE_ENRICHMENT_DISCLAIMER,
    '',
    'No per-module AI result is stored in `analysis.stagedDocumentation.moduleResults` yet. This card currently exposes deterministic PKM module facts only.',
  ];
}

export function renderModuleDocument(
  document: PlannedDocument,
  knowledge: ProjectKnowledge,
): string {
  const module = findModuleKnowledge(knowledge, document);
  const result = findModuleResult(knowledge, document);

  const lines = [
    ...renderDocumentHeader(document, knowledge),
    ...renderDeterministicModuleFacts(module, document),
    ...(result ? renderStagedModuleResult(result) : renderPendingModuleSection()),
    '',
    '## Related docs',
    '',
    '- `module-documentation-plan.md` — sequence and rationale',
    '- `architecture.md` — system boundaries',
    '- `DOCUMENTATION_MAINTENANCE.md` — update rules after code changes',
  ];

  return finishDocument(lines);
}
