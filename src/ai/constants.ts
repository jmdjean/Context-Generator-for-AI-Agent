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
  maxAsciiDiagramLength: 1_500,
  maxPurposeLength: 800,
  maxItemLength: 500,
} as const;

/**
 * Legacy insights shape kept for `aiInsights` consumers. Architecture stage
 * uses {@link ARCHITECTURE_STAGE_JSON_SCHEMA} and still maps these fields.
 */
export const AI_RESPONSE_JSON_SCHEMA = {
  architectureSummary: 'string (2-4 sentences)',
  risks: 'string[]',
  recommendations: 'string[]',
  agentGuidance: 'string[]',
} as const;

/**
 * Stack-agnostic architecture orientation fields. Prefer omitting empty arrays
 * over inventing env keys, scripts, or frameworks not present in the PKM.
 */
export const ARCHITECTURE_STAGE_JSON_SCHEMA = {
  architectureSummary: 'string (2-4 sentences) — preferred summary for content consumers',
  purpose: 'string — repo/product purpose grounded in operationalContext or modules',
  layers: 'string[] — architectural layers visible in the PKM',
  asciiDiagram: 'string — optional compact ASCII diagram; omit if not grounded',
  keyConstraints: 'string[] — hard agent/repo constraints visible in the summary',
  envVars: 'string[] — env keys only from operationalContext; omit if none',
  runCommands: 'string[] — run/task commands from operationalContext; omit if none',
  risks: 'string[]',
  recommendations: 'string[]',
  agentGuidance: 'string[]',
} as const;

export const CAPABILITY_MAP_LIMITS = {
  maxFeatures: 8,
  maxDomains: 8,
  maxIntegrations: 8,
  maxEntryPaths: 5,
  maxRelatedModules: 5,
  maxNameLength: 80,
  maxSummaryLength: 300,
} as const;

export const ROUTER_LIMITS = {
  maxRoutes: 12,
  maxReadingPathItems: 8,
  maxTaskTypeLength: 80,
  maxSummaryLength: 300,
} as const;

/**
 * Capability-map JSON schema used in prompts.
 * Items are capped per CAPABILITY_MAP_LIMITS — prefer concrete entryPaths/relatedModules.
 */
export const CAPABILITY_MAP_JSON_SCHEMA = {
  features: 'Array<{ name: string; summary: string; entryPaths: string[]; relatedModules: string[] }>',
  domains: 'Array<{ name: string; summary: string; entryPaths: string[]; relatedModules: string[] }>',
  integrations: 'Array<{ name: string; summary: string; entryPaths: string[]; relatedModules: string[] }>',
} as const;

/**
 * Router JSON schema used in prompts.
 * readingPath items are real planned doc paths derived from the PKM module list.
 */
export const ROUTER_JSON_SCHEMA = {
  routes: 'Array<{ taskType: string; summary: string; readingPath: string[] }>',
} as const;

export const MODULE_DOCUMENTATION_LIMITS = {
  maxArrayItems: 6,
  maxSummaryLength: 1_000,
  maxItemLength: 400,
  maxContentLength: 4_000,
  maxArchitectureContextChars: 2_500,
} as const;

export const MODULE_DOCUMENTATION_JSON_SCHEMA = {
  summary: 'string (1-3 sentences about this module)',
  purpose: 'string',
  entryPoints: 'string[] (relative paths or symbols known from PKM)',
  keyBehaviors: 'string[]',
  dependencies: 'string[] (module paths or packages known from PKM)',
  outOfScope: 'string[]',
  agentGuidance: 'string[]',
} as const;

export const DEFAULT_OPENROUTER_TIMEOUT_MS = 120_000;
export const MAX_AI_PROMPT_CHARS = 28_000;
