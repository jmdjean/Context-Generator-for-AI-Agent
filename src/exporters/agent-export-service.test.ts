import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { ProjectKnowledge } from '../knowledge';
import { runAgentExports } from './agent-export-service';
import {
  DEFAULT_ENABLED_EXPORT_TARGETS,
  GENERIC_AGENT_PACK_RELATIVE_PATH,
  CURSOR_RULES_RELATIVE_PATH,
} from './exporter-constants';
import {
  findUnsupportedExportTargets,
  getAgentExporterById,
  listSupportedExportTargets,
  resolveExportersForTarget,
} from './exporter-registry';

function createKnowledge(rootPath: string): ProjectKnowledge {
  return {
    metadata: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0',
      projectName: 'sample-project',
      docsDir: '.ai-docs',
    },
    repository: {
      name: 'sample-project',
      rootPath,
      detectedFiles: [],
      ignoredPaths: [],
    },
    technologies: {
      languages: ['TypeScript'],
      frameworks: [],
      packageManagers: ['npm'],
      tooling: [],
      confidence: 'high',
    },
    documentation: {
      plan: {
        docsDir: '.ai-docs',
        documents: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        strategy: 'standard',
      },
    },
    analysis: {
      status: 'partial',
    },
  };
}

describe('exporter registry', () => {
  it('resolves the generic exporter for the generic target', () => {
    const exporters = resolveExportersForTarget('generic');
    assert.equal(exporters.length, 1);
    assert.equal(exporters[0]?.id, 'generic-agent');
  });

  it('resolves the cursor exporter for the cursor target', () => {
    const exporters = resolveExportersForTarget('cursor');
    assert.equal(exporters.length, 1);
    assert.equal(exporters[0]?.id, 'cursor');
  });

  it('reports unsupported targets that have no exporter yet', () => {
    assert.deepEqual(findUnsupportedExportTargets(['claude', 'codex']), ['claude', 'codex']);
    assert.deepEqual(findUnsupportedExportTargets(['generic', 'cursor']), []);
  });

  it('lists supported targets from registered exporters', () => {
    assert.deepEqual(listSupportedExportTargets(), ['generic', 'cursor']);
  });

  it('looks up exporters by id', () => {
    assert.equal(getAgentExporterById('generic-agent')?.name, 'Generic Agent Pack');
    assert.equal(getAgentExporterById('missing'), undefined);
  });
});

describe('runAgentExports', () => {
  it('writes the generic agent pack and stores analysis.agentExports', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-export-service-'));

    try {
      const { knowledge, summary } = runAgentExports({
        knowledge: createKnowledge(tempRoot),
        targetProjectPath: tempRoot,
        docsDir: '.ai-docs',
        enabledTargets: DEFAULT_ENABLED_EXPORT_TARGETS,
      });

      const outputPath = path.join(tempRoot, '.ai-docs', GENERIC_AGENT_PACK_RELATIVE_PATH);
      assert.equal(fs.existsSync(outputPath), true);
      assert.equal(summary.enabled, true);
      assert.deepEqual(summary.enabledTargets, ['generic']);
      assert.equal(summary.results.length, 1);
      assert.equal(summary.results[0]?.filesWritten, 1);
      assert.equal(knowledge.analysis.agentExports?.results[0]?.target, 'generic');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('records warnings for unsupported targets without writing files', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-export-unsupported-'));

    try {
      const { summary } = runAgentExports({
        knowledge: createKnowledge(tempRoot),
        targetProjectPath: tempRoot,
        docsDir: '.ai-docs',
        enabledTargets: ['claude'],
      });

      assert.equal(summary.results.length, 0);
      assert.match(summary.warnings.join('\n'), /no exporter registered for target: claude/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('writes the cursor rule and generic pack when all targets are enabled', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-export-all-'));

    try {
      const { knowledge, summary } = runAgentExports({
        knowledge: createKnowledge(tempRoot),
        targetProjectPath: tempRoot,
        docsDir: '.ai-docs',
        enabledTargets: ['generic', 'cursor'],
      });

      const genericPath = path.join(tempRoot, '.ai-docs', GENERIC_AGENT_PACK_RELATIVE_PATH);
      const cursorPath = path.join(tempRoot, CURSOR_RULES_RELATIVE_PATH);
      assert.equal(fs.existsSync(genericPath), true);
      assert.equal(fs.existsSync(cursorPath), true);
      assert.deepEqual(summary.enabledTargets, ['generic', 'cursor']);
      assert.equal(summary.results.length, 2);
      assert.equal(summary.results.reduce((total, result) => total + result.filesWritten, 0), 2);
      assert.equal(knowledge.analysis.agentExports?.results[1]?.target, 'cursor');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
