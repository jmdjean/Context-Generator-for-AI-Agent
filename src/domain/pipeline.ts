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
      'Legacy placeholder. Optional AI enrichment now runs at Analyze AI Insights after deterministic analyzers enrich the PKM.',
    input: 'ProjectContext',
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
    name: 'Analyze Conventions',
    description:
      'Detect project conventions deterministically from the PKM, repository tree, technologies, module knowledge, and safe config file reads (tsconfig.json, package.json). Enriches ProjectKnowledge.analysis.conventions.',
    input: 'ProjectKnowledge',
    output: 'ConventionKnowledge[]',
    status: 'pending',
  },
  {
    name: 'Build AI Navigation Map',
    description:
      'Build a deterministic navigation map that tells AI agents which knowledge sections and documentation files to read before common task types. Enriches ProjectKnowledge.analysis.navigationMap.',
    input: 'ProjectKnowledge',
    output: 'NavigationMapKnowledge',
    status: 'pending',
  },
  {
    name: 'Analyze AI Insights',
    description:
      'Optionally call OpenRouter with a compact PKM summary to produce non-authoritative architecture insights. Enriches ProjectKnowledge.analysis.aiInsights when --ai is set and an API key is available.',
    input: 'ProjectKnowledge, RuntimeConfig (ai flags)',
    output: 'AiInsightsKnowledge',
    status: 'pending',
  },
  {
    name: 'Detect Changes',
    description:
      'Compare the current Project Knowledge Model against the previously persisted snapshot. Records a deterministic ChangeSummary and DocumentImpactSummary for selective documentation regeneration.',
    input: 'ProjectKnowledge, previous .ai-docs/knowledge/project-knowledge.json',
    output: 'ChangeSummary and DocumentImpactSummary in analysis',
    status: 'pending',
  },
  {
    name: 'Write Documentation',
    description:
      'Render deterministic Markdown for each planned document and write it into the .ai-docs/ folder inside the target repository. Uses DocumentImpactSummary to regenerate only impacted tool-managed files when available.',
    input: 'ProjectKnowledge, DocumentImpactSummary (optional)',
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
    name: 'Export Agent Context',
    description:
      'Optionally run agent-specific exporters that translate the PKM into portable context files for AI coding agents. Runs only when --export-agents is set. Enriches analysis.agentExports.',
    input: 'ProjectKnowledge, RuntimeConfig (export flags)',
    output: 'Agent export files and AgentExportsKnowledge',
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
