import { PlannedDocument } from '../domain/documentation-plan';
import {
  ChangeBaselineStatus,
  ChangeSection,
  ChangeSummaryKnowledge,
  DocumentImpactKnowledge,
  DocumentImpactSummaryKnowledge,
} from '../knowledge';

export type DocumentImpact = DocumentImpactKnowledge;
export type DocumentImpactSummary = DocumentImpactSummaryKnowledge;

interface SectionDocumentEntry {
  path: string;
  reason: string;
}

const FOLDER_STRUCTURE_IMPACT: readonly SectionDocumentEntry[] = [
  { path: 'folder-structure.md', reason: 'Folder contexts changed' },
  { path: 'architecture.md', reason: 'Folder contexts changed' },
  { path: 'ai-context.md', reason: 'Folder contexts changed' },
  { path: 'agent-navigation.md', reason: 'Folder contexts changed' },
];

const SECTION_DOCUMENT_IMPACT: Readonly<
  Record<ChangeSection, readonly SectionDocumentEntry[]>
> = {
  detectedFiles: [
    { path: 'README.md', reason: 'Detected files changed' },
    { path: 'change-log.md', reason: 'Detected files changed' },
    { path: 'technology-overview.md', reason: 'Detected files changed' },
  ],
  repositoryTree: FOLDER_STRUCTURE_IMPACT.map((entry) => ({
    path: entry.path,
    reason: 'Repository tree changed',
  })),
  technologies: [
    { path: 'architecture.md', reason: 'Technologies changed' },
    { path: 'ai-context.md', reason: 'Technologies changed' },
    { path: 'implementation-guide.md', reason: 'Technologies changed' },
  ],
  folderContexts: FOLDER_STRUCTURE_IMPACT,
  modules: [
    { path: 'architecture.md', reason: 'Modules changed' },
    { path: 'dependency-map.md', reason: 'Modules changed' },
    { path: 'ai-context.md', reason: 'Modules changed' },
    { path: 'implementation-guide.md', reason: 'Modules changed' },
    { path: 'PROJECT_MAP.md', reason: 'Modules changed' },
    { path: 'DOCUMENTATION_STATUS.md', reason: 'Modules changed' },
    { path: 'module-documentation-plan.md', reason: 'Modules changed' },
  ],
  dependencyGraph: [
    { path: 'dependency-map.md', reason: 'Dependency graph changed' },
    { path: 'architecture.md', reason: 'Dependency graph changed' },
    { path: 'ai-context.md', reason: 'Dependency graph changed' },
  ],
  conventions: [
    { path: 'conventions.md', reason: 'Conventions changed' },
    { path: 'implementation-guide.md', reason: 'Conventions changed' },
    { path: 'ai-context.md', reason: 'Conventions changed' },
    { path: 'agent-navigation.md', reason: 'Conventions changed' },
  ],
  navigationMap: [
    { path: 'agent-navigation.md', reason: 'Navigation map changed' },
    { path: 'ai-context.md', reason: 'Navigation map changed' },
    { path: 'CONTEXT_ROUTER.md', reason: 'Navigation map changed' },
  ],
  operationalContext: [
    { path: 'AI_START_HERE.md', reason: 'Operational context changed' },
    { path: 'architecture.md', reason: 'Operational context changed' },
    { path: 'ai-context.md', reason: 'Operational context changed' },
  ],
  aiInsights: [
    { path: 'architecture.md', reason: 'AI insights changed' },
    { path: 'ai-context.md', reason: 'AI insights changed' },
    { path: 'implementation-guide.md', reason: 'AI insights changed' },
    { path: 'agent-navigation.md', reason: 'AI insights changed' },
  ],
  stagedDocumentation: [
    { path: 'architecture.md', reason: 'Staged documentation changed' },
    { path: 'ai-context.md', reason: 'Staged documentation changed' },
    { path: 'implementation-guide.md', reason: 'Staged documentation changed' },
    { path: 'agent-navigation.md', reason: 'Staged documentation changed' },
    { path: 'module-documentation-plan.md', reason: 'Staged documentation changed' },
    { path: 'DOCUMENTATION_STATUS.md', reason: 'Staged documentation changed' },
    { path: 'DOCUMENTATION_MAINTENANCE.md', reason: 'Staged documentation changed' },
  ],
  documentation: [],
};

interface DocumentImpactAccumulator {
  sections: Set<ChangeSection>;
  reasons: Set<string>;
}

function shouldRegenerateAllPlannedDocuments(changeSummary: ChangeSummaryKnowledge): boolean {
  return (
    changeSummary.isInitialRun ||
    changeSummary.baselineStatus === 'unreadable' ||
    changeSummary.changedSections.includes('documentation')
  );
}

function resolveFullRegenerationReason(changeSummary: ChangeSummaryKnowledge): string {
  if (changeSummary.isInitialRun) {
    return 'Initial run — all planned documents are regenerated';
  }

  if (changeSummary.baselineStatus === 'unreadable') {
    return 'Unreadable baseline — all planned documents are regenerated';
  }

  return 'Documentation plan or generator version changed — all planned documents are regenerated';
}

function buildFullRegenerationImpact(
  plannedDocuments: readonly PlannedDocument[],
  changeSummary: ChangeSummaryKnowledge,
  generatedAt: string,
): DocumentImpactSummary {
  const reason = resolveFullRegenerationReason(changeSummary);

  return {
    impactedDocuments: plannedDocuments.map((document) => ({
      documentPath: document.relativePath,
      reason,
      impactedBy: changeSummary.changedSections,
      shouldRegenerate: true,
    })),
    unchangedDocuments: [],
    generatedAt,
  };
}

function appendTechnologyDocumentImpacts(
  impacts: Map<string, DocumentImpactAccumulator>,
  plannedDocuments: readonly PlannedDocument[],
): void {
  for (const document of plannedDocuments) {
    if (document.source !== 'technology') {
      continue;
    }

    const existing = impacts.get(document.relativePath);
    if (existing) {
      existing.sections.add('technologies');
      existing.reasons.add('Technologies changed');
      continue;
    }

    impacts.set(document.relativePath, {
      sections: new Set(['technologies']),
      reasons: new Set(['Technologies changed']),
    });
  }
}

function isStagedOrPlaybookDocument(document: PlannedDocument): boolean {
  return (
    document.source === 'playbook' ||
    document.source === 'module' ||
    document.stage === 'routing' ||
    document.stage === 'module-plan' ||
    document.stage === 'module' ||
    document.generatorKind === 'staged-architecture' ||
    document.generatorKind === 'staged-module-plan' ||
    document.generatorKind === 'staged-module'
  );
}

function isModuleScopedDocument(document: PlannedDocument): boolean {
  return (
    document.source === 'module' ||
    document.stage === 'module' ||
    document.stage === 'module-plan' ||
    document.generatorKind === 'staged-module' ||
    document.generatorKind === 'staged-module-plan'
  );
}

/**
 * Marks planned documents that present staged PKM data as impacted.
 * Uses PlannedDocument metadata rather than path heuristics.
 */
function appendMetadataDocumentImpacts(
  impacts: Map<string, DocumentImpactAccumulator>,
  plannedDocuments: readonly PlannedDocument[],
  section: ChangeSection,
  reason: string,
  predicate: (document: PlannedDocument) => boolean,
): void {
  for (const document of plannedDocuments) {
    if (!predicate(document)) {
      continue;
    }

    upsertSectionImpact(impacts, document.relativePath, section, reason);
  }
}

function upsertSectionImpact(
  impacts: Map<string, DocumentImpactAccumulator>,
  documentPath: string,
  section: ChangeSection,
  reason: string,
): void {
  const existing = impacts.get(documentPath);
  if (existing) {
    existing.sections.add(section);
    existing.reasons.add(reason);
    return;
  }

  impacts.set(documentPath, {
    sections: new Set([section]),
    reasons: new Set([reason]),
  });
}

function appendChangeLogImpact(
  impacts: Map<string, DocumentImpactAccumulator>,
  changedSections: readonly ChangeSection[],
): void {
  if (changedSections.length === 0) {
    return;
  }

  for (const section of changedSections) {
    upsertSectionImpact(
      impacts,
      'change-log.md',
      section,
      'PKM sections changed',
    );
  }
}

function appendDependentDocumentImpacts(
  impacts: Map<string, DocumentImpactAccumulator>,
  plannedDocuments: readonly PlannedDocument[],
): void {
  let expanded = true;

  while (expanded) {
    expanded = false;

    for (const document of plannedDocuments) {
      if (impacts.has(document.relativePath) || document.dependsOn === undefined) {
        continue;
      }

      const triggeredDependencies = document.dependsOn.filter((dependency) =>
        impacts.has(dependency),
      );

      if (triggeredDependencies.length === 0) {
        continue;
      }

      const accumulator: DocumentImpactAccumulator = {
        sections: new Set(),
        reasons: new Set([
          `Depends on updated document(s): ${triggeredDependencies.sort().join(', ')}`,
        ]),
      };

      for (const dependency of triggeredDependencies) {
        const upstream = impacts.get(dependency);
        if (!upstream) {
          continue;
        }

        for (const section of upstream.sections) {
          accumulator.sections.add(section);
        }
      }

      impacts.set(document.relativePath, accumulator);
      expanded = true;
    }
  }
}

function collectSectionImpacts(
  changeSummary: ChangeSummaryKnowledge,
  plannedDocuments: readonly PlannedDocument[],
): Map<string, DocumentImpactAccumulator> {
  const impacts = new Map<string, DocumentImpactAccumulator>();

  for (const section of changeSummary.changedSections) {
    for (const entry of SECTION_DOCUMENT_IMPACT[section]) {
      upsertSectionImpact(impacts, entry.path, section, entry.reason);
    }

    if (section === 'technologies') {
      appendTechnologyDocumentImpacts(impacts, plannedDocuments);
    }

    if (section === 'modules') {
      appendMetadataDocumentImpacts(
        impacts,
        plannedDocuments,
        'modules',
        'Modules changed',
        isModuleScopedDocument,
      );
    }

    if (section === 'stagedDocumentation') {
      appendMetadataDocumentImpacts(
        impacts,
        plannedDocuments,
        'stagedDocumentation',
        'Staged documentation changed',
        isStagedOrPlaybookDocument,
      );
    }

    if (section === 'aiInsights') {
      appendMetadataDocumentImpacts(
        impacts,
        plannedDocuments,
        'aiInsights',
        'AI insights changed',
        (document) =>
          document.generatorKind === 'staged-architecture' ||
          document.stage === 'architecture',
      );
    }
  }

  appendChangeLogImpact(impacts, changeSummary.changedSections);
  appendDependentDocumentImpacts(impacts, plannedDocuments);

  return impacts;
}

function formatImpactReason(accumulator: DocumentImpactAccumulator): string {
  return [...accumulator.reasons].sort().join('; ');
}

export function analyzeDocumentImpact(
  changeSummary: ChangeSummaryKnowledge,
  plannedDocuments: readonly PlannedDocument[],
): DocumentImpactSummary {
  const generatedAt = new Date().toISOString();
  const plannedPaths = plannedDocuments.map((document) => document.relativePath);

  if (shouldRegenerateAllPlannedDocuments(changeSummary)) {
    return buildFullRegenerationImpact(plannedDocuments, changeSummary, generatedAt);
  }

  const sectionImpacts = collectSectionImpacts(changeSummary, plannedDocuments);
  const impactedDocuments: DocumentImpact[] = [];

  for (const documentPath of plannedPaths) {
    const accumulator = sectionImpacts.get(documentPath);
    if (!accumulator) {
      continue;
    }

    impactedDocuments.push({
      documentPath,
      reason: formatImpactReason(accumulator),
      impactedBy: [...accumulator.sections].sort(),
      shouldRegenerate: true,
    });
  }

  impactedDocuments.sort((left, right) => left.documentPath.localeCompare(right.documentPath));

  const impactedPaths = new Set(impactedDocuments.map((impact) => impact.documentPath));
  const unchangedDocuments = plannedPaths
    .filter((documentPath) => !impactedPaths.has(documentPath))
    .sort();

  return {
    impactedDocuments,
    unchangedDocuments,
    generatedAt,
  };
}

export function requiresFullDocumentRegeneration(
  changeSummary: ChangeSummaryKnowledge,
): boolean {
  return shouldRegenerateAllPlannedDocuments(changeSummary);
}

export function isUnreadableBaseline(
  baselineStatus: ChangeBaselineStatus,
): boolean {
  return baselineStatus === 'unreadable';
}
