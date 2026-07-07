import { FolderClassification, FolderKnowledgeConfidence } from '../knowledge/project-knowledge';
import {
  CONFIG_FILE_NAMES,
  NAME_CLASSIFICATIONS,
  TEST_FILE_PATTERN,
  hasNonTestSourceFiles,
  isKnownSourceModule,
  isUnderSourceRoot,
  normalizeFolderName,
} from './folder-constants';

export interface FolderClassificationInput {
  name: string;
  relativePath: string;
  childFileNames: string[];
  childFolderNames: string[];
}

export interface FolderClassificationResult {
  classification: FolderClassification;
  confidence: FolderKnowledgeConfidence;
  signals: string[];
}

function classifyByName(name: string): FolderClassification | undefined {
  const normalized = normalizeFolderName(name);
  for (const entry of NAME_CLASSIFICATIONS) {
    if (entry.names.includes(normalized)) {
      return entry.classification;
    }
  }
  return undefined;
}

function classifyByFileSignals(
  childFileNames: readonly string[],
  relativePath: string,
): {
  classification?: FolderClassification;
  signals: string[];
} {
  const signals: string[] = [];
  let classification: FolderClassification | undefined;
  const underSourceRoot = isUnderSourceRoot(relativePath);
  const hasSourceFiles = hasNonTestSourceFiles(childFileNames);

  for (const fileName of childFileNames) {
    if (TEST_FILE_PATTERN.test(fileName)) {
      signals.push(`test-file:${fileName}`);
      if (!underSourceRoot && !hasSourceFiles) {
        classification = 'test';
      }
    }

    if (CONFIG_FILE_NAMES.has(fileName)) {
      signals.push(`config-file:${fileName}`);
      if (classification === undefined && !underSourceRoot) {
        classification = 'config';
      }
    }

    if (fileName === 'README.md' || fileName === 'AGENTS.md') {
      signals.push(`doc-file:${fileName}`);
      if (classification === undefined && !underSourceRoot) {
        classification = 'documentation';
      }
    }
  }

  if (underSourceRoot && hasSourceFiles && classification === undefined) {
    classification = 'source';
    signals.push('path-context:source-files');
  }

  return { classification, signals };
}

export function reconcileClassificationSignals(
  signals: readonly string[],
  previousClassification: FolderClassification,
  finalClassification: FolderClassification,
): string[] {
  if (previousClassification === finalClassification) {
    return [...signals];
  }

  const reconciled = signals.filter((signal) => {
    if (!signal.startsWith('name-match:')) {
      return true;
    }

    const matchedClassification = signal.slice('name-match:'.length);
    return matchedClassification === finalClassification;
  });

  reconciled.push(`refined-from:${previousClassification}`);
  return reconciled;
}

function finalizePathContextResult(
  result: FolderClassificationResult,
  finalClassification: FolderClassification,
  confidence: FolderKnowledgeConfidence,
  extraSignals: readonly string[],
): FolderClassificationResult {
  const signals = reconcileClassificationSignals(
    result.signals,
    result.classification,
    finalClassification,
  );

  return {
    classification: finalClassification,
    confidence,
    signals: [...signals, ...extraSignals],
  };
}

function applyPathContext(
  input: FolderClassificationInput,
  result: FolderClassificationResult,
): FolderClassificationResult {
  if (isKnownSourceModule(input.relativePath, input.name)) {
    return finalizePathContextResult(result, 'source', 'high', ['path-context:source-module']);
  }

  if (
    isUnderSourceRoot(input.relativePath) &&
    result.classification === 'documentation' &&
    hasNonTestSourceFiles(input.childFileNames)
  ) {
    return finalizePathContextResult(result, 'source', 'medium', ['path-context:source-tree']);
  }

  if (
    isUnderSourceRoot(input.relativePath) &&
    input.name !== normalizeFolderName(input.relativePath.split('/')[0] ?? '') &&
    result.classification === 'unknown' &&
    hasNonTestSourceFiles(input.childFileNames)
  ) {
    return finalizePathContextResult(result, 'source', 'medium', ['path-context:source-tree']);
  }

  return result;
}

export function classifyFolder(input: FolderClassificationInput): FolderClassificationResult {
  const signals: string[] = [`folder-name:${input.name}`];
  const nameClassification = classifyByName(input.name);

  let result: FolderClassificationResult;

  if (nameClassification !== undefined) {
    signals.push(`name-match:${nameClassification}`);
    result = {
      classification: nameClassification,
      confidence: 'high',
      signals,
    };
  } else {
    const fileSignals = classifyByFileSignals(input.childFileNames, input.relativePath);
    signals.push(...fileSignals.signals);

    if (fileSignals.classification !== undefined) {
      result = {
        classification: fileSignals.classification,
        confidence: 'medium',
        signals,
      };
    } else if (input.childFolderNames.length > 0) {
      signals.push(`child-folders:${input.childFolderNames.length}`);
      result = {
        classification: 'unknown',
        confidence: 'low',
        signals,
      };
    } else {
      result = {
        classification: 'unknown',
        confidence: 'low',
        signals,
      };
    }
  }

  return applyPathContext(input, result);
}
