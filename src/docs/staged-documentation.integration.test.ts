/**
 * Focused staged-documentation verification: planning expansion → writer
 * ordering → PKM-backed module/playbook rendering without calling AI providers.
 *
 * AI architecture and per-module fan-out paths are covered by
 * `src/ai/ai-analysis.test.ts` with fake providers (residual risk for live
 * provider integrations).
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { ProjectKnowledge } from '../knowledge';
import { ModuleKnowledge } from '../knowledge/project-knowledge';
import {
  expandProjectKnowledgeWithModuleDocumentationPlan,
  MODULE_DOCUMENTATION_PLAN_PATH,
} from './documentation-planner';
import { GENERATED_FILE_MARKER } from './document-template';
import { writeDocumentation } from './documentation-writer';
import { validateDocumentation } from './documentation-validator';

function buildModule(
  relativePath: string,
  name: string,
  responsibility: string,
): ModuleKnowledge {
  return {
    path: relativePath,
    relativePath,
    name,
    type: 'core',
    responsibility,
    importantFiles: [`${relativePath}/index.ts`],
    relatedFolders: [relativePath],
    signals: [`path:${relativePath}`],
    confidence: 'high',
  };
}

function buildBaselineKnowledge(rootPath: string): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'staged-fixture',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'staged-fixture',
      rootPath,
      detectedFiles: ['package.json', 'tsconfig.json'],
      ignoredPaths: ['node_modules'],
    },
    technologies: {
      languages: ['TypeScript'],
      frameworks: [],
      packageManagers: ['npm'],
      tooling: ['TypeScript'],
      confidence: 'high',
    },
    documentation: {
      plan: {
        docsDir: '.ai-docs',
        documents: [
          {
            title: 'Architecture',
            relativePath: 'architecture.md',
            purpose: 'Architecture overview',
            priority: 'required',
            source: 'core',
            stage: 'architecture',
            generatorKind: 'staged-architecture',
          },
          {
            title: 'AGENTS',
            relativePath: 'AGENTS.md',
            purpose: 'Agent entry',
            priority: 'required',
            source: 'agent',
            stage: 'baseline',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'partial',
      modules: [
        buildModule('src/core', 'core', 'Pipeline orchestration'),
        buildModule('src/docs', 'docs', 'Documentation generators'),
      ],
      stagedDocumentation: {
        architecture: {
          status: 'completed',
          summary: 'CLI with staged PKM documentation.',
          content: 'Architecture is assembled from analyzers then enriched optionally.',
          documentPaths: ['architecture.md'],
          warnings: [],
        },
        execution: [
          {
            stageId: 'architecture',
            status: 'completed',
            warnings: [],
          },
        ],
      },
    },
  };
}

describe('staged documentation integration (PKM-backed)', () => {
  it('expands the plan, writes architecture → module-plan → modules, and validates coverage', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-docs-integration-'));

    try {
      const baseline = buildBaselineKnowledge(rootPath);
      const expansion = expandProjectKnowledgeWithModuleDocumentationPlan(baseline);
      const knowledge = expansion.knowledge;

      assert.equal(expansion.moduleCount, 2);
      assert.ok(knowledge.analysis.stagedDocumentation?.modulePlan);
      assert.equal(knowledge.analysis.stagedDocumentation?.modulePlan?.entries.length, 2);

      // Inject completed moduleResults so renderers prove PKM enrichment (not filesystem scrape).
      const planEntries = knowledge.analysis.stagedDocumentation!.modulePlan!.entries;
      knowledge.analysis.stagedDocumentation!.moduleResults = {
        status: 'completed',
        results: planEntries.map((entry) => ({
          moduleId: entry.moduleId,
          moduleName: entry.moduleName,
          moduleRelativePath: entry.moduleRelativePath,
          documentPath: entry.documentPath,
          status: 'completed' as const,
          summary: `AI summary for ${entry.moduleName}`,
          content: `AI body for ${entry.moduleName} from staged PKM.`,
          warnings: [],
        })),
        warnings: [],
      };

      const writeResult = writeDocumentation(knowledge);

      assert.ok(writeResult.writtenPaths.includes('architecture.md'));
      assert.ok(writeResult.writtenPaths.includes(MODULE_DOCUMENTATION_PLAN_PATH));
      assert.ok(writeResult.writtenPaths.includes('AI_START_HERE.md'));
      assert.ok(writeResult.writtenPaths.includes('DOCUMENTATION_STATUS.md'));

      const architectureIndex = writeResult.writtenPaths.indexOf('architecture.md');
      const modulePlanIndex = writeResult.writtenPaths.indexOf(MODULE_DOCUMENTATION_PLAN_PATH);
      const firstModuleIndex = writeResult.writtenPaths.indexOf(planEntries[0]!.documentPath);
      const secondModuleIndex = writeResult.writtenPaths.indexOf(planEntries[1]!.documentPath);

      assert.ok(architectureIndex >= 0 && modulePlanIndex >= 0);
      assert.ok(architectureIndex < modulePlanIndex, 'architecture must be written before module-plan');
      assert.ok(modulePlanIndex < firstModuleIndex, 'module-plan must precede module cards');
      assert.ok(firstModuleIndex < secondModuleIndex, 'module cards follow plan order');

      const docsRoot = path.join(rootPath, '.ai-docs');
      const architecture = fs.readFileSync(path.join(docsRoot, 'architecture.md'), 'utf-8');
      assert.ok(architecture.startsWith(GENERATED_FILE_MARKER));
      assert.ok(
        architecture.includes('CLI with staged PKM documentation.') ||
          architecture.includes('Architecture is assembled from analyzers'),
        'architecture.md should present staged architecture PKM content',
      );

      const modulePlanDoc = fs.readFileSync(
        path.join(docsRoot, MODULE_DOCUMENTATION_PLAN_PATH),
        'utf-8',
      );
      assert.ok(modulePlanDoc.includes(planEntries[0]!.moduleId));
      assert.ok(modulePlanDoc.includes(planEntries[1]!.moduleId));

      for (const entry of planEntries) {
        const moduleDoc = fs.readFileSync(path.join(docsRoot, entry.documentPath), 'utf-8');
        assert.ok(moduleDoc.startsWith(GENERATED_FILE_MARKER));
        assert.ok(moduleDoc.includes('## Deterministic module facts'));
        assert.ok(moduleDoc.includes(entry.moduleId) || moduleDoc.includes(entry.moduleName));
        assert.ok(
          moduleDoc.includes(`AI summary for ${entry.moduleName}`),
          `${entry.documentPath} should render staged moduleResults from PKM`,
        );
        assert.ok(moduleDoc.includes(`AI body for ${entry.moduleName} from staged PKM.`));
      }

      const validation = validateDocumentation(knowledge, writeResult);
      assert.equal(validation.status, 'passed', JSON.stringify(validation.issues, null, 2));
      assert.equal(validation.errorCount, 0);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });
});
