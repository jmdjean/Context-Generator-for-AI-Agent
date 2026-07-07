export { createRepositoryBoundary, type RepositoryBoundary } from './repository-boundary';
export {
  ALWAYS_IGNORED_NAMES,
  buildEffectiveIgnorePatterns,
  createDirectoryIgnoreRules,
  createIgnoreRules,
  DEFAULT_IGNORED_PATHS,
  directoryHasOmittedEntries,
  isUnsafeEntryName,
  loadGitignorePatterns,
  mergeIgnoredPaths,
  parseGitignoreContent,
  scopeGitignorePatternsToDirectory,
  shouldIgnoreEntry,
  type IgnoreRules,
} from './ignore-rules';
export { loadRepositoryMetadata } from './repository-loader';
export {
  DEFAULT_INCLUDE_HIDDEN,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FILES,
  getDefaultIgnoredPaths,
  resolveScannerOptions,
  type ResolvedScannerOptions,
  type ScannerOptions,
} from './scanner-options';
export {
  scanRepository,
  type RepositoryScanResult,
  type RepositoryScanStats,
} from './repository-scanner';
