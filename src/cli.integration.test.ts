import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'dist', 'cli.js');

function createFixtureProject(): string {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-cli-exit-'));

  fs.mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, 'package.json'),
    JSON.stringify({ name: 'cli-exit-fixture', version: '1.0.0', private: true }, null, 2),
    'utf-8',
  );
  fs.writeFileSync(path.join(fixtureRoot, 'src', 'index.ts'), 'export const value = 1;\n', 'utf-8');

  return fixtureRoot;
}

function runCli(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf-8',
    env: process.env,
  });
}

describe('CLI exit codes (integration)', () => {
  it('exits with 3 when the default docs path is blocked by a file', () => {
    const fixtureRoot = createFixtureProject();
    fs.writeFileSync(path.join(fixtureRoot, '.ai-docs'), 'blocked', 'utf-8');

    try {
      const result = runCli([fixtureRoot]);
      assert.equal(result.status, 3);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
