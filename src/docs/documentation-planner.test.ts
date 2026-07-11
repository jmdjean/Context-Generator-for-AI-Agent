import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TechnologyProfile } from '../domain';
import { ModuleKnowledge, ProjectKnowledge } from '../knowledge';
import {
  buildModuleDocumentPath,
  createDocumentationPlan,
  expandDocumentationPlanWithModules,
  expandProjectKnowledgeWithModuleDocumentationPlan,
  MODULE_DOCUMENTATION_PLAN_PATH,
} from './documentation-planner';

function buildProfile(): TechnologyProfile {
  return {
    languages: ['TypeScript'],
    frameworks: [],
    packageManagers: ['npm'],
    tooling: ['TypeScript'],
    confidence: 'high',
  };
}

function buildModule(relativePath: string, confidence: ModuleKnowledge['confidence'] = 'high'): ModuleKnowledge {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    path: `/tmp/sample/${relativePath}`,
    relativePath,
    type: 'core',
    responsibility: `Responsibility for ${relativePath}`,
    importantFiles: [],
    relatedFolders: [],
    signals: [],
    confidence,
  };
}

function buildKnowledge(modules: ModuleKnowledge[]): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'sample',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'sample',
      rootPath: '/tmp/sample',
      detectedFiles: [],
      ignoredPaths: [],
    },
    technologies: buildProfile(),
    documentation: {
      plan: createDocumentationPlan('.ai-docs', buildProfile()),
    },
    analysis: {
      status: 'partial',
      modules,
    },
  };
}

describe('createDocumentationPlan', () => {
  it('marks baseline documents with stage and generator metadata', () => {
    const plan = createDocumentationPlan('.ai-docs', buildProfile());
    const architecture = plan.documents.find((document) => document.relativePath === 'architecture.md');

    assert.ok(architecture);
    assert.equal(architecture?.stage, 'architecture');
    assert.equal(architecture?.generatorKind, 'staged-architecture');
  });
});

describe('expandDocumentationPlanWithModules', () => {
  it('adds playbook routing docs, a module-plan doc, and one doc per module', () => {
    const baseline = createDocumentationPlan('.ai-docs', buildProfile());
    const expanded = expandDocumentationPlanWithModules(baseline, [
      buildModule('src/core'),
      buildModule('src/docs', 'low'),
    ]);

    assert.ok(expanded.strategy.includes('module-aware'));
    assert.ok(
      expanded.documents.some((document) => document.relativePath === 'AI_START_HERE.md'),
    );
    assert.ok(
      expanded.documents.some((document) => document.relativePath === MODULE_DOCUMENTATION_PLAN_PATH),
    );

    const moduleDocs = expanded.documents.filter((document) => document.stage === 'module');
    assert.equal(moduleDocs.length, 2);
    assert.equal(moduleDocs[0]?.moduleId, 'src/core');
    assert.equal(moduleDocs[0]?.order, 1);
    assert.equal(moduleDocs[1]?.moduleId, 'src/docs');
    assert.equal(moduleDocs[0]?.relativePath, buildModuleDocumentPath(buildModule('src/core')));
  });

  it('is idempotent when expanding an already module-aware plan', () => {
    const baseline = createDocumentationPlan('.ai-docs', buildProfile());
    const first = expandDocumentationPlanWithModules(baseline, [buildModule('src/core')]);
    const second = expandDocumentationPlanWithModules(first, [buildModule('src/core')]);

    const moduleDocs = second.documents.filter((document) => document.stage === 'module');
    assert.equal(moduleDocs.length, 1);
    assert.equal(
      second.documents.filter((document) => document.relativePath === MODULE_DOCUMENTATION_PLAN_PATH)
        .length,
      1,
    );
  });
});

describe('expandProjectKnowledgeWithModuleDocumentationPlan', () => {
  it('mirrors module-plan entries into stagedDocumentation', () => {
    const result = expandProjectKnowledgeWithModuleDocumentationPlan(
      buildKnowledge([buildModule('src/core'), buildModule('src/ai')]),
    );

    assert.equal(result.moduleCount, 2);
    assert.ok(result.addedDocuments > 0);
    assert.equal(result.knowledge.analysis.stagedDocumentation?.modulePlan?.status, 'completed');
    assert.equal(result.knowledge.analysis.stagedDocumentation?.modulePlan?.entries.length, 2);
    assert.equal(
      result.knowledge.analysis.stagedDocumentation?.execution.some(
        (entry) => entry.stageId === 'module-plan' && entry.status === 'completed',
      ),
      true,
    );
  });
});
