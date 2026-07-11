import {
  ModuleDocumentationPlanEntry,
  ModuleKnowledge,
  ProjectKnowledge,
} from '../knowledge';
import {
  AI_RESPONSE_JSON_SCHEMA,
  MAX_AI_PROMPT_CHARS,
  MODULE_DOCUMENTATION_JSON_SCHEMA,
  MODULE_DOCUMENTATION_LIMITS,
  PKM_SUMMARY_COMPACT_LIMITS,
  PKM_SUMMARY_LIMITS,
} from './constants';

/**
 * System-level instruction sent alongside the analysis prompt. Lives here so
 * the prompt builder owns every string sent to AI providers; providers only
 * translate these strings into their transport format.
 */
export const AI_ANALYSIS_SYSTEM_INSTRUCTION =
  'You enrich a deterministic project knowledge model. Output a single JSON object. Never request secrets or source code.';

/**
 * Architecture-stage system instruction. Providers remain transport-only; this
 * string is owned by the prompt builder with the rest of the prompt surface.
 */
export const ARCHITECTURE_STAGE_SYSTEM_INSTRUCTION =
  'You generate architecture documentation context from a deterministic project knowledge model. Output a single JSON object. Never request secrets or source code. Mark conclusions as enrichment, not ground truth.';

/**
 * Per-module documentation system instruction. Providers remain transport-only.
 */
export const MODULE_DOCUMENTATION_SYSTEM_INSTRUCTION =
  'You generate documentation for one software module from deterministic PKM facts and prior staged architecture context. Output a single JSON object. Never request secrets or source code. Mark conclusions as enrichment, not ground truth.';

type ConfidenceRank = 'high' | 'medium' | 'low';

type SummaryLimits = {
  modules: number;
  folders: number;
  conventions: number;
  navigationEntries: number;
  dependencyEdges: number;
};

const CONFIDENCE_RANK: Record<ConfidenceRank, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const PROMPT_LIMIT_PROFILES: ReadonlyArray<SummaryLimits> = [
  PKM_SUMMARY_LIMITS,
  PKM_SUMMARY_COMPACT_LIMITS,
  {
    modules: 5,
    folders: 5,
    conventions: 4,
    navigationEntries: 2,
    dependencyEdges: 4,
  },
];

function prioritizeByConfidence<T extends { confidence: string }>(
  items: readonly T[],
  limit: number,
): T[] {
  return [...items]
    .sort(
      (left, right) =>
        (CONFIDENCE_RANK[left.confidence as ConfidenceRank] ?? 3) -
        (CONFIDENCE_RANK[right.confidence as ConfidenceRank] ?? 3),
    )
    .slice(0, limit);
}

function buildTruncationMeta(total: number, included: number): { total: number; included: number } {
  return { total, included };
}

export interface PkmSummaryPayload {
  projectName: string;
  analysisStatus: string;
  technologies: {
    languages: string[];
    frameworks: string[];
    packageManagers: string[];
    tooling: string[];
    confidence: string;
  };
  modules: Array<{
    name: string;
    relativePath: string;
    type: string;
    responsibility: string;
    confidence: string;
  }>;
  folders: Array<{
    relativePath: string;
    classification: string;
    responsibility: string;
    confidence: string;
  }>;
  dependencyGraph: {
    nodeCount: number;
    edgeCount: number;
    highConfidenceEdges: Array<{ from: string; to: string; type: string }>;
  };
  conventions: Array<{
    category: string;
    name: string;
    description: string;
    confidence: string;
  }>;
  navigationMap: Array<{
    taskType: string;
    description: string;
    recommendedKnowledge: string[];
    recommendedDocuments: string[];
    confidence: string;
  }>;
  truncation: {
    modules: { total: number; included: number };
    folders: { total: number; included: number };
    conventions: { total: number; included: number };
    navigationMap: { total: number; included: number };
    dependencyEdges: { total: number; included: number };
  };
}

export function buildPkmSummaryPayload(
  knowledge: ProjectKnowledge,
  limits: SummaryLimits = PKM_SUMMARY_LIMITS,
): PkmSummaryPayload {
  const { analysis, technologies, metadata } = knowledge;
  const graph = analysis.dependencyGraph;
  const allModules = analysis.modules ?? [];
  const allFolders = analysis.folderContexts ?? [];
  const allConventions = analysis.conventions ?? [];
  const allNavigationEntries = analysis.navigationMap?.entries ?? [];
  const highConfidenceEdges = (graph?.edges ?? []).filter((edge) => edge.confidence === 'high');

  const modules = prioritizeByConfidence(allModules, limits.modules);
  const folders = prioritizeByConfidence(allFolders, limits.folders);
  const conventions = prioritizeByConfidence(allConventions, limits.conventions);
  const navigationMap = prioritizeByConfidence(allNavigationEntries, limits.navigationEntries);
  const dependencyEdges = highConfidenceEdges.slice(0, limits.dependencyEdges);

  return {
    projectName: metadata.projectName,
    analysisStatus: analysis.status,
    technologies: {
      languages: technologies.languages,
      frameworks: technologies.frameworks,
      packageManagers: technologies.packageManagers,
      tooling: technologies.tooling,
      confidence: technologies.confidence,
    },
    modules: modules.map((module) => ({
      name: module.name,
      relativePath: module.relativePath,
      type: module.type,
      responsibility: module.responsibility,
      confidence: module.confidence,
    })),
    folders: folders.map((folder) => ({
      relativePath: folder.relativePath,
      classification: folder.classification,
      responsibility: folder.responsibility,
      confidence: folder.confidence,
    })),
    dependencyGraph: {
      nodeCount: graph?.nodes.length ?? 0,
      edgeCount: graph?.edges.length ?? 0,
      highConfidenceEdges: dependencyEdges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        type: edge.type,
      })),
    },
    conventions: conventions.map((convention) => ({
      category: convention.category,
      name: convention.name,
      description: convention.description,
      confidence: convention.confidence,
    })),
    navigationMap: navigationMap.map((entry) => ({
      taskType: entry.taskType,
      description: entry.description,
      recommendedKnowledge: entry.recommendedKnowledge,
      recommendedDocuments: entry.recommendedDocuments,
      confidence: entry.confidence,
    })),
    truncation: {
      modules: buildTruncationMeta(allModules.length, modules.length),
      folders: buildTruncationMeta(allFolders.length, folders.length),
      conventions: buildTruncationMeta(allConventions.length, conventions.length),
      navigationMap: buildTruncationMeta(allNavigationEntries.length, navigationMap.length),
      dependencyEdges: buildTruncationMeta(
        highConfidenceEdges.length,
        dependencyEdges.length,
      ),
    },
  };
}

function assemblePrompt(summary: PkmSummaryPayload): string {
  return [
    'You are a senior software architect reviewing a compact Project Knowledge Model (PKM) summary.',
    'The summary was produced by deterministic repository analysis. You do not have source code access.',
    'Respond with valid JSON only. No markdown fences, comments, or prose outside the JSON object.',
    '',
    'Required JSON shape:',
    JSON.stringify(AI_RESPONSE_JSON_SCHEMA, null, 2),
    '',
    'Rules:',
    '- Base conclusions only on the PKM summary below.',
    '- Do not invent files, modules, or technologies that are not listed.',
    '- Respect truncation metadata: omitted items may exist but were not sent.',
    '- Keep each array to at most 5 concise items.',
    '- agentGuidance must help AI coding agents work safely in this repository.',
    '- risks should highlight structural, dependency, or convention concerns visible in the summary.',
    '',
    'PKM summary (JSON):',
    JSON.stringify(summary),
  ].join('\n');
}

function assembleArchitectureStagePrompt(summary: PkmSummaryPayload): string {
  return [
    'You are generating architecture-stage documentation context for AI coding agents.',
    'The input is a compact Project Knowledge Model (PKM) summary from deterministic analysis.',
    'You do not have source code access. Treat your output as enrichment, not authoritative truth.',
    'Respond with valid JSON only. No markdown fences, comments, or prose outside the JSON object.',
    '',
    'Required JSON shape:',
    JSON.stringify(AI_RESPONSE_JSON_SCHEMA, null, 2),
    '',
    'Rules:',
    '- architectureSummary: 2-4 sentences describing layers, module boundaries, and how the pipeline fits together.',
    '- Base conclusions only on the PKM summary below.',
    '- Do not invent files, modules, or technologies that are not listed.',
    '- Respect truncation metadata: omitted items may exist but were not sent.',
    '- Keep each array to at most 5 concise items.',
    '- agentGuidance must tell agents which docs/PKM sections to load before architecture changes.',
    '- risks should highlight structural, dependency, or convention concerns visible in the summary.',
    '',
    'PKM summary (JSON):',
    JSON.stringify(summary),
  ].join('\n');
}

function buildPromptWithLimitProfiles(
  knowledge: ProjectKnowledge,
  assemble: (summary: PkmSummaryPayload) => string,
): string {
  let selectedPrompt = assemble(buildPkmSummaryPayload(knowledge));

  for (const limits of PROMPT_LIMIT_PROFILES.slice(1)) {
    if (selectedPrompt.length <= MAX_AI_PROMPT_CHARS) {
      break;
    }
    selectedPrompt = assemble(buildPkmSummaryPayload(knowledge, limits));
  }

  return selectedPrompt;
}

export function buildAiAnalysisPrompt(knowledge: ProjectKnowledge): string {
  return buildPromptWithLimitProfiles(knowledge, assemblePrompt);
}

export function buildArchitectureStagePrompt(knowledge: ProjectKnowledge): string {
  return buildPromptWithLimitProfiles(knowledge, assembleArchitectureStagePrompt);
}

function truncateArchitectureContext(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MODULE_DOCUMENTATION_LIMITS.maxArchitectureContextChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, MODULE_DOCUMENTATION_LIMITS.maxArchitectureContextChars - 1)}…`;
}

function collectRelatedDependencyEdges(
  knowledge: ProjectKnowledge,
  moduleRelativePath: string,
): Array<{ from: string; to: string; type: string }> {
  const edges = knowledge.analysis.dependencyGraph?.edges ?? [];
  return edges
    .filter((edge) => edge.from === moduleRelativePath || edge.to === moduleRelativePath)
    .slice(0, 8)
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      type: edge.type,
    }));
}

export interface ModuleDocumentationPromptInput {
  entry: ModuleDocumentationPlanEntry;
  module?: ModuleKnowledge;
}

function assembleModuleDocumentationPrompt(
  knowledge: ProjectKnowledge,
  input: ModuleDocumentationPromptInput,
): string {
  const architecture = knowledge.analysis.stagedDocumentation?.architecture;
  const architectureContext =
    architecture?.content ??
    architecture?.summary ??
    knowledge.analysis.aiInsights?.architectureSummary ??
    '';

  const modulePayload = input.module
    ? {
        name: input.module.name,
        relativePath: input.module.relativePath,
        type: input.module.type,
        responsibility: input.module.responsibility,
        confidence: input.module.confidence,
        importantFiles: input.module.importantFiles.slice(0, 8),
        relatedFolders: input.module.relatedFolders.slice(0, 8),
        signals: input.module.signals.slice(0, 8),
      }
    : {
        name: input.entry.moduleName,
        relativePath: input.entry.moduleRelativePath,
        type: 'unknown',
        responsibility: input.entry.rationale ?? 'Unknown — module knowledge missing',
        confidence: 'low',
        importantFiles: [] as string[],
        relatedFolders: [] as string[],
        signals: [] as string[],
      };

  const payload = {
    projectName: knowledge.metadata.projectName,
    technologies: {
      languages: knowledge.technologies.languages,
      frameworks: knowledge.technologies.frameworks,
      packageManagers: knowledge.technologies.packageManagers,
      confidence: knowledge.technologies.confidence,
    },
    architectureContext: truncateArchitectureContext(architectureContext),
    architectureStatus: architecture?.status ?? 'pending',
    planEntry: {
      moduleId: input.entry.moduleId,
      moduleName: input.entry.moduleName,
      moduleRelativePath: input.entry.moduleRelativePath,
      documentPath: input.entry.documentPath,
      order: input.entry.order,
      rationale: input.entry.rationale,
    },
    module: modulePayload,
    relatedDependencyEdges: collectRelatedDependencyEdges(
      knowledge,
      input.entry.moduleRelativePath,
    ),
  };

  return [
    'You are documenting a single module for AI coding agents.',
    'Inputs come from the Project Knowledge Model (PKM) and prior staged architecture output — not from source files.',
    'Treat your output as enrichment. Deterministic module facts remain authoritative.',
    'Respond with valid JSON only. No markdown fences, comments, or prose outside the JSON object.',
    '',
    'Required JSON shape:',
    JSON.stringify(MODULE_DOCUMENTATION_JSON_SCHEMA, null, 2),
    '',
    'Rules:',
    `- Document only the target module ${input.entry.moduleRelativePath}.`,
    '- Base conclusions only on the JSON context below.',
    '- Do not invent files, modules, dependencies, or frameworks that are not listed.',
    '- Prefer concrete relative paths from the module facts and dependency edges.',
    '- Keep each array to at most 6 concise items.',
    '- If architectureContext is empty, say so briefly in summary and avoid inventing architecture.',
    '',
    'Module documentation context (JSON):',
    JSON.stringify(payload),
  ].join('\n');
}

/**
 * Build a compact per-module prompt from PKM module knowledge plus staged
 * architecture context. Does not read the filesystem.
 */
export function buildModuleDocumentationPrompt(
  knowledge: ProjectKnowledge,
  input: ModuleDocumentationPromptInput,
): string {
  const prompt = assembleModuleDocumentationPrompt(knowledge, input);
  if (prompt.length <= MAX_AI_PROMPT_CHARS) {
    return prompt;
  }

  const compactArchitecture = knowledge.analysis.stagedDocumentation?.architecture?.summary ?? '';
  const compactKnowledge: ProjectKnowledge = {
    ...knowledge,
    analysis: {
      ...knowledge.analysis,
      stagedDocumentation: knowledge.analysis.stagedDocumentation
        ? {
            ...knowledge.analysis.stagedDocumentation,
            architecture: knowledge.analysis.stagedDocumentation.architecture
              ? {
                  ...knowledge.analysis.stagedDocumentation.architecture,
                  content: truncateArchitectureContext(compactArchitecture),
                  summary: compactArchitecture || undefined,
                }
              : undefined,
          }
        : undefined,
    },
  };

  return assembleModuleDocumentationPrompt(compactKnowledge, input);
}
