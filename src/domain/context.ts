import { RepositoryInfo, RepositoryNode } from './repository';
import { TechnologyProfile } from './technology';
import { AnalysisResult } from './analysis';

export interface ProjectContext {
  rootPath: string;
  docsDir: string;
  repository: RepositoryInfo;
  repositoryTree?: RepositoryNode;
  technologyProfile?: TechnologyProfile;
  analysis?: AnalysisResult;
}
