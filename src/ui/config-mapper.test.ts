import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { mapRunRequestToConfig } from './config-mapper';

describe('mapRunRequestToConfig', () => {
  it('requires a JSON object body', () => {
    const result = mapRunRequestToConfig(null);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.match(result.error, /JSON object/);
    }
  });

  it('requires targetProjectPath', () => {
    const result = mapRunRequestToConfig({});
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.match(result.error, /targetProjectPath is required/);
    }
  });

  it('rejects non-string targetProjectPath', () => {
    const result = mapRunRequestToConfig({ targetProjectPath: 42 });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /must be a string/);
    }
  });

  it('maps a valid minimal body through buildRuntimeConfig', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-ui-mapper-'));

    try {
      const result = mapRunRequestToConfig({ targetProjectPath: tempDir });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.config.targetProjectPath, path.resolve(tempDir));
        assert.equal(result.config.docsDir, '.ai-docs');
        assert.equal(result.config.enableAiAnalysis, false);
        assert.equal(result.config.enableAgentExports, false);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('maps optional fields including apiKeys.openrouter and exportTargets', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-ui-mapper-'));

    try {
      const result = mapRunRequestToConfig({
        targetProjectPath: tempDir,
        docsDir: 'custom-docs',
        enableAiAnalysis: true,
        aiProvider: 'openrouter',
        aiModel: 'openai/gpt-4.1-mini',
        apiKeys: { openrouter: 'sk-test-key' },
        enableAgentExports: true,
        exportTargets: ['cursor'],
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.config.docsDir, 'custom-docs');
        assert.equal(result.config.enableAiAnalysis, true);
        assert.equal(result.config.openRouterApiKey, 'sk-test-key');
        assert.equal(result.config.apiKeys?.openrouter, 'sk-test-key');
        assert.equal(result.config.enableAgentExports, true);
        assert.deepEqual(result.config.exportTargets, ['cursor']);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('maps apiKeys.openai for the openai provider', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-ui-mapper-'));

    try {
      const result = mapRunRequestToConfig({
        targetProjectPath: tempDir,
        enableAiAnalysis: true,
        aiProvider: 'openai',
        aiModel: 'gpt-4.1-mini',
        apiKeys: { openai: 'sk-openai-ui' },
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.config.aiProvider, 'openai');
        assert.equal(result.config.apiKeys?.openai, 'sk-openai-ui');
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('maps exportTargets ["generic","cursor"] to all', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-ui-mapper-'));

    try {
      const result = mapRunRequestToConfig({
        targetProjectPath: tempDir,
        enableAgentExports: true,
        exportTargets: ['generic', 'cursor'],
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.deepEqual(result.config.exportTargets, ['generic', 'cursor']);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns 400 when buildRuntimeConfig rejects the path', () => {
    const missing = path.join(os.tmpdir(), `ai-project-docs-ui-missing-${Date.now()}`);
    const result = mapRunRequestToConfig({ targetProjectPath: missing });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.match(result.error, /does not exist/);
    }
  });

  it('rejects exportTargets without enableAgentExports', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-ui-mapper-'));

    try {
      const result = mapRunRequestToConfig({
        targetProjectPath: tempDir,
        exportTargets: ['cursor'],
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.error, /export-agents|--target/);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects non-boolean enableAiAnalysis', () => {
    const result = mapRunRequestToConfig({
      targetProjectPath: '.',
      enableAiAnalysis: 'yes',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /enableAiAnalysis must be a boolean/);
    }
  });

  it('rejects non-object apiKeys', () => {
    const result = mapRunRequestToConfig({
      targetProjectPath: '.',
      apiKeys: 'sk-or-x',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /apiKeys must be an object/);
    }
  });
});
