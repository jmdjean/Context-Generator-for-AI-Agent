import * as fs from 'node:fs';
import * as path from 'node:path';
import { RepositoryNode } from '../domain';
import { RepositoryBoundary } from '../scanner/repository-boundary';
import {
  getKnowledgeDirectoryRelativePath,
  IGNORED_FOLDER_NAMES,
  isTestFolderSegment,
  TEST_FILE_PATTERN,
  toPosixPath,
} from './folder-constants';
import { modulePathContainsRelativePath } from './module-constants';

export const IMPORT_SOURCE_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

export interface ParsedImport {
  sourceFile: string;
  importPath: string;
}

export interface ImportParseOptions {
  docsDir: string;
  modulePaths: readonly string[];
  boundary: RepositoryBoundary;
}

export interface ImportParseResult {
  imports: ParsedImport[];
  filesRead: number;
  filesSkipped: number;
}

const IMPORT_FROM_PATTERN =
  /(?:^|\n)\s*(?:import\s+(?:type\s+)?(?:[\w*{}\s,]+|\*\s+as\s+\w+)\s+from\s+|export\s+(?:type\s+)?(?:[\w*{}\s,]+|\*\s+as\s+\w+)\s+from\s+)['"]([^'"]+)['"]/g;

const SIDE_EFFECT_IMPORT_PATTERN = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

const REQUIRE_PATTERN = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const DYNAMIC_IMPORT_PATTERN = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function isImportSourceFile(fileName: string): boolean {
  if (TEST_FILE_PATTERN.test(fileName)) {
    return false;
  }

  const extension = path.posix.extname(fileName).toLowerCase();
  return IMPORT_SOURCE_FILE_EXTENSIONS.has(extension);
}

function isUnderModulePath(relativePath: string, modulePaths: readonly string[]): boolean {
  const posixPath = toPosixPath(relativePath);
  return modulePaths.some((modulePath) => modulePathContainsRelativePath(modulePath, posixPath));
}

function shouldIgnoreImportFile(relativePath: string, docsDir: string): boolean {
  const posixPath = toPosixPath(relativePath);
  const normalizedDocsDir = toPosixPath(docsDir);
  const knowledgePath = getKnowledgeDirectoryRelativePath(docsDir);

  if (posixPath === knowledgePath || posixPath.startsWith(`${knowledgePath}/`)) {
    return true;
  }

  if (posixPath === normalizedDocsDir || posixPath.startsWith(`${normalizedDocsDir}/`)) {
    return true;
  }

  const segments = posixPath.split('/').filter((segment) => segment.length > 0);
  return segments.some(
    (segment) => IGNORED_FOLDER_NAMES.has(segment) || isTestFolderSegment(segment),
  );
}

function isImportLikeLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
    return true;
  }

  return (
    /^(?:const|let|var)\s+\w+\s*=\s*require\s*\(/.test(trimmed) ||
    /^require\s*\(/.test(trimmed) ||
    /^(?:const|let|var)\s+\w+\s*=\s*import\s*\(/.test(trimmed) ||
    /^import\s*\(/.test(trimmed)
  );
}

function stripLineComment(line: string): string {
  return line.replace(/(^|[^:])\/\/.*$/, '$1');
}

export function prepareSourceForImportScan(sourceText: string): string {
  const withoutBlockComments = sourceText.replace(/\/\*[\s\S]*?\*\//g, ' ');

  return withoutBlockComments
    .split('\n')
    .map((line) => {
      const withoutComment = stripLineComment(line);
      if (isImportLikeLine(withoutComment)) {
        return withoutComment;
      }

      return withoutComment
        .replace(/(['"])(?:\\.|(?!\1)[^\\])*\1/g, ' ')
        .replace(/`(?:\\.|[^\\`])*`/g, ' ');
    })
    .join('\n');
}

function extractImportSpecifiers(sourceText: string): string[] {
  const sanitizedSource = prepareSourceForImportScan(sourceText);
  const matches: Array<{ index: number; specifier: string }> = [];

  for (const pattern of [
    IMPORT_FROM_PATTERN,
    SIDE_EFFECT_IMPORT_PATTERN,
    REQUIRE_PATTERN,
    DYNAMIC_IMPORT_PATTERN,
  ]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sanitizedSource)) !== null) {
      const specifier = match[1]?.trim();
      if (specifier !== undefined && specifier.length > 0) {
        matches.push({ index: match.index, specifier });
      }
    }
  }

  matches.sort((left, right) => left.index - right.index);
  return matches.map((match) => match.specifier);
}

function collectImportSourceFiles(
  node: RepositoryNode,
  options: ImportParseOptions,
  collected: string[],
): void {
  if (node.type === 'file') {
    const relativePath = toPosixPath(node.relativePath);
    if (
      isImportSourceFile(node.name) &&
      isUnderModulePath(relativePath, options.modulePaths) &&
      !shouldIgnoreImportFile(relativePath, options.docsDir)
    ) {
      collected.push(relativePath);
    }
    return;
  }

  if (node.type !== 'directory' || node.children === undefined) {
    return;
  }

  const relativePath = toPosixPath(node.relativePath);
  if (relativePath.length > 0 && shouldIgnoreImportFile(relativePath, options.docsDir)) {
    return;
  }

  for (const child of node.children) {
    collectImportSourceFiles(child, options, collected);
  }
}

export function listImportSourceFiles(
  repositoryTree: RepositoryNode | undefined,
  options: ImportParseOptions,
): string[] {
  if (repositoryTree === undefined) {
    return [];
  }

  const collected: string[] = [];
  collectImportSourceFiles(repositoryTree, options, collected);
  return collected.sort();
}

export function parseImportsFromText(
  sourceFile: string,
  sourceText: string,
): ParsedImport[] {
  const normalizedSourceFile = toPosixPath(sourceFile);
  return extractImportSpecifiers(sourceText).map((importPath) => ({
    sourceFile: normalizedSourceFile,
    importPath,
  }));
}

export function parseImportsFromFile(
  sourceFile: string,
  boundary: RepositoryBoundary,
): ParsedImport[] {
  const absolutePath = boundary.resolveRelative(sourceFile);
  const sourceText = fs.readFileSync(absolutePath, 'utf-8');
  return parseImportsFromText(sourceFile, sourceText);
}

export function parseImportsFromRepository(
  repositoryTree: RepositoryNode | undefined,
  options: ImportParseOptions,
): ImportParseResult {
  const sourceFiles = listImportSourceFiles(repositoryTree, options);
  const imports: ParsedImport[] = [];
  let filesRead = 0;
  let filesSkipped = 0;

  for (const sourceFile of sourceFiles) {
    try {
      imports.push(...parseImportsFromFile(sourceFile, options.boundary));
      filesRead += 1;
    } catch {
      filesSkipped += 1;
    }
  }

  return {
    imports,
    filesRead,
    filesSkipped,
  };
}
