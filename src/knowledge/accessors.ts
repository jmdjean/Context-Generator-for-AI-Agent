import * as path from 'node:path';
import { DocumentationPlan } from '../domain/documentation-plan';
import { ProjectKnowledge } from './project-knowledge';

export function getProjectRoot(knowledge: ProjectKnowledge): string {
  return knowledge.repository.rootPath;
}

export function getDocsDir(knowledge: ProjectKnowledge): string {
  return knowledge.metadata.docsDir;
}

export function getDocumentationPlan(knowledge: ProjectKnowledge): DocumentationPlan {
  return knowledge.documentation.plan;
}

export function isAnalysisComplete(knowledge: ProjectKnowledge): boolean {
  return knowledge.analysis.status === 'complete';
}

export function hasPartialAnalysis(knowledge: ProjectKnowledge): boolean {
  return knowledge.analysis.status === 'partial' || knowledge.analysis.status === 'complete';
}

export function getDocsRootPath(knowledge: ProjectKnowledge): string {
  return path.join(getProjectRoot(knowledge), getDocsDir(knowledge));
}
