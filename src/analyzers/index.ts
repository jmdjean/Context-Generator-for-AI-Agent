export {
  classifyFolder,
  reconcileClassificationSignals,
  type FolderClassificationInput,
  type FolderClassificationResult,
} from './folder-classifier';
export {
  analyzeFolderKnowledge,
  enrichProjectKnowledgeWithFolderAnalysis,
  shouldIgnoreFolder,
  type FolderAnalysisResult,
} from './folder-analyzer';
export {
  classifyModule,
  inferModuleResponsibility,
  refineModuleConfidence,
  shouldIgnoreModulePath,
  KNOWN_MODULE_RESPONSIBILITIES,
  type ModuleClassificationInput,
  type ModuleClassificationResult,
} from './module-classifier';
export {
  DIRECT_SOURCE_MODULES,
  MONOREPO_MODULE_CONTAINERS,
  isDocumentationModulePath,
} from './module-constants';
export {
  analyzeModuleKnowledge,
  enrichProjectKnowledgeWithModuleAnalysis,
  type ModuleAnalysisResult,
} from './module-analyzer';
export {
  analyzeDependencyGraph,
  enrichProjectKnowledgeWithDependencyGraph,
  resolveRelativeImportPath,
  type DependencyGraphAnalysisResult,
} from './dependency-graph-analyzer';
export {
  ARCHITECTURE_CONVENTION_RULES,
  CONVENTION_CATEGORY_ORDER,
  KNOWN_PACKAGE_MANAGERS,
  STRUCTURE_CONVENTION_RULES,
  detectArchitectureConventions,
  detectDocumentationConventions,
  detectGeneratedContextConventions,
  detectPackageManagerConventions,
  detectRepositoryStructureConventions,
  detectTestingConventions,
  detectTypeScriptConventions,
  parsePackageJsonTestScript,
  parseTsconfigSignals,
  sortConventions,
  type ArchitectureConventionRule,
  type ConventionDetectionInput,
  type StructureConventionRule,
  type TsconfigConventionSignals,
} from './convention-classifier';
export {
  analyzeConventions,
  enrichProjectKnowledgeWithConventions,
  type ConventionAnalysisResult,
} from './convention-analyzer';
export {
  parseImportsFromFile,
  parseImportsFromRepository,
  parseImportsFromText,
  prepareSourceForImportScan,
  listImportSourceFiles,
  type ParsedImport,
  type ImportParseOptions,
  type ImportParseResult,
} from './import-parser';
export {
  IGNORED_FOLDER_NAMES,
  KNOWN_SOURCE_MODULE_RESPONSIBILITIES,
  isImportantFile,
  isKnownSourceModule,
  isSourceModulePath,
  isUnderSourceRoot,
} from './folder-constants';
