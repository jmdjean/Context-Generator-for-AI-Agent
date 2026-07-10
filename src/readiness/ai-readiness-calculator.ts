import { DocumentationValidationResult } from '../docs/documentation-validator';
import { ProjectKnowledge } from '../knowledge/project-knowledge';
import {
  AIReadinessCategory,
  AIReadinessFinding,
  AIReadinessGap,
  AIReadinessKnowledge,
  AIReadinessRecommendation,
  clampReadinessScore,
  resolveReadinessLevel,
  roundReadinessScore,
} from './ai-readiness-model';
import {
  AI_READINESS_SCORING_VERSION,
  READINESS_CATEGORY_RULES,
  ReadinessCategoryRule,
  ReadinessFindingEvaluation,
  ReadinessRuleInput,
  deriveRepositorySignals,
  totalCategoryWeight,
} from './ai-readiness-rules';

const MAX_STRENGTHS = 5;
const MAX_GAPS = 5;
const MAX_RECOMMENDATIONS = 7;

export interface AiReadinessCalculationInput {
  knowledge: ProjectKnowledge;
  validation?: DocumentationValidationResult;
}

interface EvaluatedFinding {
  categoryId: string;
  categoryWeight: number;
  finding: AIReadinessFinding;
  recommendedAction?: string;
}

function scoreCategory(findings: AIReadinessFinding[]): number {
  const applicable = findings.filter((finding) => finding.status !== 'not-applicable');

  // A category where nothing applies (for example an empty repository) is
  // neutral: the repository is not penalized for checks that cannot run.
  if (applicable.length === 0) {
    return 100;
  }

  const earned = applicable.reduce((sum, finding) => sum + finding.points, 0);
  const possible = applicable.reduce((sum, finding) => sum + finding.maxPoints, 0);

  if (possible <= 0) {
    return 100;
  }

  return roundReadinessScore((earned / possible) * 100);
}

function buildCategory(
  rule: ReadinessCategoryRule,
  evaluations: ReadinessFindingEvaluation[],
): AIReadinessCategory {
  const findings = evaluations.map((entry) => entry.finding);
  const recommendations = evaluations
    .filter(
      (entry) =>
        entry.recommendedAction !== undefined &&
        (entry.finding.status === 'failed' || entry.finding.status === 'partial'),
    )
    .map((entry) => entry.recommendedAction as string);

  return {
    id: rule.id,
    name: rule.name,
    score: scoreCategory(findings),
    weight: rule.weight,
    findings,
    recommendations: [...new Set(recommendations)],
  };
}

function weightedImpact(finding: AIReadinessFinding, categoryWeight: number): number {
  return (finding.maxPoints - finding.points) * categoryWeight;
}

function buildStrengths(evaluated: EvaluatedFinding[]): string[] {
  return evaluated
    .filter((entry) => entry.finding.status === 'passed')
    .sort(
      (left, right) =>
        right.finding.maxPoints * right.categoryWeight -
          left.finding.maxPoints * left.categoryWeight ||
        left.finding.id.localeCompare(right.finding.id),
    )
    .slice(0, MAX_STRENGTHS)
    .map((entry) => entry.finding.description);
}

function buildGaps(evaluated: EvaluatedFinding[]): AIReadinessGap[] {
  return evaluated
    .filter(
      (entry) => entry.finding.status === 'failed' || entry.finding.status === 'partial',
    )
    .sort(
      (left, right) =>
        weightedImpact(right.finding, right.categoryWeight) -
          weightedImpact(left.finding, left.categoryWeight) ||
        left.finding.id.localeCompare(right.finding.id),
    )
    .slice(0, MAX_GAPS)
    .map((entry) => ({
      findingId: entry.finding.id,
      categoryId: entry.categoryId,
      description: entry.finding.description,
      severity: entry.finding.status === 'failed' ? ('critical' as const) : ('moderate' as const),
      pointsLost: entry.finding.maxPoints - entry.finding.points,
    }));
}

function buildRecommendations(evaluated: EvaluatedFinding[]): AIReadinessRecommendation[] {
  const seenActions = new Set<string>();
  const recommendations: AIReadinessRecommendation[] = [];

  const candidates = evaluated
    .filter(
      (entry) =>
        entry.recommendedAction !== undefined &&
        (entry.finding.status === 'failed' || entry.finding.status === 'partial'),
    )
    .sort(
      (left, right) =>
        weightedImpact(right.finding, right.categoryWeight) -
          weightedImpact(left.finding, left.categoryWeight) ||
        left.finding.id.localeCompare(right.finding.id),
    );

  for (const entry of candidates) {
    const action = entry.recommendedAction as string;
    if (seenActions.has(action)) {
      continue;
    }
    seenActions.add(action);
    recommendations.push({
      action,
      findingId: entry.finding.id,
      categoryId: entry.categoryId,
      impact: Math.round(weightedImpact(entry.finding, entry.categoryWeight)),
    });
    if (recommendations.length >= MAX_RECOMMENDATIONS) {
      break;
    }
  }

  return recommendations;
}

export function calculateAiReadiness(
  input: AiReadinessCalculationInput,
): AIReadinessKnowledge {
  const ruleInput: ReadinessRuleInput = {
    knowledge: input.knowledge,
    validation: input.validation,
    signals: deriveRepositorySignals(input.knowledge),
  };

  const categories: AIReadinessCategory[] = [];
  const evaluated: EvaluatedFinding[] = [];

  for (const rule of READINESS_CATEGORY_RULES) {
    const evaluations = rule.buildFindings(ruleInput);
    categories.push(buildCategory(rule, evaluations));

    for (const entry of evaluations) {
      evaluated.push({
        categoryId: rule.id,
        categoryWeight: rule.weight,
        finding: entry.finding,
        recommendedAction: entry.recommendedAction,
      });
    }
  }

  const weightTotal = totalCategoryWeight();
  const weightedSum = categories.reduce(
    (sum, category) => sum + clampReadinessScore(category.score) * category.weight,
    0,
  );
  const overallScore = roundReadinessScore(weightTotal > 0 ? weightedSum / weightTotal : 0);

  return {
    overallScore,
    level: resolveReadinessLevel(overallScore),
    categories,
    strengths: buildStrengths(evaluated),
    gaps: buildGaps(evaluated),
    recommendations: buildRecommendations(evaluated),
    // Anchor the timestamp to the PKM snapshot so identical PKM input always
    // produces byte-identical readiness output.
    calculatedAt: input.knowledge.metadata.generatedAt,
    scoringVersion: AI_READINESS_SCORING_VERSION,
  };
}

export interface AiReadinessEnrichmentResult {
  knowledge: ProjectKnowledge;
  readiness: AIReadinessKnowledge;
}

export function enrichProjectKnowledgeWithAiReadiness(
  knowledge: ProjectKnowledge,
  validation?: DocumentationValidationResult,
): AiReadinessEnrichmentResult {
  const readiness = calculateAiReadiness({ knowledge, validation });

  return {
    knowledge: {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        aiReadiness: readiness,
      },
    },
    readiness,
  };
}
