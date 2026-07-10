import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enrichProjectKnowledgeWithConventions } from '../analyzers/convention-analyzer';
import { enrichProjectKnowledgeWithDependencyGraph } from '../analyzers/dependency-graph-analyzer';
import { enrichProjectKnowledgeWithFolderAnalysis } from '../analyzers/folder-analyzer';
import { enrichProjectKnowledgeWithModuleAnalysis } from '../analyzers/module-analyzer';
import { enrichProjectKnowledgeWithNavigationMap } from '../analyzers/navigation-map-analyzer';
import { ProjectKnowledge } from '../knowledge';
import {
  BUILTIN_ANALYZER_PLUGINS,
  BUILTIN_ANALYZER_PLUGIN_ORDER,
  CONVENTION_ANALYZER_PLUGIN_ID,
  DEPENDENCY_ANALYZER_PLUGIN_ID,
  FOLDER_ANALYZER_PLUGIN_ID,
  MODULE_ANALYZER_PLUGIN_ID,
  NAVIGATION_ANALYZER_PLUGIN_ID,
} from './builtin';
import { createPluginContext, PluginContext } from './plugin-context';
import { createConsolePluginLogger, PluginLogger } from './plugin-logger';
import { createPluginManager } from './plugin-manager';
import { mergePluginContributions } from './plugin-merger';
import {
  mapPluginOutcomeToAnalyzerStep,
  resolveAnalyzerStepStatus,
} from './pipeline-integration';
import { PluginRegistry, resetDefaultPluginRegistry } from './plugin-registry';
import { createCompletedPluginResult } from './plugin-result';
import { createRepositoryBoundary, RepositoryBoundary } from '../scanner/repository-boundary';
import { conventionAnalyzerPlugin } from './builtin/convention-analyzer-plugin';
import { angularPlugin } from './technology/angular-plugin';
import { nodePlugin } from './technology/node-plugin';

function createMinimalKnowledge(): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'test-project',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'test-project',
      rootPath: process.cwd(),
      detectedFiles: ['package.json'],
      ignoredPaths: [],
      repositoryTree: {
        type: 'directory',
        name: 'test-project',
        path: 'test-project',
        relativePath: '',
        children: [
          {
            type: 'directory',
            name: 'src',
            path: 'src',
            relativePath: 'src',
            children: [
              {
                type: 'file',
                name: 'index.ts',
                path: 'src/index.ts',
                relativePath: 'src/index.ts',
              },
            ],
          },
        ],
      },
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
        strategy: 'core',
        documents: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
    analysis: {
      status: 'pending',
    },
  };
}

function createPluginRuntime(knowledge: ProjectKnowledge, logger: PluginLogger = createConsolePluginLogger()) {
  return createPluginContext({
    knowledge,
    config: {
      targetProjectPath: knowledge.repository.rootPath,
      docsDir: '.ai-docs',
      enableAiAnalysis: false,
      aiModel: 'test-model',
      enableAgentExports: false,
      exportTargets: ['generic'],
    },
    boundary: createRepositoryBoundary(knowledge.repository.rootPath),
    logger,
  });
}

function createTrackingBoundary(rootPath: string): {
  boundary: RepositoryBoundary;
  resolvedPaths: string[];
} {
  const base = createRepositoryBoundary(rootPath);
  const resolvedPaths: string[] = [];

  return {
    resolvedPaths,
    boundary: {
      rootPath: base.rootPath,
      resolveRelative(relativePath: string): string {
        resolvedPaths.push(relativePath);
        return base.resolveRelative(relativePath);
      },
      toRelative(absolutePath: string): string {
        return base.toRelative(absolutePath);
      },
    },
  };
}

describe('PluginRegistry', () => {
  it('lists built-in analyzer plugins', () => {
    const registry = new PluginRegistry();
    const analyzers = registry.listAnalyzerPlugins();

    assert.ok(analyzers.length >= 5);
    assert.ok(analyzers.some((plugin) => plugin.id === FOLDER_ANALYZER_PLUGIN_ID));
  });

  it('lists technology plugins', () => {
    const registry = new PluginRegistry();
    const technologies = registry.listTechnologyPlugins();

    assert.equal(technologies.length, 4);
    assert.ok(technologies.some((plugin) => plugin.id === 'technology.angular'));
  });

  it('rejects duplicate plugin ids in constructor', () => {
    assert.throws(
      () =>
        new PluginRegistry([
          BUILTIN_ANALYZER_PLUGINS[0],
          { ...BUILTIN_ANALYZER_PLUGINS[0] },
        ]),
      /Duplicate plugin id registered/,
    );
  });

  it('rejects duplicate plugin ids in register()', () => {
    const registry = new PluginRegistry();
    const plugin = BUILTIN_ANALYZER_PLUGINS[0];

    assert.throws(() => registry.register(plugin), /Duplicate plugin id registered/);
  });
});

describe('PluginManager', () => {
  it('executes folder analyzer plugin without changing pipeline contract', () => {
    resetDefaultPluginRegistry();
    const manager = createPluginManager();
    const knowledge = createMinimalKnowledge();
    const context = createPluginRuntime(knowledge);

    const outcome = manager.executeAnalyzerPlugin(FOLDER_ANALYZER_PLUGIN_ID, context);

    assert.equal(outcome.result.status, 'completed');
    assert.match(outcome.result.message, /analyzed \d+ folder\(s\)/);
    assert.ok((outcome.knowledge.analysis.folderContexts?.length ?? 0) > 0);
    assert.equal(outcome.knowledge.analysis.status, 'partial');
  });

  it('returns failed when analyzer plugin id is unknown', () => {
    const manager = createPluginManager();
    const context = createPluginRuntime(createMinimalKnowledge());
    const outcome = manager.executeAnalyzerPlugin('builtin.missing', context);

    assert.equal(outcome.result.status, 'failed');
  });

  it('isolates plugin failures without corrupting PKM', () => {
    const failingPlugin = {
      ...BUILTIN_ANALYZER_PLUGINS[0],
      analyze() {
        throw new Error('simulated plugin failure');
      },
    };
    const manager = createPluginManager(new PluginRegistry([failingPlugin]));
    const knowledge = createMinimalKnowledge();
    const context = createPluginRuntime(knowledge);
    const outcome = manager.executeAnalyzerPlugin(failingPlugin.id, context);

    assert.equal(outcome.result.status, 'failed');
    assert.deepEqual(outcome.knowledge, knowledge);
    assert.ok((outcome.result.warnings?.length ?? 0) > 0);
  });

  it('isolates supports() failures without corrupting PKM', () => {
    const plugin = {
      ...BUILTIN_ANALYZER_PLUGINS[0],
      supports() {
        throw new Error('simulated supports failure');
      },
    };
    const manager = createPluginManager(new PluginRegistry([plugin]));
    const knowledge = createMinimalKnowledge();
    const context = createPluginRuntime(knowledge);
    const outcome = manager.executeAnalyzerPlugin(plugin.id, context);

    assert.equal(outcome.result.status, 'failed');
    assert.deepEqual(outcome.knowledge, knowledge);
    assert.match(outcome.result.warnings?.[0] ?? '', /supports\(\) threw/);
  });

  it('warns when legacy knowledge field is used', () => {
    const warnings: string[] = [];
    const logger: PluginLogger = {
      info() {},
      warn(message: string) {
        warnings.push(message);
      },
      error() {},
    };
    const plugin = {
      ...BUILTIN_ANALYZER_PLUGINS[0],
      analyze(context: PluginContext) {
        const enriched = enrichProjectKnowledgeWithFolderAnalysis(context.knowledge);
        return createCompletedPluginResult('legacy knowledge path', {
          knowledge: enriched.knowledge,
        });
      },
    };
    const manager = createPluginManager(new PluginRegistry([plugin]));
    const context = createPluginRuntime(createMinimalKnowledge(), logger);
    manager.executeAnalyzerPlugin(plugin.id, context);

    assert.ok(warnings.some((warning) => warning.includes('deprecated knowledge field')));
  });

  it('warns when both knowledge and contributions are returned', () => {
    const warnings: string[] = [];
    const logger: PluginLogger = {
      info() {},
      warn(message: string) {
        warnings.push(message);
      },
      error() {},
    };
    const plugin = {
      ...BUILTIN_ANALYZER_PLUGINS[0],
      analyze(context: PluginContext) {
        const enriched = enrichProjectKnowledgeWithFolderAnalysis(context.knowledge);
        return createCompletedPluginResult('dual path', {
          knowledge: enriched.knowledge,
          contributions: {
            folderContexts: enriched.knowledge.analysis.folderContexts,
          },
        });
      },
    };
    const manager = createPluginManager(new PluginRegistry([plugin]));
    const context = createPluginRuntime(createMinimalKnowledge(), logger);
    manager.executeAnalyzerPlugin(plugin.id, context);

    assert.ok(
      warnings.some((warning) => warning.includes('both knowledge and contributions')),
    );
  });

  it('stops batch execution after the first failed plugin', () => {
    const executionOrder: string[] = [];
    const trackingPlugins = BUILTIN_ANALYZER_PLUGIN_ORDER.map((pluginId, index) => {
      const plugin = BUILTIN_ANALYZER_PLUGINS.find((entry) => entry.id === pluginId);
      assert.ok(plugin !== undefined);

      return {
        ...plugin,
        analyze(context: PluginContext) {
          executionOrder.push(plugin.id);
          if (index === 1) {
            throw new Error('simulated batch failure');
          }
          return plugin.analyze(context);
        },
      };
    });

    const manager = createPluginManager(new PluginRegistry(trackingPlugins));
    const summary = manager.executeBuiltinAnalyzerPlugins(createPluginRuntime(createMinimalKnowledge()));

    assert.equal(summary.results.length, 2);
    assert.equal(summary.results[0]?.status, 'completed');
    assert.equal(summary.results[1]?.status, 'failed');
    assert.deepEqual(executionOrder, BUILTIN_ANALYZER_PLUGIN_ORDER.slice(0, 2));
  });

  it('convention plugin uses boundary from PluginContext', () => {
    const knowledge = createMinimalKnowledge();
    const { boundary, resolvedPaths } = createTrackingBoundary(knowledge.repository.rootPath);
    const context = createPluginContext({
      knowledge,
      config: {
        targetProjectPath: knowledge.repository.rootPath,
        docsDir: '.ai-docs',
        enableAiAnalysis: false,
        aiModel: 'test-model',
        enableAgentExports: false,
        exportTargets: ['generic'],
      },
      boundary,
      logger: createConsolePluginLogger(),
    });

    const result = conventionAnalyzerPlugin.analyze(context);

    assert.equal(result.status, 'completed');
    assert.ok(resolvedPaths.includes('package.json'));
  });

  it('does not merge contributions from failed plugin results', () => {
    const plugin = {
      ...BUILTIN_ANALYZER_PLUGINS[0],
      analyze(context: PluginContext) {
        return {
          status: 'failed' as const,
          message: 'failed: test',
          contributions: {
            folderContexts: [
              {
                path: 'src',
                relativePath: 'src',
                name: 'src',
                depth: 1,
                classification: 'source',
                responsibility: 'fixture',
                importantFiles: [],
                childFolders: [],
                signals: [],
                confidence: 'high',
              },
            ],
          },
        };
      },
    };
    const manager = createPluginManager(new PluginRegistry([plugin]));
    const knowledge = createMinimalKnowledge();
    const context = createPluginRuntime(knowledge);
    const outcome = manager.executeAnalyzerPlugin(plugin.id, context);

    assert.equal(outcome.result.status, 'failed');
    assert.equal(outcome.knowledge.analysis.folderContexts, undefined);
    assert.equal(outcome.knowledge.analysis.status, knowledge.analysis.status);
  });

  it('executes built-in plugins in declared order', () => {
    const executionOrder: string[] = [];
    const trackingPlugins = BUILTIN_ANALYZER_PLUGIN_ORDER.map((pluginId) => {
      const plugin = BUILTIN_ANALYZER_PLUGINS.find((entry) => entry.id === pluginId);
      assert.ok(plugin !== undefined);

      return {
        ...plugin,
        analyze(context: PluginContext) {
          executionOrder.push(plugin.id);
          return plugin.analyze(context);
        },
      };
    });

    const manager = createPluginManager(new PluginRegistry([...trackingPlugins].reverse()));
    const context = createPluginRuntime(createMinimalKnowledge());
    manager.executeBuiltinAnalyzerPlugins(context);

    assert.deepEqual(executionOrder, [...BUILTIN_ANALYZER_PLUGIN_ORDER]);
  });
});

describe('built-in plugin parity', () => {
  const parityCases: ReadonlyArray<{
    pluginId: string;
    enrich: (knowledge: ProjectKnowledge) => { knowledge: ProjectKnowledge };
  }> = [
    {
      pluginId: FOLDER_ANALYZER_PLUGIN_ID,
      enrich: enrichProjectKnowledgeWithFolderAnalysis,
    },
    {
      pluginId: MODULE_ANALYZER_PLUGIN_ID,
      enrich: enrichProjectKnowledgeWithModuleAnalysis,
    },
    {
      pluginId: DEPENDENCY_ANALYZER_PLUGIN_ID,
      enrich: enrichProjectKnowledgeWithDependencyGraph,
    },
    {
      pluginId: CONVENTION_ANALYZER_PLUGIN_ID,
      enrich: enrichProjectKnowledgeWithConventions,
    },
    {
      pluginId: NAVIGATION_ANALYZER_PLUGIN_ID,
      enrich: enrichProjectKnowledgeWithNavigationMap,
    },
  ];

  for (const parityCase of parityCases) {
    it(`${parityCase.pluginId} matches direct enrich output`, () => {
      const manager = createPluginManager();
      const knowledge = createMinimalKnowledge();
      const context = createPluginRuntime(knowledge);

      const pluginOutcome = manager.executeAnalyzerPlugin(parityCase.pluginId, context);
      const directOutcome = parityCase.enrich(knowledge);

      assert.deepEqual(pluginOutcome.knowledge, directOutcome.knowledge);
    });
  }
});

describe('mapPluginOutcomeToAnalyzerStep', () => {
  it('maps failed plugin results to failed step status', () => {
    const mapped = mapPluginOutcomeToAnalyzerStep({
      knowledge: createMinimalKnowledge(),
      result: {
        status: 'failed',
        message: 'analyzer plugin not found: builtin.missing',
      },
    });

    assert.equal(mapped.stepStatus, 'failed');
    assert.equal(mapped.message, 'analyzer plugin not found: builtin.missing');
  });

  it('maps skipped plugin results to skipped step status', () => {
    const mapped = mapPluginOutcomeToAnalyzerStep({
      knowledge: createMinimalKnowledge(),
      result: {
        status: 'skipped',
        message: 'skipped: not supported',
      },
    });

    assert.equal(mapped.stepStatus, 'skipped');
  });

  it('maps invalid plugin statuses to failed step status', () => {
    assert.equal(resolveAnalyzerStepStatus('completed'), 'completed');
    assert.equal(resolveAnalyzerStepStatus('bogus'), 'failed');

    const mapped = mapPluginOutcomeToAnalyzerStep({
      knowledge: createMinimalKnowledge(),
      result: {
        status: 'bogus' as 'completed',
        message: 'unexpected status',
      },
    });

    assert.equal(mapped.stepStatus, 'failed');
    assert.match(mapped.message, /invalid plugin status/);
  });
});

describe('mergePluginContributions', () => {
  it('does not set conventions when the contribution list is empty', () => {
    const knowledge = createMinimalKnowledge();
    const merged = mergePluginContributions(knowledge, { conventions: [] });

    assert.equal(merged.analysis.conventions, undefined);
    assert.equal(merged.analysis.status, 'pending');
  });

  it('sets modules to an empty array when structural analysis exists but no modules were found', () => {
    const knowledge = createMinimalKnowledge();
    const merged = mergePluginContributions(knowledge, { modules: [] });

    assert.deepEqual(merged.analysis.modules, []);
    assert.equal(merged.analysis.status, 'partial');
  });

  it('ignores folder contributions when the repository tree is missing', () => {
    const knowledge = createMinimalKnowledge();
    delete knowledge.repository.repositoryTree;

    const merged = mergePluginContributions(knowledge, {
      folderContexts: [
        {
          path: 'src',
          relativePath: 'src',
          name: 'src',
          depth: 1,
          classification: 'source',
          responsibility: 'fixture',
          importantFiles: [],
          childFolders: [],
          signals: [],
          confidence: 'high',
        },
      ],
    });

    assert.equal(merged.analysis.folderContexts, undefined);
    assert.equal(merged.analysis.status, 'pending');
  });

  it('merges aiInsights and marks analysis status partial', () => {
    const knowledge = createMinimalKnowledge();
    const merged = mergePluginContributions(knowledge, {
      aiInsights: {
        model: 'test-model',
        generatedAt: '2026-01-01T00:00:00.000Z',
        architectureSummary: 'summary',
      },
    });

    assert.equal(merged.analysis.aiInsights?.architectureSummary, 'summary');
    assert.equal(merged.analysis.status, 'partial');
  });
});

describe('technology plugins', () => {
  it('angularPlugin supports Angular projects from framework detection', () => {
    const knowledge = createMinimalKnowledge();
    knowledge.technologies.frameworks = ['Angular'];

    assert.equal(angularPlugin.supports(knowledge), true);
  });

  it('nodePlugin does not support projects with detected frameworks', () => {
    const knowledge = createMinimalKnowledge();
    knowledge.technologies.frameworks = ['Angular'];

    assert.equal(nodePlugin.supports(knowledge), false);
  });

  it('nodePlugin supports generic TypeScript projects without frameworks', () => {
    const knowledge = createMinimalKnowledge();

    assert.equal(nodePlugin.supports(knowledge), true);
  });
});
