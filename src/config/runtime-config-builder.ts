import * as path from 'node:path';
import { AgentExportTarget } from '../knowledge';
import {
  DEFAULT_ENABLED_EXPORT_TARGETS,
} from '../exporters/exporter-constants';
import {
  parseExportTargetSelector,
  resolveEnabledExportTargets,
} from '../exporters/export-target-resolver';
import { normalizeAiProviderId } from '../ai/providers/ai-provider';
import { OPENAI_PROVIDER_ID } from '../ai/providers/openai-provider';
import { OPENROUTER_PROVIDER_ID } from '../ai/providers/openrouter-provider';
import {
  DEFAULT_AI_PROVIDER_ID,
  isSupportedAiProviderId,
  listSupportedAiProviderIds,
} from '../ai/providers/provider-factory';
import { assertReadableDirectory } from '../utils/fs';
import { DEFAULT_AI_MODEL, DEFAULT_DOCS_DIR } from './constants';
import type { RuntimeConfig } from './index';

/**
 * Provider-agnostic input used by CLI and the Web UI.
 * Validation and defaults live in {@link buildRuntimeConfig}.
 */
export interface RuntimeConfigInput {
  targetProjectPath: string;
  docsDir?: string;
  enableAiAnalysis?: boolean;
  /**
   * When AI is enabled, run per-module documentation fan-out (default true).
   * Set false to skip module docs while still generating architecture context.
   */
  enableModuleDocumentation?: boolean;
  aiProvider?: string;
  aiModel?: string;
  /** @deprecated Prefer `apiKeys.openrouter`; kept for CLI `--openrouter-key` mapping. */
  openRouterApiKey?: string;
  /** @deprecated Prefer `apiKeys.openai`; kept for CLI `--openai-key` mapping. */
  openAiApiKey?: string;
  apiKeys?: Partial<Record<string, string>>;
  enableAgentExports?: boolean;
  /** Raw `--target` / UI selector value (`generic`, `cursor`, `all`). */
  exportTargetSelector?: string;
}

function normalizeOptionalKey(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value.trim();
}

/**
 * Merges explicit input keys with env fallbacks.
 * Priority: dedicated CLI fields > input.apiKeys > env vars.
 * An explicit empty dedicated field clears that provider key (no env fallback).
 */
function resolveApiKeys(input: RuntimeConfigInput): Partial<Record<string, string>> {
  const keys: Partial<Record<string, string>> = {};

  if (input.apiKeys !== undefined) {
    for (const [providerId, value] of Object.entries(input.apiKeys)) {
      const normalizedId = normalizeAiProviderId(providerId);
      if (normalizedId === '') {
        continue;
      }
      const normalizedValue = normalizeOptionalKey(value);
      if (normalizedValue !== undefined) {
        keys[normalizedId] = normalizedValue;
      }
    }
  }

  if (input.openRouterApiKey !== undefined) {
    const fromField = normalizeOptionalKey(input.openRouterApiKey);
    if (fromField !== undefined) {
      keys[OPENROUTER_PROVIDER_ID] = fromField;
    } else {
      delete keys[OPENROUTER_PROVIDER_ID];
    }
  } else if (keys[OPENROUTER_PROVIDER_ID] === undefined) {
    const fromEnv = normalizeOptionalKey(process.env['OPENROUTER_API_KEY']);
    if (fromEnv !== undefined) {
      keys[OPENROUTER_PROVIDER_ID] = fromEnv;
    }
  }

  if (input.openAiApiKey !== undefined) {
    const fromField = normalizeOptionalKey(input.openAiApiKey);
    if (fromField !== undefined) {
      keys[OPENAI_PROVIDER_ID] = fromField;
    } else {
      delete keys[OPENAI_PROVIDER_ID];
    }
  } else if (keys[OPENAI_PROVIDER_ID] === undefined) {
    const fromEnv = normalizeOptionalKey(process.env['OPENAI_API_KEY']);
    if (fromEnv !== undefined) {
      keys[OPENAI_PROVIDER_ID] = fromEnv;
    }
  }

  return keys;
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

/**
 * Shared validation path for CLI and Web UI.
 * Resolves defaults, env fallbacks, and returns a typed {@link RuntimeConfig}.
 */
export function buildRuntimeConfig(input: RuntimeConfigInput): RuntimeConfig {
  if (input.targetProjectPath === undefined || input.targetProjectPath.trim() === '') {
    throw new Error(
      'Target project path is required.\n\nUsage: ai-project-docs <target-path> [options]\nRun with --help for full usage information.',
    );
  }

  const absolutePath = assertReadableDirectory(input.targetProjectPath);

  const docsDir = (input.docsDir ?? DEFAULT_DOCS_DIR).trim();

  if (docsDir === '') {
    throw new Error(
      'Docs directory name must not be empty. Use --docs-dir <name> with a non-empty folder name.',
    );
  }

  assertValidDocsDirName(docsDir);

  const aiModel = (input.aiModel ?? DEFAULT_AI_MODEL).trim();
  if (aiModel === '') {
    throw new Error(
      'Model id must not be empty. Use --model <id> with a non-empty model identifier.',
    );
  }

  const aiProvider = normalizeAiProviderId(input.aiProvider ?? DEFAULT_AI_PROVIDER_ID);
  if (aiProvider === '') {
    throw new Error(
      'AI provider must not be empty. Use --ai-provider <name> with a supported provider name.',
    );
  }
  if (!isSupportedAiProviderId(aiProvider)) {
    throw new Error(
      `Unsupported AI provider: ${input.aiProvider}. Supported providers: ${listSupportedAiProviderIds().join(', ')}.`,
    );
  }

  const enableAgentExports = input.enableAgentExports ?? false;

  if (input.exportTargetSelector !== undefined && !enableAgentExports) {
    throw new Error(
      '--target requires --export-agents. Run with --help for usage information.',
    );
  }

  let exportTargets: AgentExportTarget[] = [...DEFAULT_ENABLED_EXPORT_TARGETS];
  if (input.exportTargetSelector !== undefined) {
    const selector = parseExportTargetSelector(input.exportTargetSelector);
    if (selector === undefined) {
      throw new Error(
        `Unknown export target: ${input.exportTargetSelector}. Supported targets: generic, cursor, all.`,
      );
    }
    exportTargets = resolveEnabledExportTargets([selector]);
  }

  const apiKeys = resolveApiKeys(input);
  const openRouterApiKey = apiKeys[OPENROUTER_PROVIDER_ID];

  return {
    targetProjectPath: absolutePath,
    docsDir,
    openRouterApiKey,
    apiKeys: Object.keys(apiKeys).length > 0 ? apiKeys : undefined,
    enableAiAnalysis: input.enableAiAnalysis ?? false,
    enableModuleDocumentation: input.enableModuleDocumentation ?? true,
    aiProvider,
    aiModel,
    enableAgentExports,
    exportTargets,
  };
}

/** Resolves the API key for the configured AI provider. */
export function resolveProviderApiKey(config: RuntimeConfig): string | undefined {
  const fromMap = config.apiKeys?.[config.aiProvider];
  if (fromMap !== undefined && fromMap.trim() !== '') {
    return fromMap.trim();
  }
  if (config.aiProvider === OPENROUTER_PROVIDER_ID) {
    return normalizeOptionalKey(config.openRouterApiKey);
  }
  return undefined;
}
