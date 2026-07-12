import { ModuleKnowledge, ModuleType } from '../knowledge/project-knowledge';
import { toPosixPath } from './folder-constants';

export const MONOREPO_MODULE_CONTAINERS: Readonly<Record<string, ModuleType>> = {
  apps: 'application',
  packages: 'package',
  libs: 'library',
  projects: 'application',
  modules: 'feature',
};

export const SOURCE_MODULE_CONTAINERS: Readonly<Record<string, ModuleType>> = {
  'src/app': 'application',
  'src/apps': 'application',
  'src/features': 'feature',
  'src/modules': 'feature',
};

export const DIRECT_SOURCE_MODULES: Readonly<Record<string, ModuleType>> = {
  'src/components': 'component-group',
  'src/services': 'service-group',
  'src/core': 'core',
  'src/config': 'configuration',
  'src/shared': 'library',
  'src/knowledge': 'core',
  'src/scanner': 'core',
  'src/detectors': 'core',
  'src/docs': 'core',
  'src/analyzers': 'core',
  'src/domain': 'core',
  'src/ai': 'core',
  'src/utils': 'tooling',
};

export const STATIC_DOCUMENTATION_MODULE_PATHS = new Set(['docs']);

/**
 * Exact file names that mark a directory as a multi-ecosystem project/module root.
 * Detection uses repository-tree file names only — no arbitrary source reads.
 */
export const MODULE_MANIFEST_EXACT_NAMES = new Set([
  'package.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'go.mod',
  'Cargo.toml',
  'pyproject.toml',
  'setup.cfg',
]);

/** Case-insensitive extensions for .NET project manifests. */
export const MODULE_MANIFEST_EXTENSIONS = ['.csproj', '.fsproj'] as const;

export const KNOWN_MODULE_RESPONSIBILITIES: Readonly<Record<string, string>> = {
  'src/knowledge':
    'Represents and persists the Project Knowledge Model used as the source of truth.',
  'src/scanner': 'Builds the repository tree used by analyzers.',
  'src/detectors': 'Detects technologies and tooling from repository metadata.',
  'src/docs': 'Plans and writes documentation outputs derived from project knowledge.',
  'src/analyzers': 'Derives higher-level architectural knowledge from the PKM.',
  'src/core': 'Contains pipeline orchestration and core application coordination logic.',
  'src/domain': 'Defines pure domain types and the declarative analysis pipeline.',
  'src/config': 'Resolves runtime configuration from CLI flags and environment variables.',
  'src/ai': 'Integrates with AI providers for architecture analysis.',
  'src/utils': 'Provides shared utility functions with no domain knowledge.',
  docs: 'Contains human-readable project documentation.',
};

export function isModuleManifestFileName(fileName: string): boolean {
  if (MODULE_MANIFEST_EXACT_NAMES.has(fileName)) {
    return true;
  }

  const lower = fileName.toLowerCase();
  return MODULE_MANIFEST_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Returns owned manifest file names present among a directory's child files.
 * Order is stable (sorted) for deterministic signals.
 */
export function listOwnedModuleManifests(fileNames: readonly string[]): string[] {
  return [...new Set(fileNames.filter((name) => isModuleManifestFileName(name)))].sort();
}

/**
 * Infers a ModuleType from owned manifests. Path heuristics take precedence
 * when they match; this is the fallback for manifest-only discovery.
 */
export function inferModuleTypeFromManifests(
  manifestFileNames: readonly string[],
  relativePathHint: string = '',
): ModuleType | undefined {
  if (manifestFileNames.length === 0) {
    return undefined;
  }

  const names = new Set(manifestFileNames);
  const lowerNames = manifestFileNames.map((name) => name.toLowerCase());
  const relativePath = toPosixPath(relativePathHint);

  if (names.has('package.json')) {
    // Root npm package is usually the primary app; nested package.json is a package/workspace member.
  const isRoot = relativePath.length === 0 || relativePath === '.';
    return isRoot ? 'application' : 'package';
  }

  if (
    lowerNames.some((name) => name.endsWith('.csproj') || name.endsWith('.fsproj'))
  ) {
    return 'application';
  }

  if (names.has('pom.xml') || names.has('build.gradle') || names.has('build.gradle.kts')) {
    return 'application';
  }

  if (names.has('go.mod') || names.has('Cargo.toml')) {
    return 'application';
  }

  if (names.has('pyproject.toml') || names.has('setup.cfg')) {
    return 'package';
  }

  return 'unknown';
}

/**
 * Documentation modules stay in analysis.modules for maps and navigation,
 * but must not receive product-oriented AI module fan-out.
 */
export function isDocumentationOnlyModule(module: Pick<ModuleKnowledge, 'type'>): boolean {
  return module.type === 'documentation';
}

export function selectModulesForProductAiFanOut(
  modules: readonly ModuleKnowledge[],
): ModuleKnowledge[] {
  return modules.filter((module) => !isDocumentationOnlyModule(module));
}

export function isDirectChildOfContainer(relativePath: string, containerPath: string): boolean {
  const posixPath = toPosixPath(relativePath);
  const prefix = `${toPosixPath(containerPath)}/`;
  if (!posixPath.startsWith(prefix)) {
    return false;
  }

  const remainder = posixPath.slice(prefix.length);
  return remainder.length > 0 && !remainder.includes('/');
}

export function isDocumentationModulePath(relativePath: string, docsDir: string): boolean {
  const posixPath = toPosixPath(relativePath);
  return (
    STATIC_DOCUMENTATION_MODULE_PATHS.has(posixPath) || posixPath === toPosixPath(docsDir)
  );
}

/** Repository-root module path used when a root manifest owns the package. */
export function isRepositoryRootModulePath(relativePath: string): boolean {
  const posixPath = toPosixPath(relativePath);
  return posixPath.length === 0 || posixPath === '.';
}

/**
 * True when filePath belongs to modulePath. Root modules (`.` / ``) contain every path;
 * callers should prefer longer/more-specific modules first.
 */
export function modulePathContainsRelativePath(modulePath: string, filePath: string): boolean {
  const normalizedModule = toPosixPath(modulePath);
  const normalizedFile = toPosixPath(filePath);

  if (isRepositoryRootModulePath(normalizedModule)) {
    return true;
  }

  return (
    normalizedFile === normalizedModule ||
    normalizedFile.startsWith(`${normalizedModule}/`)
  );
}

export function isMonorepoContainerChild(relativePath: string): boolean {
  const posixPath = toPosixPath(relativePath);
  return Object.keys(MONOREPO_MODULE_CONTAINERS).some((container) =>
    isDirectChildOfContainer(posixPath, container),
  );
}

export function isSourceContainerChild(relativePath: string): boolean {
  const posixPath = toPosixPath(relativePath);
  return Object.keys(SOURCE_MODULE_CONTAINERS).some((container) =>
    isDirectChildOfContainer(posixPath, container),
  );
}

export function resolveDocumentationModuleResponsibility(
  relativePath: string,
  docsDir: string,
): string {
  const posixPath = toPosixPath(relativePath);
  if (posixPath === toPosixPath(docsDir)) {
    return 'Contains AI-readable project context generated by this tool.';
  }
  return KNOWN_MODULE_RESPONSIBILITIES.docs;
}
