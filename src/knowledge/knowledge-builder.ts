import { RepositoryInfo, TechnologyProfile } from '../domain';
import { DocumentationPlan } from '../domain/documentation-plan';
import { GENERATOR_VERSION, PROJECT_KNOWLEDGE_SCHEMA_VERSION } from './constants';
import {
  AnalysisKnowledge,
  DocumentationKnowledge,
  KnowledgeMetadata,
  ProjectKnowledge,
  RepositoryKnowledge,
  TechnologyKnowledge,
} from './project-knowledge';

export interface KnowledgeBuilderInput {
  repositoryInfo: RepositoryInfo;
  technologyProfile: TechnologyProfile;
  documentationPlan: DocumentationPlan;
  generatorVersion?: string;
  generatedAt?: string;
}

export function mapRepositoryKnowledge(repositoryInfo: RepositoryInfo): RepositoryKnowledge {
  const knowledge: RepositoryKnowledge = {
    name: repositoryInfo.name,
    rootPath: repositoryInfo.rootPath,
    packageManager: repositoryInfo.packageManager,
    detectedFiles: [...repositoryInfo.detectedFiles],
    ignoredPaths: [...repositoryInfo.ignoredPaths],
  };

  if (repositoryInfo.repositoryTree !== undefined) {
    knowledge.repositoryTree = repositoryInfo.repositoryTree;
  }

  return knowledge;
}

export function mapTechnologyKnowledge(technologyProfile: TechnologyProfile): TechnologyKnowledge {
  return {
    languages: [...technologyProfile.languages],
    frameworks: [...technologyProfile.frameworks],
    packageManagers: [...technologyProfile.packageManagers],
    tooling: [...technologyProfile.tooling],
    confidence: technologyProfile.confidence,
  };
}

export function mapDocumentationKnowledge(documentationPlan: DocumentationPlan): DocumentationKnowledge {
  return {
    plan: {
      ...documentationPlan,
      documents: documentationPlan.documents.map((document) => ({ ...document })),
    },
  };
}

export function createPendingAnalysisKnowledge(): AnalysisKnowledge {
  return { status: 'pending' };
}

function buildMetadata(
  repositoryInfo: RepositoryInfo,
  documentationPlan: DocumentationPlan,
  generatedAt: string,
  generatorVersion: string,
): KnowledgeMetadata {
  return {
    schemaVersion: PROJECT_KNOWLEDGE_SCHEMA_VERSION,
    generatedAt,
    generatorVersion,
    projectName: repositoryInfo.name,
    docsDir: documentationPlan.docsDir,
  };
}

export function buildProjectKnowledge(input: KnowledgeBuilderInput): ProjectKnowledge {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const generatorVersion = input.generatorVersion ?? GENERATOR_VERSION;

  return {
    metadata: buildMetadata(
      input.repositoryInfo,
      input.documentationPlan,
      generatedAt,
      generatorVersion,
    ),
    repository: mapRepositoryKnowledge(input.repositoryInfo),
    technologies: mapTechnologyKnowledge(input.technologyProfile),
    documentation: mapDocumentationKnowledge(input.documentationPlan),
    analysis: createPendingAnalysisKnowledge(),
  };
}
