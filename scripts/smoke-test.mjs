import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(projectRoot, 'dist', 'cli.js');
const require = createRequire(import.meta.url);
const { GENERATED_FILE_MARKER } = require(join(projectRoot, 'dist/docs/document-template.js'));
const { resolveExitCode, EXIT_VALIDATION_ERROR } = require(join(projectRoot, 'dist/core/exit-codes.js'));

function fail(message) {
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected exit code ${expected}, got ${actual}`);
  }
}

function assertExists(filePath, label) {
  if (!existsSync(filePath)) {
    fail(`expected ${label} at ${filePath}`);
  }
}

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? projectRoot,
    encoding: 'utf-8',
    env: process.env,
  });

  if (result.error) {
    fail(`failed to spawn CLI: ${result.error.message}`);
  }

  return result;
}

function createFixtureProject() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'ai-project-docs-smoke-'));

  mkdirSync(join(fixtureRoot, 'src'), { recursive: true });
  writeFileSync(
    join(fixtureRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'smoke-fixture',
        version: '1.0.0',
        private: true,
      },
      null,
      2,
    ),
    'utf-8',
  );
  writeFileSync(join(fixtureRoot, 'src', 'index.ts'), 'export const answer = 42;\n', 'utf-8');

  return fixtureRoot;
}

function runConfigErrorCases() {
  const missingPath = join(tmpdir(), `ai-project-docs-missing-${Date.now()}`);

  assertEqual(runCli([]).status, 1, 'missing target path');

  const missingResult = runCli([missingPath]);
  assertEqual(missingResult.status, 1, 'nonexistent target path');
  if (!/does not exist/i.test(`${missingResult.stderr}${missingResult.stdout}`)) {
    fail('nonexistent target path should report a clear error message');
  }

  const tempFile = join(tmpdir(), `ai-project-docs-file-${Date.now()}.txt`);
  writeFileSync(tempFile, 'not a directory', 'utf-8');
  try {
    const fileResult = runCli([tempFile]);
    assertEqual(fileResult.status, 1, 'file target path');
    if (!/not a directory/i.test(`${fileResult.stderr}${fileResult.stdout}`)) {
      fail('file target path should report a clear error message');
    }
  } finally {
    rmSync(tempFile, { force: true });
  }

  const fixtureRoot = createFixtureProject();
  try {
    assertEqual(runCli([fixtureRoot, '--docs-dir', '   ']).status, 1, 'empty docs dir');
    assertEqual(runCli([fixtureRoot, '--docs-dir', '.']).status, 1, 'repository root docs dir');
    assertEqual(runCli([fixtureRoot, '--docs-dir', '../escape']).status, 1, 'unsafe docs dir');
    assertEqual(runCli([fixtureRoot, '--unknown']).status, 1, 'unknown option');
    assertEqual(runCli([fixtureRoot, '--help']).status, 1, 'help combined with target');
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function runRuntimeErrorCase() {
  const fixtureRoot = createFixtureProject();
  writeFileSync(join(fixtureRoot, '.ai-docs'), 'blocks docs directory', 'utf-8');

  try {
    assertEqual(runCli([fixtureRoot]).status, 3, 'blocked docs directory');
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function runValidationExitCodeCase() {
  const exitCode = resolveExitCode({
    success: false,
    errors: [{ stepName: 'Validate Documentation', message: 'failed (1 error(s), 0 warning(s))' }],
    metrics: {
      validation: {
        status: 'failed',
        errorCount: 1,
        warningCount: 0,
        issues: [{ severity: 'error', message: 'planned document was not written' }],
      },
    },
  });

  if (exitCode !== EXIT_VALIDATION_ERROR) {
    fail(`expected validation failure to map to exit code ${EXIT_VALIDATION_ERROR}`);
  }
}

function runHappyPath() {
  const fixtureRoot = createFixtureProject();

  try {
    const result = runCli([fixtureRoot]);
    assertEqual(result.status, 0, 'successful run');

    const docsDir = join(fixtureRoot, '.ai-docs');
    const knowledgePath = join(docsDir, 'knowledge', 'project-knowledge.json');
    const architecturePath = join(docsDir, 'architecture.md');

    assertExists(docsDir, '.ai-docs directory');
    assertExists(knowledgePath, 'project-knowledge.json');
    assertExists(architecturePath, 'architecture.md');

    const knowledge = JSON.parse(readFileSync(knowledgePath, 'utf-8'));
    if (!knowledge.metadata || !knowledge.repository) {
      fail('project-knowledge.json is missing expected PKM sections');
    }

    const architecture = readFileSync(architecturePath, 'utf-8');
    if (!architecture.startsWith(GENERATED_FILE_MARKER)) {
      fail('architecture.md is missing the generated file marker');
    }

    if (!/Status: passed/.test(result.stdout)) {
      console.error(result.stdout);
      fail('validation did not pass in CLI output');
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function main() {
  if (!existsSync(cliPath)) {
    fail('CLI not built. Run "npm run build" before "npm run smoke".');
  }

  runConfigErrorCases();
  runRuntimeErrorCase();
  runValidationExitCodeCase();
  runHappyPath();
  console.log('Smoke test passed.');
}

main();
