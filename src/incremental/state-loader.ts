import * as fs from 'node:fs';
import * as path from 'node:path';
import { KNOWLEDGE_FILE_NAMES, resolveKnowledgeFilePath } from '../knowledge/knowledge-paths';
import { ChangeBaselineStatus, ProjectKnowledge } from '../knowledge/project-knowledge';

export interface PreviousKnowledgeBaseline {
  status: ChangeBaselineStatus;
  knowledge?: ProjectKnowledge;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProjectKnowledge(value: unknown): value is ProjectKnowledge {
  if (!isRecord(value)) {
    return false;
  }

  if (!isRecord(value.metadata) || !isRecord(value.repository) || !isRecord(value.technologies)) {
    return false;
  }

  if (!isRecord(value.documentation) || !isRecord(value.analysis)) {
    return false;
  }

  if (
    typeof value.metadata.schemaVersion !== 'string' ||
    typeof value.metadata.generatedAt !== 'string' ||
    typeof value.metadata.projectName !== 'string' ||
    typeof value.repository.rootPath !== 'string' ||
    typeof value.repository.name !== 'string' ||
    !Array.isArray(value.repository.detectedFiles)
  ) {
    return false;
  }

  const technologies = value.technologies;
  if (
    !Array.isArray(technologies.languages) ||
    !Array.isArray(technologies.frameworks) ||
    !Array.isArray(technologies.packageManagers) ||
    !Array.isArray(technologies.tooling) ||
    typeof technologies.confidence !== 'string'
  ) {
    return false;
  }

  return true;
}

function stripComparisonBaseline(knowledge: ProjectKnowledge): ProjectKnowledge {
  const {
    changeSummary: _changeSummary,
    documentImpact: _documentImpact,
    agentExports: _agentExports,
    ...analysisWithoutRunMetadata
  } = knowledge.analysis;

  return {
    ...knowledge,
    analysis: analysisWithoutRunMetadata,
  };
}

function repositoryRootsMatch(expectedRootPath: string, loadedRootPath: string): boolean {
  return path.resolve(expectedRootPath) === path.resolve(loadedRootPath);
}

export { repositoryRootsMatch };

export function loadPreviousKnowledgeBaseline(
  rootPath: string,
  docsDir: string,
  expectedRootPath: string,
): PreviousKnowledgeBaseline {
  const filePath = resolveKnowledgeFilePath(rootPath, docsDir, KNOWLEDGE_FILE_NAMES.projectKnowledge);

  if (!fs.existsSync(filePath)) {
    return { status: 'none' };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (!isProjectKnowledge(parsed)) {
      return { status: 'unreadable' };
    }

    const knowledge = stripComparisonBaseline(parsed);

    if (!repositoryRootsMatch(expectedRootPath, knowledge.repository.rootPath)) {
      return { status: 'repository-mismatch' };
    }

    return { status: 'loaded', knowledge };
  } catch {
    return { status: 'unreadable' };
  }
}
