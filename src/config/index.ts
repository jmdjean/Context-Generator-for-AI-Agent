import { AgentExportTarget } from '../knowledge';
import {
  DEFAULT_AI_PROVIDER_ID,
  listSupportedAiProviderIds,
} from '../ai/providers/provider-factory';
import { DEFAULT_AI_MODEL, DEFAULT_DOCS_DIR } from './constants';
import { buildRuntimeConfig } from './runtime-config-builder';

export { DEFAULT_AI_MODEL, DEFAULT_DOCS_DIR } from './constants';
export { buildRuntimeConfig, resolveProviderApiKey } from './runtime-config-builder';
export type { RuntimeConfigInput } from './runtime-config-builder';

export interface RuntimeConfig {
  targetProjectPath: string;
  docsDir: string;
  /** Derived from `apiKeys.openrouter` for OpenRouter backward compatibility. */
  openRouterApiKey?: string;
  /** Per-provider API keys (e.g. `{ openrouter: '...', openai: '...' }`). */
  apiKeys?: Partial<Record<string, string>>;
  enableAiAnalysis: boolean;
  /**
   * When AI analysis is enabled, also run per-module documentation fan-out.
   * Defaults to true; disable with `--skip-module-docs`.
   */
  enableModuleDocumentation: boolean;
  aiProvider: string;
  aiModel: string;
  enableAgentExports: boolean;
  exportTargets: AgentExportTarget[];
}

interface ParsedArgs {
  targetPath: string | undefined;
  openRouterKey: string | undefined;
  openAiKey: string | undefined;
  docsDir: string | undefined;
  enableAiAnalysis: boolean;
  enableModuleDocumentation: boolean;
  aiProvider: string | undefined;
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
    openAiKey: undefined,
    docsDir: undefined,
    enableAiAnalysis: false,
    enableModuleDocumentation: true,
    aiProvider: undefined,
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
    } else if (arg === '--skip-module-docs') {
      result.enableModuleDocumentation = false;
    } else if (arg === '--export-agents') {
      result.enableAgentExports = true;
    } else if (arg === '--target') {
      result.exportTarget = readFlagValue(argv, i, '--target');
      i++;
    } else if (arg === '--openrouter-key') {
      result.openRouterKey = readFlagValue(argv, i, '--openrouter-key');
      i++;
    } else if (arg === '--openai-key') {
      result.openAiKey = readFlagValue(argv, i, '--openai-key');
      i++;
    } else if (arg === '--ai-provider') {
      result.aiProvider = readFlagValue(argv, i, '--ai-provider');
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
  console.log('No API key is required unless you pass --ai.');
  console.log('');
  console.log('Usage:');
  console.log('  ai-project-docs <target-path> [options]');
  console.log('');
  console.log('Arguments:');
  console.log('  <target-path>              Path to the project directory to analyze (required)');
  console.log('');
  console.log('Options:');
  console.log('  --ai                       Run optional AI analysis (requires API key)');
  console.log('  --skip-module-docs         With --ai, skip per-module documentation fan-out');
  console.log('                             (architecture context still runs)');
  console.log(`  --ai-provider <name>       AI provider to use (default: ${DEFAULT_AI_PROVIDER_ID})`);
  console.log(`                             Supported providers: ${listSupportedAiProviderIds().join(', ')}`);
  console.log('  --export-agents            Export agent-specific context files from the PKM');
  console.log('  --target <name>            Agent export target: generic, cursor, or all');
  console.log('                             (default with --export-agents: generic)');
  console.log('  --openrouter-key <key>     OpenRouter API key for AI analysis (optional)');
  console.log('                             (also accepted via OPENROUTER_API_KEY env variable)');
  console.log('  --openai-key <key>         OpenAI API key for AI analysis (optional)');
  console.log('                             (also accepted via OPENAI_API_KEY env variable)');
  console.log(`  --model <id>               Model id passed to the provider (default: ${DEFAULT_AI_MODEL})`);
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
  console.log('  ai-project-docs ./my-project --ai --skip-module-docs');
  console.log('  ai-project-docs ./my-project --ai --ai-provider openai --openai-key "$OPENAI_API_KEY"');
  console.log('  ai-project-docs ./my-project --ai --ai-provider openrouter');
  console.log('  ai-project-docs ./my-project --export-agents');
  console.log('  ai-project-docs ./my-project --export-agents --target cursor');
  console.log('  ai-project-docs ./my-project --export-agents --target all');
  console.log('  ai-project-docs --help');
  console.log('');
}

/**
 * CLI entry: parse argv, map to {@link RuntimeConfigInput}, validate via {@link buildRuntimeConfig}.
 */
export function resolveConfig(argv: string[]): RuntimeConfig {
  const args = parseArgs(argv);

  return buildRuntimeConfig({
    targetProjectPath: args.targetPath ?? '',
    docsDir: args.docsDir,
    enableAiAnalysis: args.enableAiAnalysis,
    enableModuleDocumentation: args.enableModuleDocumentation,
    aiProvider: args.aiProvider,
    aiModel: args.aiModel,
    openRouterApiKey: args.openRouterKey,
    openAiApiKey: args.openAiKey,
    enableAgentExports: args.enableAgentExports,
    exportTargetSelector: args.exportTarget,
  });
}
