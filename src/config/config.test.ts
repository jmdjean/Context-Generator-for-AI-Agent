import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { resolveConfig } from './index';

describe('resolveConfig', () => {
  it('requires a target path', () => {
    assert.throws(() => resolveConfig([]), /Target project path is required/);
  });

  it('rejects a non-existent target path', () => {
    const missingPath = path.join(os.tmpdir(), `ai-project-docs-missing-${Date.now()}`);
    assert.throws(() => resolveConfig([missingPath]), /does not exist/);
  });

  it('rejects a file target path', () => {
    const tempFile = path.join(os.tmpdir(), `ai-project-docs-file-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'fixture', 'utf-8');

    try {
      assert.throws(() => resolveConfig([tempFile]), /not a directory/);
    } finally {
      fs.rmSync(tempFile, { force: true });
    }
  });

  it('rejects an empty docs directory name', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(() => resolveConfig([tempDir, '--docs-dir', '   ']), /must not be empty/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects docs directory names with path separators', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(() => resolveConfig([tempDir, '--docs-dir', '.']), /repository root/);
      assert.throws(() => resolveConfig([tempDir, '--docs-dir', '../escape']), /path separators/);
      assert.throws(() => resolveConfig([tempDir, '--docs-dir', 'docs/out']), /path separators/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects absolute docs directory names', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const absoluteDocsDir = path.join(os.tmpdir(), 'outside-docs');
      assert.throws(() => resolveConfig([tempDir, '--docs-dir', absoluteDocsDir]), /absolute path/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects --help combined with other arguments', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(() => resolveConfig([tempDir, '--help']), /cannot be combined/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects unknown CLI options', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(() => resolveConfig([tempDir, '--unknown']), /Unknown option/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects flags without values', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(() => resolveConfig([tempDir, '--docs-dir']), /Missing value for --docs-dir/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('treats an empty openrouter key flag as unset', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = resolveConfig([tempDir, '--openrouter-key', '   ']);
      assert.equal(config.openRouterApiKey, undefined);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves a valid configuration', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = resolveConfig([tempDir, '--docs-dir', '.project-docs']);
      assert.equal(config.targetProjectPath, path.resolve(tempDir));
      assert.equal(config.docsDir, '.project-docs');
      assert.equal(config.enableAiAnalysis, false);
      assert.equal(config.aiModel, 'openai/gpt-4.1-mini');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('enables AI analysis when --ai is provided', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = resolveConfig([tempDir, '--ai', '--model', 'anthropic/claude-3.5-sonnet']);
      assert.equal(config.enableAiAnalysis, true);
      assert.equal(config.aiModel, 'anthropic/claude-3.5-sonnet');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('enables agent exports when --export-agents is provided', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const config = resolveConfig([tempDir, '--export-agents']);
      assert.equal(config.enableAgentExports, true);
      assert.deepEqual(config.exportTargets, ['generic']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves export targets from --target', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      const cursorConfig = resolveConfig([tempDir, '--export-agents', '--target', 'cursor']);
      assert.deepEqual(cursorConfig.exportTargets, ['cursor']);

      const allConfig = resolveConfig([tempDir, '--export-agents', '--target', 'all']);
      assert.deepEqual(allConfig.exportTargets, ['generic', 'cursor']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects --target without --export-agents', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-config-'));

    try {
      assert.throws(
        () => resolveConfig([tempDir, '--target', 'cursor']),
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
        () => resolveConfig([tempDir, '--export-agents', '--target', 'unknown']),
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
        () => resolveConfig([tempDir, '--export-agents', '--target', 'claude']),
        /Unsupported export target/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
