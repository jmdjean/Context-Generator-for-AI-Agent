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
      'Assemble all gathered data into a unified ProjectContext. This is the single input passed to all downstream stages.',
    input: 'RepositoryInfo, RepositoryNode (tree), TechnologyProfile',
    output: 'ProjectContext',
    status: 'pending',
  },
  {
    name: 'Analyze Architecture',
    description:
      'Use the AI provider to identify modules, architectural patterns, coding conventions, risks, and actionable recommendations from the repository model.',
    input: 'ProjectContext',
    output: 'AnalysisResult',
    status: 'pending',
  },
  {
    name: 'Generate Documentation Plan',
    description:
      'Determine which documentation files to create and what each section should contain. Produces a list of DocumentModels without writing any files yet.',
    input: 'ProjectContext, AnalysisResult',
    output: 'DocumentModel[]',
    status: 'pending',
  },
  {
    name: 'Write Documentation',
    description:
      'Render each DocumentModel to Markdown and write it into the .ai-docs/ folder inside the target repository. Only overwrite sections that have changed.',
    input: 'DocumentModel[], RuntimeConfig.docsDir',
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
    name: 'Save Incremental State',
    description:
      'Persist a snapshot of the current analysis so that future runs can skip unchanged sections and only regenerate what has actually changed in the repository.',
    input: 'ProjectContext, DocumentModel[]',
    output: 'Incremental state file (.ai-docs/.state.json)',
    status: 'pending',
  },
];
