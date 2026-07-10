import { ProjectKnowledge } from '../knowledge';
import {
  AI_RESPONSE_JSON_SCHEMA,
  MAX_AI_PROMPT_CHARS,
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

export function buildAiAnalysisPrompt(knowledge: ProjectKnowledge): string {
  let selectedPrompt = assemblePrompt(buildPkmSummaryPayload(knowledge));

  for (const limits of PROMPT_LIMIT_PROFILES.slice(1)) {
    if (selectedPrompt.length <= MAX_AI_PROMPT_CHARS) {
      break;
    }
    selectedPrompt = assemblePrompt(buildPkmSummaryPayload(knowledge, limits));
  }

  return selectedPrompt;
}
