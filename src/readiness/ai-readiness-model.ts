/**
 * Deterministic AI Readiness model.
 *
 * This module is a pure leaf: it declares the readiness knowledge shape and the
 * deterministic score/level helpers. It must never import from the PKM, the
 * scanner, or any AI provider so that `src/knowledge` can safely reference these
 * types without creating a cycle.
 */

export const AI_READINESS_DOCUMENT_PATH = 'ai-readiness.md';

export type AIReadinessLevel = 'critical' | 'low' | 'moderate' | 'good' | 'excellent';

export type AIReadinessFindingStatus = 'passed' | 'partial' | 'failed' | 'not-applicable';

export interface AIReadinessFinding {
  id: string;
  status: AIReadinessFindingStatus;
  description: string;
  evidence: string[];
  points: number;
  maxPoints: number;
}

export interface AIReadinessCategory {
  id: string;
  name: string;
  score: number;
  weight: number;
  findings: AIReadinessFinding[];
  recommendations: string[];
}

export type AIReadinessGapSeverity = 'critical' | 'moderate';

export interface AIReadinessGap {
  findingId: string;
  categoryId: string;
  description: string;
  severity: AIReadinessGapSeverity;
  pointsLost: number;
}

export interface AIReadinessRecommendation {
  action: string;
  findingId: string;
  categoryId: string;
  impact: number;
}

export interface AIReadinessKnowledge {
  overallScore: number;
  level: AIReadinessLevel;
  categories: AIReadinessCategory[];
  strengths: string[];
  gaps: AIReadinessGap[];
  recommendations: AIReadinessRecommendation[];
  calculatedAt: string;
  scoringVersion: string;
}

export const MIN_READINESS_SCORE = 0;
export const MAX_READINESS_SCORE = 100;

export interface AIReadinessLevelBoundary {
  level: AIReadinessLevel;
  minScore: number;
  maxScore: number;
}

export const AI_READINESS_LEVEL_BOUNDARIES: ReadonlyArray<AIReadinessLevelBoundary> = [
  { level: 'critical', minScore: 0, maxScore: 29 },
  { level: 'low', minScore: 30, maxScore: 49 },
  { level: 'moderate', minScore: 50, maxScore: 69 },
  { level: 'good', minScore: 70, maxScore: 84 },
  { level: 'excellent', minScore: 85, maxScore: 100 },
];

export function clampReadinessScore(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_READINESS_SCORE;
  }
  if (value < MIN_READINESS_SCORE) {
    return MIN_READINESS_SCORE;
  }
  if (value > MAX_READINESS_SCORE) {
    return MAX_READINESS_SCORE;
  }
  return value;
}

export function roundReadinessScore(value: number): number {
  return Math.round(clampReadinessScore(value));
}

export function resolveReadinessLevel(score: number): AIReadinessLevel {
  const normalized = roundReadinessScore(score);

  for (const boundary of AI_READINESS_LEVEL_BOUNDARIES) {
    if (normalized >= boundary.minScore && normalized <= boundary.maxScore) {
      return boundary.level;
    }
  }

  return 'critical';
}
