import * as fs from 'node:fs';
import * as path from 'node:path';
import { RepositoryInfo, RepositoryNode } from '../domain';
import {
  buildEffectiveIgnorePatterns,
  createDirectoryIgnoreRules,
  createIgnoreRules,
  directoryHasOmittedEntries,
  IgnoreRules,
  shouldIgnoreEntry,
} from './ignore-rules';
import { createRepositoryBoundary, RepositoryBoundary } from './repository-boundary';
import { resolveScannerOptions, ResolvedScannerOptions, ScannerOptions } from './scanner-options';

export interface RepositoryScanStats {
  filesScanned: number;
  directoriesScanned: number;
  maxDepthReached: boolean;
  limitReached: boolean;
  permissionDenied: boolean;
  symlinksSkipped: number;
}

export interface RepositoryScanResult {
  tree: RepositoryNode;
  stats: RepositoryScanStats;
  ignoredPaths: string[];
}

interface ScanState {
  filesScanned: number;
  directoriesScanned: number;
  maxDepthReached: boolean;
  limitReached: boolean;
  permissionDenied: boolean;
  symlinksSkipped: number;
}

export function scanRepository(
  repositoryInfo: RepositoryInfo,
  options?: ScannerOptions,
): RepositoryScanResult {
  const resolvedOptions = resolveScannerOptions(options);
  const boundary = createRepositoryBoundary(repositoryInfo.rootPath);
  const ignoredPaths = buildEffectiveIgnorePatterns(
    resolvedOptions.ignoredPaths,
    boundary,
    resolvedOptions.outputDocsDir,
  );
  const ignoreRules = createIgnoreRules(ignoredPaths);

  const state: ScanState = {
    filesScanned: 0,
    directoriesScanned: 0,
    maxDepthReached: false,
    limitReached: false,
    permissionDenied: false,
    symlinksSkipped: 0,
  };

  const tree = scanDirectory(
    boundary,
    '',
    repositoryInfo.name,
    0,
    resolvedOptions,
    ignoreRules,
    state,
  );

  return {
    tree,
    stats: {
      filesScanned: state.filesScanned,
      directoriesScanned: state.directoriesScanned,
      maxDepthReached: state.maxDepthReached,
      limitReached: state.limitReached,
      permissionDenied: state.permissionDenied,
      symlinksSkipped: state.symlinksSkipped,
    },
    ignoredPaths,
  };
}

function scanDirectory(
  boundary: RepositoryBoundary,
  relativePath: string,
  name: string,
  depth: number,
  options: ResolvedScannerOptions,
  ignoreRules: IgnoreRules,
  state: ScanState,
): RepositoryNode {
  const absolutePath = boundary.resolveRelative(relativePath);
  state.directoriesScanned += 1;

  const node: RepositoryNode = {
    name,
    path: absolutePath,
    relativePath: toPosixPath(relativePath),
    type: 'directory',
  };

  const directoryIgnoreRules = createDirectoryIgnoreRules(ignoreRules, relativePath, absolutePath);

  if (depth >= options.maxDepth) {
    if (
      directoryHasOmittedEntries(
        absolutePath,
        relativePath,
        directoryIgnoreRules,
        options.includeHidden,
      )
    ) {
      state.maxDepthReached = true;
      node.truncated = true;
    }
    return node;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  } catch {
    state.permissionDenied = true;
    node.truncated = true;
    return node;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  const children: RepositoryNode[] = [];

  for (const entry of entries) {
    if (state.limitReached) {
      node.truncated = true;
      break;
    }

    const entryRelativePath = joinRelativePath(relativePath, entry.name);

    if (shouldIgnoreEntry(entry.name, entryRelativePath, directoryIgnoreRules, options.includeHidden)) {
      continue;
    }

    if (entry.isSymbolicLink()) {
      state.symlinksSkipped += 1;
      continue;
    }

    if (entry.isDirectory()) {
      if (state.filesScanned >= options.maxFiles) {
        state.limitReached = true;
        node.truncated = true;
        break;
      }

      children.push(
        scanDirectory(
          boundary,
          entryRelativePath,
          entry.name,
          depth + 1,
          options,
          directoryIgnoreRules,
          state,
        ),
      );
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (state.filesScanned >= options.maxFiles) {
      state.limitReached = true;
      node.truncated = true;
      break;
    }

    const entryAbsolutePath = boundary.resolveRelative(entryRelativePath);
    children.push(buildFileNode(entry.name, entryRelativePath, entryAbsolutePath));
    state.filesScanned += 1;

    if (state.filesScanned >= options.maxFiles) {
      state.limitReached = true;
      node.truncated = true;
      break;
    }
  }

  if (children.length > 0) {
    node.children = children;
  }

  return node;
}

function buildFileNode(name: string, relativePath: string, absolutePath: string): RepositoryNode {
  const extensionName = path.extname(name);
  const extension = extensionName.length > 0 ? extensionName.slice(1) : undefined;

  const node: RepositoryNode = {
    name,
    path: absolutePath,
    relativePath: toPosixPath(relativePath),
    type: 'file',
  };

  if (extension !== undefined) {
    node.extension = extension;
  }

  try {
    node.sizeBytes = fs.statSync(absolutePath).size;
  } catch {
    // size is optional when stat fails
  }

  return node;
}

function joinRelativePath(parentPath: string, name: string): string {
  const normalizedParent = toPosixPath(parentPath);
  return normalizedParent.length === 0 ? name : `${normalizedParent}/${name}`;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}
