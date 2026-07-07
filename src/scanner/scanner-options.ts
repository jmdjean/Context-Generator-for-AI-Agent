import { DEFAULT_IGNORED_PATHS, mergeIgnoredPaths } from './ignore-rules';

export const DEFAULT_MAX_DEPTH = 12;
export const DEFAULT_MAX_FILES = 10000;
export const DEFAULT_INCLUDE_HIDDEN = false;

export interface ScannerOptions {
  maxDepth?: number;
  maxFiles?: number;
  includeHidden?: boolean;
  ignoredPaths?: string[];
  outputDocsDir?: string;
}

export interface ResolvedScannerOptions {
  maxDepth: number;
  maxFiles: number;
  includeHidden: boolean;
  ignoredPaths: string[];
  outputDocsDir?: string;
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

export function resolveScannerOptions(options?: ScannerOptions): ResolvedScannerOptions {
  const resolved: ResolvedScannerOptions = {
    maxDepth: normalizeLimit(options?.maxDepth, DEFAULT_MAX_DEPTH),
    maxFiles: normalizeLimit(options?.maxFiles, DEFAULT_MAX_FILES),
    includeHidden: options?.includeHidden ?? DEFAULT_INCLUDE_HIDDEN,
    ignoredPaths: mergeIgnoredPaths(options?.ignoredPaths),
  };

  if (options?.outputDocsDir !== undefined && options.outputDocsDir.trim().length > 0) {
    resolved.outputDocsDir = options.outputDocsDir.trim();
  }

  return resolved;
}

export function getDefaultIgnoredPaths(): string[] {
  return [...DEFAULT_IGNORED_PATHS];
}
