export type PipelineStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface AnalysisPipelineStep {
  name: string;
  description: string;
  input: string;
  output: string;
  status: PipelineStepStatus;
}

export const ANALYSIS_PIPELINE: AnalysisPipelineStep[] = [
  {
    name: 'Resolve Configuration',
    description:
      'Parse CLI flags and environment variables into a validated configuration object. Fail fast if required inputs are missing or invalid.',
    input: 'process.argv, process.env',
    output: 'RuntimeConfig',
    status: 'pending',
  },
  {
    name: 'Load Repository Metadata',
    description:
      'Read basic repository information from the target directory: project name, package manager, and the presence of well-known configuration files.',
    input: 'RuntimeConfig.targetProjectPath',
    output: 'RepositoryInfo',
    status: 'pending',
  },
  {
    name: 'Scan Repository Structure',
    description:
      'Walk the directory tree up to a safe depth limit, respecting .gitignore patterns. Build a RepositoryNode tree representing every file and folder.',
    input: 'RepositoryInfo',
    output: 'RepositoryNode (tree)',
    status: 'pending',
  },
  {
    name: 'Detect Technologies',
    description:
      'Infer programming languages, frameworks, package managers, and tooling from the repository tree and key configuration files. Assign a confidence level to the detection.',
    input: 'RepositoryNode (tree), RepositoryInfo',
    output: 'TechnologyProfile',
    status: 'pending',
  },
  {
    name: 'Build Repository Model',
    description:
      'Assemble repository tree and profile data into a ProjectContext for AI analysis. Generators consume ProjectKnowledge instead; this step remains for the future AI stage.',
    input: 'RepositoryInfo, RepositoryNode (tree), TechnologyProfile',
    output: 'ProjectContext',
    status: 'pending',
  },
  {
    name: 'Analyze Architecture',
    description:
      'Use the AI provider to identify modules, architectural patterns, coding conventions, risks, and actionable recommendations. Future: enrich ProjectKnowledge.analysis.',
    input: 'ProjectKnowledge',
    output: 'AnalysisResult',
    status: 'pending',
  },
  {
    name: 'Generate Documentation Plan',
    description:
      'Determine which documentation files to create and what each document is for. Produces a DocumentationPlan without writing any files yet.',
    input: 'RepositoryInfo, TechnologyProfile',
    output: 'DocumentationPlan',
    status: 'pending',
  },
  {
    name: 'Build Project Knowledge',
    description:
      'Assemble all gathered data into the Project Knowledge Model (PKM). This is the single source of truth consumed by all downstream generators.',
    input: 'RepositoryInfo, TechnologyProfile, DocumentationPlan',
    output: 'ProjectKnowledge',
    status: 'pending',
  },
  {
    name: 'Analyze Folder Knowledge',
    description:
      'Walk the repository tree from PKM and produce deterministic folder-level knowledge: classification, responsibilities, important files, and child folders. Enriches ProjectKnowledge.analysis.folderContexts.',
    input: 'ProjectKnowledge',
    output: 'FolderKnowledge[]',
    status: 'pending',
  },
  {
    name: 'Analyze Modules',
    description:
      'Detect meaningful project modules from the repository tree and folder knowledge using deterministic structural heuristics. Enriches ProjectKnowledge.analysis.modules.',
    input: 'ProjectKnowledge',
    output: 'ModuleKnowledge[]',
    status: 'pending',
  },
  {
    name: 'Analyze Dependency Graph',
    description:
      'Detect import relationships between discovered modules using lightweight file import parsing. Enriches ProjectKnowledge.analysis.dependencyGraph.',
    input: 'ProjectKnowledge',
    output: 'DependencyGraphKnowledge',
    status: 'pending',
  },
  {
    name: 'Write Documentation',
    description:
      'Render deterministic Markdown for each planned document and write it into the .ai-docs/ folder inside the target repository. Only overwrite tool-managed files marked as safe to update.',
    input: 'ProjectKnowledge',
    output: '.ai-docs/ directory contents',
    status: 'pending',
  },
  {
    name: 'Validate Documentation',
    description:
      'Verify that all planned documentation sections were written and that each file can be parsed. Surface any missing or malformed sections.',
    input: 'DocumentModel[], written file paths',
    output: 'Validation report',
    status: 'pending',
  },
  {
    name: 'Persist Project Knowledge',
    description:
      'Write the Project Knowledge Model to disk as machine-readable JSON. Produces a full snapshot and split section files under .ai-docs/knowledge/.',
    input: 'ProjectKnowledge',
    output: '.ai-docs/knowledge/*.json',
    status: 'pending',
  },
];
