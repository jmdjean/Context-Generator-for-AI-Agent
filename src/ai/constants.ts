export const PKM_SUMMARY_LIMITS = {
  modules: 20,
  folders: 20,
  conventions: 15,
  navigationEntries: 8,
  dependencyEdges: 15,
} as const;

export const PKM_SUMMARY_COMPACT_LIMITS = {
  modules: 10,
  folders: 10,
  conventions: 8,
  navigationEntries: 4,
  dependencyEdges: 8,
} as const;

export const AI_INSIGHTS_LIMITS = {
  maxArrayItems: 5,
  maxArchitectureSummaryLength: 2_000,
  maxItemLength: 500,
} as const;

export const AI_RESPONSE_JSON_SCHEMA = {
  architectureSummary: 'string (2-4 sentences)',
  risks: 'string[]',
  recommendations: 'string[]',
  agentGuidance: 'string[]',
} as const;

export const DEFAULT_OPENROUTER_TIMEOUT_MS = 120_000;
export const MAX_AI_PROMPT_CHARS = 28_000;
