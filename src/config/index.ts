import { resolveAbsolutePath, pathExists, isDirectory } from '../utils/fs';

export interface RuntimeConfig {
  targetProjectPath: string;
  docsDir: string;
  openRouterApiKey?: string;
}

interface ParsedArgs {
  targetPath: string | undefined;
  openRouterKey: string | undefined;
  docsDir: string | undefined;
  help: boolean;
}

const DEFAULT_DOCS_DIR = '.ai-docs';

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    targetPath: undefined,
    openRouterKey: undefined,
    docsDir: undefined,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--openrouter-key' && i + 1 < argv.length) {
      i++;
      result.openRouterKey = argv[i];
    } else if (arg === '--docs-dir' && i + 1 < argv.length) {
      i++;
      result.docsDir = argv[i];
    } else if (!arg.startsWith('-') && result.targetPath === undefined) {
      result.targetPath = arg;
    }

    i++;
  }

  return result;
}

function resolveApiKey(flagValue: string | undefined): string | undefined {
  return flagValue ?? process.env['OPENROUTER_API_KEY'];
}

export function isHelpRequested(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h');
}

export function printHelp(): void {
  console.log('Analyzes a software repository and generates AI-readable documentation');
  console.log('for AI coding agents to understand the project architecture.');
  console.log('');
  console.log('Usage:');
  console.log('  ai-project-docs <target-path> [options]');
  console.log('');
  console.log('Arguments:');
  console.log('  <target-path>              Path to the project directory to analyze (required)');
  console.log('');
  console.log('Options:');
  console.log('  --openrouter-key <key>     OpenRouter API key for AI-powered analysis');
  console.log('                             (also accepted via OPENROUTER_API_KEY env variable)');
  console.log(`  --docs-dir <name>          Output docs folder name (default: ${DEFAULT_DOCS_DIR})`);
  console.log('  --help                     Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  ai-project-docs ./my-project');
  console.log('  ai-project-docs ./my-project --openrouter-key sk-or-xxx');
  console.log('  ai-project-docs ./my-project --docs-dir .project-docs');
  console.log('  ai-project-docs ./my-project --openrouter-key sk-or-xxx --docs-dir .project-docs');
  console.log('');
}

export function resolveConfig(argv: string[]): RuntimeConfig {
  const args = parseArgs(argv);

  if (args.targetPath === undefined) {
    throw new Error(
      'Target project path is required.\n\nUsage: ai-project-docs <target-path> [options]\nRun with --help for full usage information.'
    );
  }

  const absolutePath = resolveAbsolutePath(args.targetPath);

  if (!pathExists(absolutePath)) {
    throw new Error(`Target path does not exist: ${absolutePath}`);
  }

  if (!isDirectory(absolutePath)) {
    throw new Error(`Target path is not a directory: ${absolutePath}`);
  }

  const docsDir = args.docsDir ?? DEFAULT_DOCS_DIR;

  if (docsDir.trim() === '') {
    throw new Error('Docs directory name must not be empty.');
  }

  return {
    targetProjectPath: absolutePath,
    docsDir,
    openRouterApiKey: resolveApiKey(args.openRouterKey),
  };
}
