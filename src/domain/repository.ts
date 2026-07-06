export type RepositoryNodeType = 'file' | 'directory';

export interface RepositoryNode {
  name: string;
  path: string;
  relativePath: string;
  type: RepositoryNodeType;
  children?: RepositoryNode[];
  extension?: string;
  sizeBytes?: number;
}

export interface RepositoryInfo {
  name: string;
  rootPath: string;
  packageManager?: string;
  detectedFiles: string[];
  ignoredPaths: string[];
}
