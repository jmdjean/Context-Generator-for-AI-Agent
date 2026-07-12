import {
  FolderClassification,
  FolderKnowledgeConfidence,
  ModuleKnowledgeConfidence,
  ModuleType,
} from '../knowledge/project-knowledge';
import {
  IGNORED_FOLDER_NAMES,
  getKnowledgeDirectoryRelativePath,
  normalizeFolderName,
  toPosixPath,
} from './folder-constants';
import {
  DIRECT_SOURCE_MODULES,
  KNOWN_MODULE_RESPONSIBILITIES,
  MONOREPO_MODULE_CONTAINERS,
  SOURCE_MODULE_CONTAINERS,
  inferModuleTypeFromManifests,
  isDirectChildOfContainer,
  isDocumentationModulePath,
  isMonorepoContainerChild,
  isSourceContainerChild,
  listOwnedModuleManifests,
  resolveDocumentationModuleResponsibility,
} from './module-constants';

export interface ModuleClassificationInput {
  relativePath: string;
  name: string;
  docsDir: string;
  folderClassification?: FolderClassification;
  folderConfidence?: FolderKnowledgeConfidence;
  hasImportantFiles?: boolean;
  hasChildFolders?: boolean;
  /** Child file basenames used for multi-ecosystem manifest detection. */
  ownedFileNames?: readonly string[];
}

export interface ModuleClassificationResult {
  type: ModuleType;
  confidence: ModuleKnowledgeConfidence;
  signals: string[];
}

export { KNOWN_MODULE_RESPONSIBILITIES } from './module-constants';

function classifyMonorepoChild(relativePath: string): ModuleClassificationResult | undefined {
  const posixPath = toPosixPath(relativePath);

  for (const [container, moduleType] of Object.entries(MONOREPO_MODULE_CONTAINERS)) {
    if (isDirectChildOfContainer(posixPath, container)) {
      return {
        type: moduleType,
        confidence: 'high',
        signals: [`container:${container}`, `module-type:${moduleType}`],
      };
    }
  }

  return undefined;
}

function classifySourceChild(relativePath: string): ModuleClassificationResult | undefined {
  const posixPath = toPosixPath(relativePath);

  for (const [container, moduleType] of Object.entries(SOURCE_MODULE_CONTAINERS)) {
    if (isDirectChildOfContainer(posixPath, container)) {
      return {
        type: moduleType,
        confidence: 'high',
        signals: [`container:${container}`, `module-type:${moduleType}`],
      };
    }
  }

  return undefined;
}

function classifyDirectSourceModule(relativePath: string): ModuleClassificationResult | undefined {
  const posixPath = toPosixPath(relativePath);
  const moduleType = DIRECT_SOURCE_MODULES[posixPath];

  if (moduleType === undefined) {
    return undefined;
  }

  return {
    type: moduleType,
    confidence: 'high',
    signals: [`path:src-module:${posixPath}`, `module-type:${moduleType}`],
  };
}

function classifyDocumentationModule(
  relativePath: string,
  docsDir: string,
): ModuleClassificationResult | undefined {
  if (!isDocumentationModulePath(relativePath, docsDir)) {
    return undefined;
  }

  const posixPath = toPosixPath(relativePath);
  return {
    type: 'documentation',
    confidence: 'high',
    signals: [`path:${posixPath}`, 'module-type:documentation'],
  };
}

function classifyManifestOwnedModule(
  input: ModuleClassificationInput,
): ModuleClassificationResult | undefined {
  const ownedFileNames =
    input.ownedFileNames !== undefined
      ? input.ownedFileNames
      : [];
  const manifests = listOwnedModuleManifests(ownedFileNames);
  const moduleType = inferModuleTypeFromManifests(manifests, input.relativePath);
  if (moduleType === undefined) {
    return undefined;
  }

  const relativePath = toPosixPath(input.relativePath);
  const pathSignal =
    relativePath.length === 0 || relativePath === '.'
      ? 'path:repository-root'
      : `path:${relativePath}`;

  return {
    type: moduleType,
    confidence: 'high',
    signals: [
      pathSignal,
      ...manifests.map((manifest) => `manifest:${manifest}`),
      `module-type:${moduleType}`,
    ],
  };
}

export function shouldIgnoreModulePath(relativePath: string, docsDir: string): boolean {
  const posixPath = toPosixPath(relativePath);
  const knowledgePath = getKnowledgeDirectoryRelativePath(docsDir);

  if (posixPath === knowledgePath || posixPath.startsWith(`${knowledgePath}/`)) {
    return true;
  }

  const segments = posixPath.split('/').filter((segment) => segment.length > 0);
  return segments.some((segment) => IGNORED_FOLDER_NAMES.has(segment));
}

function isContainerChild(relativePath: string): boolean {
  return isMonorepoContainerChild(relativePath) || isSourceContainerChild(relativePath);
}

export function refineModuleConfidence(
  structuralConfidence: ModuleKnowledgeConfidence,
  input: ModuleClassificationInput,
): ModuleKnowledgeConfidence {
  if (structuralConfidence !== 'high') {
    return structuralConfidence;
  }

  const posixPath = toPosixPath(input.relativePath);
  if (DIRECT_SOURCE_MODULES[posixPath] !== undefined) {
    return 'high';
  }

  if (input.folderConfidence === 'low') {
    return 'medium';
  }

  if (
    isContainerChild(input.relativePath) &&
    input.folderClassification !== undefined &&
    input.folderClassification !== 'source'
  ) {
    return 'medium';
  }

  if (
    isContainerChild(input.relativePath) &&
    input.folderClassification === 'source' &&
    input.hasImportantFiles === false &&
    input.hasChildFolders === false
  ) {
    return 'medium';
  }

  if (input.folderConfidence === 'medium') {
    return 'medium';
  }

  return 'high';
}

export function classifyModule(
  input: ModuleClassificationInput,
): ModuleClassificationResult | undefined {
  if (shouldIgnoreModulePath(input.relativePath, input.docsDir)) {
    return undefined;
  }

  const pathClassifiers: Array<(relativePath: string) => ModuleClassificationResult | undefined> = [
    (relativePath) => classifyDocumentationModule(relativePath, input.docsDir),
    classifyDirectSourceModule,
    classifyMonorepoChild,
    classifySourceChild,
  ];

  for (const classifier of pathClassifiers) {
    const result = classifier(input.relativePath);
    if (result !== undefined) {
      return {
        ...result,
        confidence: refineModuleConfidence(result.confidence, input),
      };
    }
  }

  const manifestResult = classifyManifestOwnedModule(input);
  if (manifestResult !== undefined) {
    return {
      ...manifestResult,
      confidence: refineModuleConfidence(manifestResult.confidence, input),
    };
  }

  return undefined;
}

function responsibilityForType(
  type: ModuleType,
  name: string,
  relativePath: string,
  docsDir: string,
): string {
  const posixPath = toPosixPath(relativePath);
  const knownResponsibility = KNOWN_MODULE_RESPONSIBILITIES[posixPath];
  if (knownResponsibility !== undefined) {
    return knownResponsibility;
  }

  if (type === 'documentation') {
    return resolveDocumentationModuleResponsibility(relativePath, docsDir);
  }

  switch (type) {
    case 'application':
      if (
        isDirectChildOfContainer(posixPath, 'apps') ||
        isDirectChildOfContainer(posixPath, 'src/app') ||
        isDirectChildOfContainer(posixPath, 'src/apps') ||
        isDirectChildOfContainer(posixPath, 'projects')
      ) {
        return 'Represents an application entrypoint inside the monorepo.';
      }
      if (posixPath.length === 0 || posixPath === '.') {
        return 'Represents the repository root application module.';
      }
      return `Represents the ${name} application module.`;
    case 'library':
      return 'Represents a reusable library module.';
    case 'package':
      if (posixPath.length === 0 || posixPath === '.') {
        return 'Represents the repository root package module.';
      }
      return 'Represents a publishable or installable package module.';
    case 'feature':
      return `Represents the ${name} feature module.`;
    case 'component-group':
      return 'Groups reusable UI or presentation components.';
    case 'service-group':
      return 'Groups service or business-logic modules.';
    case 'core':
      return `Contains core platform logic for ${name}.`;
    case 'configuration':
      return 'Contains configuration resolution and runtime settings.';
    case 'tooling':
      return 'Contains development tooling and helper utilities.';
    default:
      return `Represents the ${name} module at ${relativePath}.`;
  }
}

export function inferModuleResponsibility(
  type: ModuleType,
  name: string,
  relativePath: string,
  docsDir: string,
): string {
  return responsibilityForType(type, normalizeFolderName(name), toPosixPath(relativePath), docsDir);
}
