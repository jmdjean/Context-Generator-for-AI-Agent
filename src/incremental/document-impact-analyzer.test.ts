import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PlannedDocument } from '../domain/documentation-plan';
import { ChangeSummaryKnowledge } from '../knowledge';
import { analyzeDocumentImpact, requiresFullDocumentRegeneration } from './document-impact-analyzer';

const PLANNED_DOCUMENTS: PlannedDocument[] = [
  {
    title: 'Architecture',
    relativePath: 'architecture.md',
    purpose: 'Architecture overview',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Folder Structure',
    relativePath: 'folder-structure.md',
    purpose: 'Folder map',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'AI Context',
    relativePath: 'ai-context.md',
    purpose: 'AI context',
    priority: 'required',
    source: 'agent',
  },
  {
    title: 'Dependency Map',
    relativePath: 'dependency-map.md',
    purpose: 'Dependencies',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Conventions',
    relativePath: 'conventions.md',
    purpose: 'Conventions',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Agent Navigation',
    relativePath: 'agent-navigation.md',
    purpose: 'Navigation',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Implementation Guide',
    relativePath: 'implementation-guide.md',
    purpose: 'Implementation guide',
    priority: 'required',
    source: 'agent',
  },
  {
    title: 'Agent Instructions',
    relativePath: 'AGENTS.md',
    purpose: 'Agent entry point',
    priority: 'required',
    source: 'agent',
    dependsOn: ['architecture.md', 'folder-structure.md'],
  },
  {
    title: 'README',
    relativePath: 'README.md',
    purpose: 'Overview',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Change Log',
    relativePath: 'change-log.md',
    purpose: 'Changes',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Technology Overview',
    relativePath: 'technology-overview.md',
    purpose: 'Stack overview',
    priority: 'required',
    source: 'technology',
  },
];

function buildChangeSummary(
  overrides: Partial<ChangeSummaryKnowledge> = {},
): ChangeSummaryKnowledge {
  return {
    isInitialRun: false,
    baselineStatus: 'loaded',
    warnings: [],
    changedSections: [],
    addedModules: [],
    removedModules: [],
    changedTechnologies: [],
    technologyConfidenceChanged: false,
    addedFolders: [],
    removedFolders: [],
    dependencyEdgeChanges: [],
    generatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('analyzeDocumentImpact', () => {
  it('regenerates all planned documents on initial run', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ isInitialRun: true, baselineStatus: 'none' }),
      PLANNED_DOCUMENTS,
    );

    assert.equal(summary.impactedDocuments.length, PLANNED_DOCUMENTS.length);
    assert.equal(summary.unchangedDocuments.length, 0);
    assert.ok(summary.impactedDocuments.every((impact) => impact.shouldRegenerate));
  });

  it('regenerates all planned documents when the baseline snapshot is unreadable', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ baselineStatus: 'unreadable', warnings: ['unreadable snapshot'] }),
      PLANNED_DOCUMENTS,
    );

    assert.equal(summary.impactedDocuments.length, PLANNED_DOCUMENTS.length);
    assert.match(summary.impactedDocuments[0]?.reason ?? '', /Unreadable baseline/);
    assert.equal(requiresFullDocumentRegeneration(buildChangeSummary({ baselineStatus: 'unreadable' })), true);
  });

  it('regenerates all planned documents when the documentation plan or generator version changed', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['documentation'] }),
      PLANNED_DOCUMENTS,
    );

    assert.equal(summary.impactedDocuments.length, PLANNED_DOCUMENTS.length);
    assert.match(summary.impactedDocuments[0]?.reason ?? '', /Documentation plan or generator version changed/);
  });

  it('maps technology changes to core docs and technology-specific planned documents', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['technologies'] }),
      PLANNED_DOCUMENTS,
    );

    assert.deepEqual(
      summary.impactedDocuments.map((impact) => impact.documentPath).sort(),
      [
        'AGENTS.md',
        'ai-context.md',
        'architecture.md',
        'change-log.md',
        'implementation-guide.md',
        'technology-overview.md',
      ],
    );
  });

  it('includes change-log.md when any PKM section changed', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['modules'] }),
      PLANNED_DOCUMENTS,
    );

    assert.ok(
      summary.impactedDocuments.some((impact) => impact.documentPath === 'change-log.md'),
    );
  });

  it('invalidates dependent documents when upstream docs are impacted', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['modules'] }),
      PLANNED_DOCUMENTS,
    );

    assert.ok(summary.impactedDocuments.some((impact) => impact.documentPath === 'AGENTS.md'));
    assert.match(
      summary.impactedDocuments.find((impact) => impact.documentPath === 'AGENTS.md')?.reason ?? '',
      /Depends on updated document/,
    );
  });

  it('maps repository tree changes like folder structure documents', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['repositoryTree'] }),
      PLANNED_DOCUMENTS,
    );

    assert.deepEqual(
      summary.impactedDocuments.map((impact) => impact.documentPath).sort(),
      [
        'AGENTS.md',
        'agent-navigation.md',
        'ai-context.md',
        'architecture.md',
        'change-log.md',
        'folder-structure.md',
      ],
    );
  });

  it('maps detected file changes to overview documents in the plan', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['detectedFiles'] }),
      PLANNED_DOCUMENTS,
    );

    assert.deepEqual(
      summary.impactedDocuments.map((impact) => impact.documentPath).sort(),
      ['README.md', 'change-log.md', 'technology-overview.md'],
    );
  });

  it('merges impacts when multiple sections affect the same document', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['technologies', 'modules'] }),
      PLANNED_DOCUMENTS,
    );

    const architectureImpact = summary.impactedDocuments.find(
      (impact) => impact.documentPath === 'architecture.md',
    );

    assert.ok(architectureImpact);
    assert.deepEqual(architectureImpact.impactedBy.sort(), ['modules', 'technologies']);
    assert.match(architectureImpact.reason, /Technologies changed/);
    assert.match(architectureImpact.reason, /Modules changed/);
  });

  it('returns no impacted documents when no mapped sections changed', () => {
    const summary = analyzeDocumentImpact(buildChangeSummary(), PLANNED_DOCUMENTS);

    assert.equal(summary.impactedDocuments.length, 0);
    assert.equal(summary.unchangedDocuments.length, PLANNED_DOCUMENTS.length);
  });

  it('maps staged documentation changes to playbook and module docs via metadata', () => {
    const stagedDocuments: PlannedDocument[] = [
      ...PLANNED_DOCUMENTS,
      {
        title: 'Module Documentation Plan',
        relativePath: 'module-documentation-plan.md',
        purpose: 'Module plan',
        priority: 'required',
        source: 'playbook',
        stage: 'module-plan',
        generatorKind: 'staged-module-plan',
      },
      {
        title: 'Documentation Status',
        relativePath: 'DOCUMENTATION_STATUS.md',
        purpose: 'Status',
        priority: 'recommended',
        source: 'playbook',
        stage: 'routing',
        generatorKind: 'deterministic',
      },
      {
        title: 'Core Module',
        relativePath: 'code/components/src-core.md',
        purpose: 'Module card',
        priority: 'required',
        source: 'module',
        stage: 'module',
        generatorKind: 'staged-module',
        moduleId: 'src/core',
      },
    ];

    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['stagedDocumentation'] }),
      stagedDocuments,
    );

    const impacted = summary.impactedDocuments.map((impact) => impact.documentPath).sort();
    assert.ok(impacted.includes('architecture.md'));
    assert.ok(impacted.includes('module-documentation-plan.md'));
    assert.ok(impacted.includes('DOCUMENTATION_STATUS.md'));
    assert.ok(impacted.includes('code/components/src-core.md'));
    assert.ok(impacted.includes('change-log.md'));
    assert.equal(impacted.includes('technology-overview.md'), false);
  });

  it('maps module changes to per-module planned documents', () => {
    const withModuleDoc: PlannedDocument[] = [
      ...PLANNED_DOCUMENTS,
      {
        title: 'Core Module',
        relativePath: 'code/components/src-core.md',
        purpose: 'Module card',
        priority: 'required',
        source: 'module',
        stage: 'module',
        generatorKind: 'staged-module',
        moduleId: 'src/core',
      },
    ];

    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['modules'] }),
      withModuleDoc,
    );

    assert.ok(
      summary.impactedDocuments.some(
        (impact) => impact.documentPath === 'code/components/src-core.md',
      ),
    );
  });

  it('sorts unchanged documents for stable output', () => {
    const summary = analyzeDocumentImpact(
      buildChangeSummary({ changedSections: ['navigationMap'] }),
      PLANNED_DOCUMENTS,
    );

    const sorted = [...summary.unchangedDocuments].sort();
    assert.deepEqual(summary.unchangedDocuments, sorted);
  });
});
