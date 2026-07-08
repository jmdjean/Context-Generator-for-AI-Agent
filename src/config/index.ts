import * as path from 'node:path';
import { AgentExportTarget } from '../knowledge';
import {
  DEFAULT_ENABLED_EXPORT_TARGETS,
} from '../exporters/exporter-constants';
import {
  parseExportTargetSelector,
  resolveEnabledExportTargets,
} from '../exporters/export-target-resolver';
import { DEFAULT_AI_MODEL, DEFAULT_DOCS_DIR } from './constants';
import { assertReadableDirectory } from '../utils/fs';

export { DEFAULT_AI_MODEL, DEFAULT_DOCS_DIR } from './constants';

export interface RuntimeConfig {
  targetProjectPath: string;
  docsDir: string;
  openRouterApiKey?: string;
  enableAiAnalysis: boolean;
  aiModel: string;
  enableAgentExports: boolean;
  exportTargets: AgentExportTarget[];
}

interface ParsedArgs {
  targetPath: string | undefined;
  openRouterKey: string | undefined;
  docsDir: string | undefined;
  enableAiAnalysis: boolean;
  aiModel: string | undefined;
  enableAgentExports: boolean;
  exportTarget?: string;
}

function readFlagValue(argv: string[], index: number, flagName: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('-')) {
    throw new Error(`Missing value for ${flagName}. Run with --help for usage information.`);
  }
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    targetPath: undefined,
    openRouterKey: undefined,
    docsDir: undefined,
    enableAiAnalysis: false,
    aiModel: undefined,
    enableAgentExports: false,
    exportTarget: undefined,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      throw new Error(
        'The --help flag cannot be combined with other arguments. Run: ai-project-docs --help',
      );
    } else if (arg === '--ai') {
      result.enableAiAnalysis = true;
    } else if (arg === '--export-agents') {
      result.enableAgentExports = true;
    } else if (arg === '--target') {
      result.exportTarget = readFlagValue(argv, i, '--target');
      i++;
    } else if (arg === '--openrouter-key') {
      result.openRouterKey = readFlagValue(argv, i, '--openrouter-key');
      i++;
    } else if (arg === '--model') {
      result.aiModel = readFlagValue(argv, i, '--model');
      i++;
    } else if (arg === '--docs-dir') {
      result.docsDir = readFlagValue(argv, i, '--docs-dir');
      i++;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}. Run with --help for usage information.`);
    } else if (result.targetPath === undefined) {
      result.targetPath = arg;
    } else {
      throw new Error(
        `Unexpected argument: ${arg}. Only one target path is supported. Run with --help for usage information.`,
      );
    }

    i++;
  }

  return result;
}

function resolveApiKey(flagValue: string | undefined): string | undefined {
  const resolved = flagValue ?? process.env['OPENROUTER_API_KEY'];
  if (resolved === undefined || resolved.trim() === '') {
    return undefined;
  }
  return resolved;
}

function assertValidDocsDirName(docsDir: string): void {
  if (docsDir === '.') {
    throw new Error(
      'Docs directory cannot be the repository root (.). Choose a dedicated folder such as .ai-docs.',
    );
  }

  if (path.isAbsolute(docsDir)) {
    throw new Error(
      `Docs directory must be a relative folder name inside the target repository, not an absolute path: ${docsDir}`,
    );
  }

  if (docsDir.includes('..') || docsDir.includes('/') || docsDir.includes('\\')) {
    throw new Error(
      `Docs directory must be a single folder name without path separators: ${docsDir}`,
    );
  }
}

export function isHelpOnly(argv: string[]): boolean {
  return argv.length > 0 && argv.every((arg) => arg === '--help' || arg === '-h');
}

export function isHelpRequested(argv: string[]): boolean {
  return isHelpOnly(argv);
}

export function printHelp(): void {
  console.log('Analyzes a software repository and generates AI-readable documentation');
  console.log('for AI coding agents to understand the project architecture.');
  console.log('');
  console.log('No OpenRouter API key is required unless you pass --ai.');
  console.log('');
  console.log('Usage:');
  console.log('  ai-project-docs <target-path> [options]');
  console.log('');
  console.log('Arguments:');
  console.log('  <target-path>              Path to the project directory to analyze (required)');
  console.log('');
  console.log('Options:');
  console.log('  --ai                       Run optional OpenRouter AI analysis (requires API key)');
  console.log('  --export-agents            Export agent-specific context files from the PKM');
  console.log('  --target <name>            Agent export target: generic, cursor, or all');
  console.log('                             (default with --export-agents: generic)');
  console.log('  --openrouter-key <key>     OpenRouter API key for AI analysis (optional)');
  console.log('                             (also accepted via OPENROUTER_API_KEY env variable)');
  console.log(`  --model <id>               OpenRouter model id (default: ${DEFAULT_AI_MODEL})`);
  console.log(`  --docs-dir <name>          Output docs folder name (default: ${DEFAULT_DOCS_DIR})`);
  console.log('                             Must be a single relative folder name (not "." or absolute)');
  console.log('  --help, -h                 Show this help message');
  console.log('');
  console.log('Exit codes:');
  console.log('  0  Success');
  console.log('  1  User or configuration error');
  console.log('  2  Documentation validation failed');
  console.log('  3  Unexpected runtime error');
  console.log('');
  console.log('Examples:');
  console.log('  ai-project-docs ./my-project');
  console.log('  ai-project-docs ./my-project --docs-dir .project-docs');
  console.log('  ai-project-docs ./my-project --ai --openrouter-key "$OPENROUTER_API_KEY"');
  console.log('  ai-project-docs ./my-project --export-agents');
  console.log('  ai-project-docs ./my-project --export-agents --target cursor');
  console.log('  ai-project-docs ./my-project --export-agents --target all');
  console.log('  ai-project-docs --help');
  console.log('');
}

export function resolveConfig(argv: string[]): RuntimeConfig {
  const args = parseArgs(argv);

  if (args.targetPath === undefined) {
    throw new Error(
      'Target project path is required.\n\nUsage: ai-project-docs <target-path> [options]\nRun with --help for full usage information.',
    );
  }

  const absolutePath = assertReadableDirectory(args.targetPath);

  const docsDir = (args.docsDir ?? DEFAULT_DOCS_DIR).trim();

  if (docsDir === '') {
    throw new Error(
      'Docs directory name must not be empty. Use --docs-dir <name> with a non-empty folder name.',
    );
  }

  assertValidDocsDirName(docsDir);

  const aiModel = (args.aiModel ?? DEFAULT_AI_MODEL).trim();
  if (aiModel === '') {
    throw new Error(
      'Model id must not be empty. Use --model <id> with a non-empty OpenRouter model identifier.',
    );
  }

  if (args.exportTarget !== undefined && !args.enableAgentExports) {
    throw new Error(
      '--target requires --export-agents. Run with --help for usage information.',
    );
  }

  let exportTargets: AgentExportTarget[] = [...DEFAULT_ENABLED_EXPORT_TARGETS];
  if (args.exportTarget !== undefined) {
    const selector = parseExportTargetSelector(args.exportTarget);
    if (selector === undefined) {
      throw new Error(
        `Unknown export target: ${args.exportTarget}. Supported targets: generic, cursor, all.`,
      );
    }
    exportTargets = resolveEnabledExportTargets([selector]);
  }

  return {
    targetProjectPath: absolutePath,
    docsDir,
    openRouterApiKey: resolveApiKey(args.openRouterKey),
    enableAiAnalysis: args.enableAiAnalysis,
    aiModel,
    enableAgentExports: args.enableAgentExports,
    exportTargets,
  };
}
