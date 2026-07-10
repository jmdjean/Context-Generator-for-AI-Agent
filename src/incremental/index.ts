import {
  ChangeSummaryKnowledge,
  DocumentImpactSummaryKnowledge,
  getDocsDir,
  getDocumentationPlan,
  getProjectRoot,
  ProjectKnowledge,
} from '../knowledge';
import { detectChanges } from './change-detector';
import { formatChangeDetectionSummaryLine } from './change-summary-formatter';
import { ChangeSummary } from './change-summary';
import { analyzeDocumentImpact } from './document-impact-analyzer';
import { formatDocumentImpactSummaryLine } from './document-impact-formatter';
import { loadPreviousKnowledgeBaseline } from './state-loader';

export {
  type ChangeSection,
  type ChangeSummary,
  type DependencyEdgeChange,
} from './change-summary';
export { detectChanges } from './change-detector';
export {
  appendChangeSummaryDetailLines,
  formatChangeDetectionSummaryLine,
  formatRunSummaryChangeDetectionLines,
} from './change-summary-formatter';
export {
  formatDocumentImpactSummaryLine,
  formatRunSummaryDocumentImpactLines,
} from './document-impact-formatter';
export {
  loadPreviousKnowledgeBaseline,
  type PreviousKnowledgeBaseline,
} from './state-loader';
export {
  analyzeDocumentImpact,
  isUnreadableBaseline,
  requiresFullDocumentRegeneration,
  type DocumentImpact,
  type DocumentImpactSummary,
} from './document-impact-analyzer';

export interface ChangeDetectionResult {
  knowledge: ProjectKnowledge;
  summary: ChangeSummary;
}

export function enrichProjectKnowledgeWithChangeDetection(
  knowledge: ProjectKnowledge,
): ChangeDetectionResult {
  const rootPath = getProjectRoot(knowledge);
  const docsDir = getDocsDir(knowledge);
  const baseline = loadPreviousKnowledgeBaseline(rootPath, docsDir, rootPath);
  const summary = detectChanges(baseline, knowledge);

  return {
    knowledge: {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        changeSummary: summary,
      },
    },
    summary,
  };
}

export function describeChangeDetection(summary: ChangeSummaryKnowledge): string {
  return formatChangeDetectionSummaryLine(summary);
}

export interface DocumentImpactResult {
  knowledge: ProjectKnowledge;
  impactSummary: DocumentImpactSummaryKnowledge;
}

export function enrichProjectKnowledgeWithDocumentImpact(
  knowledge: ProjectKnowledge,
): DocumentImpactResult {
  const changeSummary = knowledge.analysis.changeSummary;
  if (!changeSummary) {
    throw new Error('document impact analysis requires analysis.changeSummary');
  }

  const impactSummary = analyzeDocumentImpact(
    changeSummary,
    getDocumentationPlan(knowledge).documents,
  );

  return {
    knowledge: {
      ...knowledge,
      analysis: {
        ...knowledge.analysis,
        documentImpact: impactSummary,
      },
    },
    impactSummary,
  };
}

export interface IncrementalAnalysisResult {
  knowledge: ProjectKnowledge;
  changeSummary: ChangeSummary;
  impactSummary: DocumentImpactSummaryKnowledge;
}

export function enrichProjectKnowledgeWithIncrementalAnalysis(
  knowledge: ProjectKnowledge,
): IncrementalAnalysisResult {
  const { knowledge: withChangeSummary, summary: changeSummary } =
    enrichProjectKnowledgeWithChangeDetection(knowledge);
  const { knowledge: withDocumentImpact, impactSummary } =
    enrichProjectKnowledgeWithDocumentImpact(withChangeSummary);

  return {
    knowledge: withDocumentImpact,
    changeSummary,
    impactSummary,
  };
}

export function describeIncrementalAnalysis(
  changeSummary: ChangeSummaryKnowledge,
  impactSummary: DocumentImpactSummaryKnowledge,
): string {
  return `${describeChangeDetection(changeSummary)}; ${formatDocumentImpactSummaryLine(impactSummary)}`;
}
