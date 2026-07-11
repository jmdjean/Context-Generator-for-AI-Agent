import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { buildRuntimeConfig } from './runtime-config-builder';

describe('buildRuntimeConfig', () => {
  it('requires a target path', () => {
    assert.throws(() => buildRuntimeConfig({ targetProjectPath: '' }), /Target project path is required/);
    assert.throws(() => buildRuntimeConfig({ targetProjectPath: '   ' }), /Target project path is required/);
  });

  it('rejects a non-existent target path', () => {
    const missingPath = path.join(os.tmpdir(), `ai-project-docs-missing-${Date.now()}`);
    assert.throws(() => buildRuntimeConfig({ targetProjectPath: missingPath }), /does not exist/);
  });

  it('rejects a file target path', () => {
    const tempFile = path.join(os.tmpdir(), `ai-project-docs-file-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'fixture', 'utf-8');

    try {
      assert.throws(() => buildRuntimeConfig({ targetProjectPath: tempFile }), /not a directory/);
    } finally {
      fs.rmSync(tempFile, { force: true });
    }
  });

  it('rejects an empty docs directory name', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(
        () => buildRuntimeConfig({ targetProjectPath: tempDir, docsDir: '   ' }),
        /must not be empty/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects docs directory names with path separators', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(
        () => buildRuntimeConfig({ targetProjectPath: tempDir, docsDir: '.' }),
        /repository root/,
      );
      assert.throws(
        () => buildRuntimeConfig({ targetProjectPath: tempDir, docsDir: '../escape' }),
        /path separators/,
      );
      assert.throws(
        () => buildRuntimeConfig({ targetProjectPath: tempDir, docsDir: 'docs/out' }),
        /path separators/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects absolute docs directory names', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const absoluteDocsDir = path.join(os.tmpdir(), 'outside-docs');
      assert.throws(
        () => buildRuntimeConfig({ targetProjectPath: tempDir, docsDir: absoluteDocsDir }),
        /absolute path/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('treats an empty openrouter key as unset', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = buildRuntimeConfig({
        targetProjectPath: tempDir,
        openRouterApiKey: '   ',
      });
      assert.equal(config.openRouterApiKey, undefined);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves a valid configuration', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = buildRuntimeConfig({
        targetProjectPath: tempDir,
        docsDir: '.project-docs',
      });
      assert.equal(config.targetProjectPath, path.resolve(tempDir));
      assert.equal(config.docsDir, '.project-docs');
      assert.equal(config.enableAiAnalysis, false);
      assert.equal(config.enableModuleDocumentation, true);
      assert.equal(config.aiProvider, 'openrouter');
      assert.equal(config.aiModel, 'openai/gpt-4.1-mini');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('enables AI analysis when requested', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = buildRuntimeConfig({
        targetProjectPath: tempDir,
        enableAiAnalysis: true,
        aiModel: 'anthropic/claude-3.5-sonnet',
      });
      assert.equal(config.enableAiAnalysis, true);
      assert.equal(config.aiProvider, 'openrouter');
      assert.equal(config.aiModel, 'anthropic/claude-3.5-sonnet');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts aiProvider openrouter in any casing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = buildRuntimeConfig({
        targetProjectPath: tempDir,
        enableAiAnalysis: true,
        aiProvider: 'OpenRouter',
      });
      assert.equal(config.aiProvider, 'openrouter');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects unsupported aiProvider values with a clear error', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(
        () =>
          buildRuntimeConfig({
            targetProjectPath: tempDir,
            enableAiAnalysis: true,
            aiProvider: 'gemini',
          }),
        /Unsupported AI provider: gemini\. Supported providers: openrouter, openai\./,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('enables agent exports when requested', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = buildRuntimeConfig({
        targetProjectPath: tempDir,
        enableAgentExports: true,
      });
      assert.equal(config.enableAgentExports, true);
      assert.deepEqual(config.exportTargets, ['generic']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves export targets from exportTargetSelector', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const cursorConfig = buildRuntimeConfig({
        targetProjectPath: tempDir,
        enableAgentExports: true,
        exportTargetSelector: 'cursor',
      });
      assert.deepEqual(cursorConfig.exportTargets, ['cursor']);

      const allConfig = buildRuntimeConfig({
        targetProjectPath: tempDir,
        enableAgentExports: true,
        exportTargetSelector: 'all',
      });
      assert.deepEqual(allConfig.exportTargets, ['generic', 'cursor']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects exportTargetSelector without enableAgentExports', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(
        () =>
          buildRuntimeConfig({
            targetProjectPath: tempDir,
            exportTargetSelector: 'cursor',
          }),
        /--target requires --export-agents/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects unknown export targets', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(
        () =>
          buildRuntimeConfig({
            targetProjectPath: tempDir,
            enableAgentExports: true,
            exportTargetSelector: 'unknown',
          }),
        /Unknown export target/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects unsupported export targets that have no exporter yet', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(
        () =>
          buildRuntimeConfig({
            targetProjectPath: tempDir,
            enableAgentExports: true,
            exportTargetSelector: 'claude',
          }),
        /Unsupported export target/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts openai as aiProvider', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = buildRuntimeConfig({
        targetProjectPath: tempDir,
        aiProvider: 'openai',
        openAiApiKey: 'sk-openai-test',
        openRouterApiKey: '',
      });
      assert.equal(config.aiProvider, 'openai');
      assert.equal(config.apiKeys?.openai, 'sk-openai-test');
      assert.equal(config.openRouterApiKey, undefined);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('merges apiKeys map and derives openRouterApiKey', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = buildRuntimeConfig({
        targetProjectPath: tempDir,
        apiKeys: {
          openrouter: 'sk-or-map',
          openai: 'sk-oai-map',
        },
      });
      assert.equal(config.openRouterApiKey, 'sk-or-map');
      assert.deepEqual(config.apiKeys, {
        openrouter: 'sk-or-map',
        openai: 'sk-oai-map',
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lets dedicated openrouter/openai fields override apiKeys entries', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = buildRuntimeConfig({
        targetProjectPath: tempDir,
        apiKeys: { openrouter: 'from-map', openai: 'from-map-oai' },
        openRouterApiKey: 'from-flag',
        openAiApiKey: 'from-openai-flag',
      });
      assert.equal(config.openRouterApiKey, 'from-flag');
      assert.equal(config.apiKeys?.openrouter, 'from-flag');
      assert.equal(config.apiKeys?.openai, 'from-openai-flag');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
