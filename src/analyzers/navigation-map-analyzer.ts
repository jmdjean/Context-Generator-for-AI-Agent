import {
  NavigationEntry,
  NavigationMapKnowledge,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { NAVIGATION_RULES, buildNavigationEntry } from './navigation-map-builder';

export interface NavigationMapAnalysisResult {
  navigationMap: NavigationMapKnowledge;
  totalEntries: number;
  highConfidenceEntries: number;
  mediumConfidenceEntries: number;
  lowConfidenceEntries: number;
}

function countByConfidence(
  entries: NavigationEntry[],
  confidence: NavigationEntry['confidence'],
): number {
  return entries.filter((entry) => entry.confidence === confidence).length;
}

export function buildNavigationMap(knowledge: ProjectKnowledge): NavigationMapAnalysisResult {
  const entries = NAVIGATION_RULES.map((rule) => buildNavigationEntry(rule, knowledge));

  const navigationMap: NavigationMapKnowledge = {
    entries,
    generatedAt: knowledge.metadata.generatedAt,
  };

  return {
    navigationMap,
    totalEntries: entries.length,
    highConfidenceEntries: countByConfidence(entries, 'high'),
    mediumConfidenceEntries: countByConfidence(entries, 'medium'),
    lowConfidenceEntries: countByConfidence(entries, 'low'),
  };
}

export function enrichProjectKnowledgeWithNavigationMap(
  knowledge: ProjectKnowledge,
): { knowledge: ProjectKnowledge; result: NavigationMapAnalysisResult } {
  const result = buildNavigationMap(knowledge);
  const hasEntries = result.navigationMap.entries.length > 0;

  return {
    knowledge: {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        status:
          hasEntries || knowledge.analysis.status === 'partial'
            ? 'partial'
            : knowledge.analysis.status,
        navigationMap: hasEntries ? result.navigationMap : undefined,
      },
    },
    result,
  };
}
