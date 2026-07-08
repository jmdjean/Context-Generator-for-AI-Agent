#!/usr/bin/env node
import { resolveConfig, printHelp, isHelpOnly } from './config';
import { run, EXIT_USER_ERROR, EXIT_RUNTIME_ERROR } from './core';

function printUsageHint(): void {
  console.error('Usage:   ai-project-docs <target-path> [options]');
  console.error('Run with --help for full usage information.');
  console.error('');
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  console.log('');
  console.log('AI Project Docs');
  console.log('');

  if (isHelpOnly(argv)) {
    printHelp();
    return 0;
  }

  if (argv.length === 0) {
    console.error('Error: target project path is required.');
    console.error('');
    printUsageHint();
    return EXIT_USER_ERROR;
  }

  let config;
  try {
    config = resolveConfig(argv);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error('');
    return EXIT_USER_ERROR;
  }

  return run(config);
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((err) => {
    console.error('Unexpected error:', err instanceof Error ? err.message : String(err));
    process.exitCode = EXIT_RUNTIME_ERROR;
  });
