#!/usr/bin/env node
import { resolveConfig, printHelp, isHelpRequested } from './config';
import { run } from './core';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  console.log('');
  console.log('AI Project Docs');
  console.log('');

  if (argv.length === 0) {
    console.error('Error: target project path is required.');
    console.error('');
    console.error('Usage:   ai-project-docs <target-path> [options]');
    console.error('Run with --help for full usage information.');
    console.error('');
    process.exit(1);
  }

  if (isHelpRequested(argv)) {
    printHelp();
    process.exit(0);
  }

  let config;
  try {
    config = resolveConfig(argv);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error('');
    process.exit(1);
  }

  const result = await run(config);

  if (!result.success) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
