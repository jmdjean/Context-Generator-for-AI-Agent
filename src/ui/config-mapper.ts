import type { RuntimeConfig } from '../config';
import {
  buildRuntimeConfig,
  type RuntimeConfigInput,
} from '../config/runtime-config-builder';
import { normalizeAiProviderId } from '../ai/providers/ai-provider';

export type MapRunRequestResult =
  | { readonly ok: true; readonly config: RuntimeConfig }
  | { readonly ok: false; readonly error: string; readonly status: 400 };

/**
 * Maps a POST /api/run JSON body to a validated {@link RuntimeConfig}.
 * Does not read argv/env and never logs the body (may contain API keys).
 */
export function mapRunRequestToConfig(body: unknown): MapRunRequestResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Request body must be a JSON object', status: 400 };
  }

  const targetProjectPath = readRequiredString(body, 'targetProjectPath');
  if (!targetProjectPath.ok) {
    return targetProjectPath;
  }

  const docsDir = readOptionalString(body, 'docsDir');
  if (!docsDir.ok) {
    return docsDir;
  }

  const enableAiAnalysis = readOptionalBoolean(body, 'enableAiAnalysis');
  if (!enableAiAnalysis.ok) {
    return enableAiAnalysis;
  }

  const aiProvider = readOptionalString(body, 'aiProvider');
  if (!aiProvider.ok) {
    return aiProvider;
  }

  const aiModel = readOptionalString(body, 'aiModel');
  if (!aiModel.ok) {
    return aiModel;
  }

  const enableAgentExports = readOptionalBoolean(body, 'enableAgentExports');
  if (!enableAgentExports.ok) {
    return enableAgentExports;
  }

  const apiKeys = readApiKeys(body);
  if (!apiKeys.ok) {
    return apiKeys;
  }

  const exportTargetSelector = readExportTargetSelector(body);
  if (!exportTargetSelector.ok) {
    return exportTargetSelector;
  }

  const input: RuntimeConfigInput = {
    targetProjectPath: targetProjectPath.value,
    ...(docsDir.value !== undefined ? { docsDir: docsDir.value } : {}),
    ...(enableAiAnalysis.value !== undefined ? { enableAiAnalysis: enableAiAnalysis.value } : {}),
    ...(aiProvider.value !== undefined ? { aiProvider: aiProvider.value } : {}),
    ...(aiModel.value !== undefined ? { aiModel: aiModel.value } : {}),
    ...(apiKeys.value !== undefined ? { apiKeys: apiKeys.value } : {}),
    ...(enableAgentExports.value !== undefined
      ? { enableAgentExports: enableAgentExports.value }
      : {}),
    ...(exportTargetSelector.value !== undefined
      ? { exportTargetSelector: exportTargetSelector.value }
      : {}),
  };

  try {
    return { ok: true, config: buildRuntimeConfig(input) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid configuration';
    return { ok: false, error: message, status: 400 };
  }
}

type FieldResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly status: 400 };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(
  body: Record<string, unknown>,
  field: string,
): FieldResult<string> {
  if (!(field in body) || body[field] === undefined || body[field] === null) {
    return { ok: false, error: `${field} is required`, status: 400 };
  }
  if (typeof body[field] !== 'string') {
    return { ok: false, error: `${field} must be a string`, status: 400 };
  }
  const trimmed = body[field].trim();
  if (trimmed === '') {
    return { ok: false, error: `${field} is required`, status: 400 };
  }
  return { ok: true, value: trimmed };
}

function readOptionalString(
  body: Record<string, unknown>,
  field: string,
): FieldResult<string | undefined> {
  if (!(field in body) || body[field] === undefined || body[field] === null) {
    return { ok: true, value: undefined };
  }
  if (typeof body[field] !== 'string') {
    return { ok: false, error: `${field} must be a string`, status: 400 };
  }
  return { ok: true, value: body[field] };
}

function readOptionalBoolean(
  body: Record<string, unknown>,
  field: string,
): FieldResult<boolean | undefined> {
  if (!(field in body) || body[field] === undefined || body[field] === null) {
    return { ok: true, value: undefined };
  }
  if (typeof body[field] !== 'boolean') {
    return { ok: false, error: `${field} must be a boolean`, status: 400 };
  }
  return { ok: true, value: body[field] };
}

function readApiKeys(
  body: Record<string, unknown>,
): FieldResult<Partial<Record<string, string>> | undefined> {
  if (!('apiKeys' in body) || body.apiKeys === undefined || body.apiKeys === null) {
    return { ok: true, value: undefined };
  }
  if (!isPlainObject(body.apiKeys)) {
    return { ok: false, error: 'apiKeys must be an object', status: 400 };
  }

  const keys: Partial<Record<string, string>> = {};
  for (const [providerId, value] of Object.entries(body.apiKeys)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value !== 'string') {
      return {
        ok: false,
        error: `apiKeys.${providerId} must be a string`,
        status: 400,
      };
    }
    const normalizedId = normalizeAiProviderId(providerId);
    if (normalizedId === '') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed !== '') {
      keys[normalizedId] = trimmed;
    }
  }

  return {
    ok: true,
    value: Object.keys(keys).length > 0 ? keys : undefined,
  };
}

/**
 * Accepts plan-shaped `exportTargets` (string or string[]) and maps to
 * `RuntimeConfigInput.exportTargetSelector` (`generic` | `cursor` | `all`).
 */
function readExportTargetSelector(
  body: Record<string, unknown>,
): FieldResult<string | undefined> {
  if (!('exportTargets' in body) || body.exportTargets === undefined || body.exportTargets === null) {
    return { ok: true, value: undefined };
  }

  const raw = body.exportTargets;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return { ok: true, value: trimmed === '' ? undefined : trimmed };
  }

  if (!Array.isArray(raw)) {
    return {
      ok: false,
      error: 'exportTargets must be a string or an array of strings',
      status: 400,
    };
  }

  if (raw.length === 0) {
    return { ok: true, value: undefined };
  }

  const targets: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      return {
        ok: false,
        error: 'exportTargets must be a string or an array of strings',
        status: 400,
      };
    }
    const trimmed = item.trim().toLowerCase();
    if (trimmed !== '' && !targets.includes(trimmed)) {
      targets.push(trimmed);
    }
  }

  if (targets.length === 0) {
    return { ok: true, value: undefined };
  }
  if (targets.length === 1) {
    return { ok: true, value: targets[0] };
  }
  if (targets.includes('all') || (targets.includes('generic') && targets.includes('cursor'))) {
    return { ok: true, value: 'all' };
  }

  return {
    ok: false,
    error: `Unsupported exportTargets combination: ${targets.join(', ')}. Use generic, cursor, or all.`,
    status: 400,
  };
}
