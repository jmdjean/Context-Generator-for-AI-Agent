import * as fs from 'node:fs';
import { RepositoryNode } from '../domain';
import {
  ModuleKnowledge,
  OperationalContextConfidence,
  OperationalContextKnowledge,
  OperationalEnvVar,
  OperationalRunCommand,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { RepositoryBoundary, createRepositoryBoundary } from '../scanner/repository-boundary';
import { toPosixPath } from './folder-constants';
import { isDocumentationOnlyModule, isRepositoryRootModulePath } from './module-constants';

export interface OperationalContextAnalysisResult {
  operationalContext: OperationalContextKnowledge | undefined;
  purposeFound: boolean;
  runCommandCount: number;
  envVarCount: number;
}

export interface OperationalContextAnalysisOptions {
  boundary?: RepositoryBoundary;
  generatedAt?: string;
}

/** Allowlisted basenames that may be read for operational facts. */
export const OPERATIONAL_README_NAMES = ['README.md', 'README', 'readme.md'] as const;

export const OPERATIONAL_ENV_TEMPLATE_NAMES = [
  '.env.example',
  '.env.sample',
  '.env.template',
  'env.example',
] as const;

const PACKAGE_JSON_BASENAME = 'package.json';

interface RepositoryTreeIndex {
  filePaths: Set<string>;
}

function indexRepositoryTree(tree: RepositoryNode | undefined): RepositoryTreeIndex {
  const filePaths = new Set<string>();

  const visit = (node: RepositoryNode): void => {
    const relativePath = toPosixPath(node.relativePath);
    if (node.type === 'file') {
      filePaths.add(relativePath);
      return;
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };

  if (tree !== undefined) {
    visit(tree);
  }

  return { filePaths };
}

function fileExistsInIndex(
  relativePath: string,
  index: RepositoryTreeIndex,
  detectedFiles: readonly string[],
): boolean {
  const posixPath = toPosixPath(relativePath);
  return index.filePaths.has(posixPath) || detectedFiles.includes(posixPath);
}

function readAllowlistedText(
  boundary: RepositoryBoundary,
  relativePath: string,
  index: RepositoryTreeIndex,
  detectedFiles: readonly string[],
): string | undefined {
  if (!fileExistsInIndex(relativePath, index, detectedFiles)) {
    return undefined;
  }

  try {
    return fs.readFileSync(boundary.resolveRelative(relativePath), 'utf-8');
  } catch {
    return undefined;
  }
}

function isMeaningfulReadmeLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (/^#{1,6}\s/.test(trimmed)) {
    return false;
  }
  if (/^[-*_]{3,}\s*$/.test(trimmed)) {
    return false;
  }
  if (/^\[!\[/.test(trimmed) || /^!\[/.test(trimmed)) {
    return false;
  }
  if (/^>\s*/.test(trimmed) && trimmed.replace(/^>\s*/, '').length === 0) {
    return false;
  }
  return true;
}

/**
 * Extracts the first meaningful prose paragraph from README markdown.
 * Skips headings, badges, horizontal rules, and empty lines.
 */
export function extractPurposeFromReadme(readmeText: string): string | undefined {
  const lines = readmeText.replace(/\r\n/g, '\n').split('\n');
  const paragraph: string[] = [];

  for (const line of lines) {
    if (!isMeaningfulReadmeLine(line)) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }
    paragraph.push(line.trim());
  }

  if (paragraph.length === 0) {
    return undefined;
  }

  const purpose = paragraph.join(' ').replace(/\s+/g, ' ').trim();
  return purpose.length > 0 ? purpose : undefined;
}

export function extractDescriptionFromPackageJson(packageJsonText: string): string | undefined {
  try {
    const parsed = JSON.parse(packageJsonText) as { description?: unknown };
    if (typeof parsed.description !== 'string') {
      return undefined;
    }
    const description = parsed.description.trim();
    return description.length > 0 ? description : undefined;
  } catch {
    return undefined;
  }
}

export function extractRunCommandsFromPackageJson(
  packageJsonText: string,
  source: string,
  moduleRelativePath?: string,
): OperationalRunCommand[] {
  try {
    const parsed = JSON.parse(packageJsonText) as { scripts?: unknown };
    if (parsed.scripts === null || typeof parsed.scripts !== 'object' || Array.isArray(parsed.scripts)) {
      return [];
    }

    const scripts = parsed.scripts as Record<string, unknown>;
    const commands: OperationalRunCommand[] = [];

    for (const name of Object.keys(scripts).sort()) {
      const command = scripts[name];
      if (typeof command !== 'string') {
        continue;
      }
      const trimmed = command.trim();
      if (trimmed.length === 0) {
        continue;
      }
      commands.push({
        name,
        command: trimmed,
        source,
        ...(moduleRelativePath !== undefined ? { moduleRelativePath } : {}),
      });
    }

    return commands;
  } catch {
    return [];
  }
}

/**
 * Extracts environment variable keys from dotenv-style templates.
 * Never returns values — only KEY names.
 */
export function extractEnvKeysFromTemplate(templateText: string, source: string): OperationalEnvVar[] {
  const keys = new Set<string>();
  const lines = templateText.replace(/\r\n/g, '\n').split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(withoutExport);
    if (match?.[1] !== undefined) {
      keys.add(match[1]);
    }
  }

  return [...keys].sort().map((key) => ({ key, source }));
}

function resolveRootReadmePath(
  index: RepositoryTreeIndex,
  detectedFiles: readonly string[],
): string | undefined {
  for (const name of OPERATIONAL_README_NAMES) {
    if (fileExistsInIndex(name, index, detectedFiles)) {
      return name;
    }
  }
  return undefined;
}

function resolveRootEnvTemplatePaths(
  index: RepositoryTreeIndex,
  detectedFiles: readonly string[],
): string[] {
  return OPERATIONAL_ENV_TEMPLATE_NAMES.filter((name) =>
    fileExistsInIndex(name, index, detectedFiles),
  );
}

function packageJsonPathForModule(moduleRelativePath: string): string {
  if (isRepositoryRootModulePath(moduleRelativePath)) {
    return PACKAGE_JSON_BASENAME;
  }
  return `${toPosixPath(moduleRelativePath)}/${PACKAGE_JSON_BASENAME}`;
}

function selectModulesForScripts(modules: readonly ModuleKnowledge[]): ModuleKnowledge[] {
  return modules.filter((module) => !isDocumentationOnlyModule(module));
}

function resolveConfidence(input: {
  purposeFound: boolean;
  runCommandCount: number;
  envVarCount: number;
}): OperationalContextConfidence {
  const signalCount =
    (input.purposeFound ? 1 : 0) +
    (input.runCommandCount > 0 ? 1 : 0) +
    (input.envVarCount > 0 ? 1 : 0);

  if (signalCount >= 2) {
    return 'high';
  }
  if (signalCount === 1) {
    return 'medium';
  }
  return 'low';
}

export function analyzeOperationalContext(
  knowledge: ProjectKnowledge,
  options?: OperationalContextAnalysisOptions,
): OperationalContextAnalysisResult {
  const boundary =
    options?.boundary ?? createRepositoryBoundary(knowledge.repository.rootPath);
  const index = indexRepositoryTree(knowledge.repository.repositoryTree);
  const detectedFiles = knowledge.repository.detectedFiles;
  const signals: string[] = [];
  const generatedAt = options?.generatedAt ?? new Date().toISOString();

  let purpose: string | undefined;
  const readmePath = resolveRootReadmePath(index, detectedFiles);
  if (readmePath !== undefined) {
    const readmeText = readAllowlistedText(boundary, readmePath, index, detectedFiles);
    if (readmeText !== undefined) {
      purpose = extractPurposeFromReadme(readmeText);
      if (purpose !== undefined) {
        signals.push(`purpose:readme:${readmePath}`);
      }
    }
  }

  const rootPackageText = readAllowlistedText(
    boundary,
    PACKAGE_JSON_BASENAME,
    index,
    detectedFiles,
  );
  if (purpose === undefined && rootPackageText !== undefined) {
    purpose = extractDescriptionFromPackageJson(rootPackageText);
    if (purpose !== undefined) {
      signals.push('purpose:package.json#description');
    }
  }

  const runCommands: OperationalRunCommand[] = [];
  const modules = selectModulesForScripts(knowledge.analysis.modules ?? []);
  const seenSources = new Set<string>();

  if (rootPackageText !== undefined) {
    const rootCommands = extractRunCommandsFromPackageJson(
      rootPackageText,
      PACKAGE_JSON_BASENAME,
      '.',
    );
    if (rootCommands.length > 0) {
      runCommands.push(...rootCommands);
      seenSources.add(PACKAGE_JSON_BASENAME);
      signals.push('runCommands:package.json#scripts');
    }
  }

  for (const module of modules) {
    const relativePackagePath = packageJsonPathForModule(module.relativePath);
    if (seenSources.has(relativePackagePath)) {
      continue;
    }
    const packageText = readAllowlistedText(
      boundary,
      relativePackagePath,
      index,
      detectedFiles,
    );
    if (packageText === undefined) {
      continue;
    }

    const moduleCommands = extractRunCommandsFromPackageJson(
      packageText,
      relativePackagePath,
      normalizeModulePath(module.relativePath),
    );
    if (moduleCommands.length === 0) {
      continue;
    }

    runCommands.push(...moduleCommands);
    seenSources.add(relativePackagePath);
    signals.push(`runCommands:${relativePackagePath}#scripts`);
  }

  const envVars: OperationalEnvVar[] = [];
  for (const envPath of resolveRootEnvTemplatePaths(index, detectedFiles)) {
    const templateText = readAllowlistedText(boundary, envPath, index, detectedFiles);
    if (templateText === undefined) {
      continue;
    }
    const keys = extractEnvKeysFromTemplate(templateText, envPath);
    if (keys.length === 0) {
      continue;
    }
    envVars.push(...keys);
    signals.push(`envVars:${envPath}`);
  }

  const purposeFound = purpose !== undefined;
  const runCommandCount = runCommands.length;
  const envVarCount = envVars.length;

  if (!purposeFound && runCommandCount === 0 && envVarCount === 0) {
    return {
      operationalContext: undefined,
      purposeFound: false,
      runCommandCount: 0,
      envVarCount: 0,
    };
  }

  const operationalContext: OperationalContextKnowledge = {
    ...(purposeFound ? { purpose } : {}),
    ...(runCommandCount > 0 ? { runCommands } : {}),
    ...(envVarCount > 0 ? { envVars } : {}),
    generatedAt,
    signals: [...new Set(signals)].sort(),
    confidence: resolveConfidence({ purposeFound, runCommandCount, envVarCount }),
  };

  return {
    operationalContext,
    purposeFound,
    runCommandCount,
    envVarCount,
  };
}

function normalizeModulePath(relativePath: string): string {
  return isRepositoryRootModulePath(relativePath) ? '.' : toPosixPath(relativePath);
}

export function enrichProjectKnowledgeWithOperationalContext(
  knowledge: ProjectKnowledge,
  options?: OperationalContextAnalysisOptions,
): { knowledge: ProjectKnowledge; result: OperationalContextAnalysisResult } {
  const result = analyzeOperationalContext(knowledge, options);
  const hasContext = result.operationalContext !== undefined;

  return {
    knowledge: {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        status:
          hasContext || knowledge.analysis.status === 'partial'
            ? 'partial'
            : knowledge.analysis.status,
        operationalContext: result.operationalContext,
      },
    },
    result,
  };
}
