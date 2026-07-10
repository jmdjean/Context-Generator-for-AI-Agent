import { ChangeSummaryKnowledge } from '../knowledge/project-knowledge';

export function appendChangeSummaryDetailLines(
  lines: string[],
  summary: ChangeSummaryKnowledge,
  indent: string,
): void {
  if (summary.warnings.length > 0) {
    for (const warning of summary.warnings) {
      lines.push(`${indent}Warning: ${warning}`);
    }
  }

  if (summary.changedSections.includes('modules')) {
    lines.push(`${indent}Added modules: ${summary.addedModules.length}`);
    lines.push(`${indent}Removed modules: ${summary.removedModules.length}`);
  }

  if (summary.changedSections.includes('folderContexts')) {
    lines.push(`${indent}Added folders: ${summary.addedFolders.length}`);
    lines.push(`${indent}Removed folders: ${summary.removedFolders.length}`);
  }

  if (summary.changedSections.includes('technologies')) {
    if (summary.changedTechnologies.length > 0) {
      lines.push(`${indent}Changed technologies: ${summary.changedTechnologies.join(', ')}`);
    }
    if (summary.technologyConfidenceChanged) {
      lines.push(`${indent}Technology confidence changed`);
    }
  }

  if (summary.changedSections.includes('dependencyGraph')) {
    const addedEdges = summary.dependencyEdgeChanges.filter((edge) => edge.change === 'added').length;
    const removedEdges = summary.dependencyEdgeChanges.filter((edge) => edge.change === 'removed').length;
    lines.push(`${indent}Added dependency edges: ${addedEdges}`);
    lines.push(`${indent}Removed dependency edges: ${removedEdges}`);
  }
}

export function formatChangeDetectionSummaryLine(summary: ChangeSummaryKnowledge): string {
  if (summary.baselineStatus === 'unreadable') {
    return 'unreadable previous snapshot';
  }

  if (summary.isInitialRun) {
    if (summary.baselineStatus === 'repository-mismatch') {
      return 'initial run (ignored mismatched snapshot)';
    }
    return 'initial run';
  }

  if (summary.changedSections.length === 0) {
    return 'no changes';
  }

  return `${summary.changedSections.length} section(s): ${summary.changedSections.join(', ')}`;
}

export function formatRunSummaryChangeDetectionLines(summary: ChangeSummaryKnowledge): string[] {
  const lines: string[] = ['', 'Change detection:'];

  if (summary.baselineStatus === 'unreadable') {
    lines.push('- Initial run: no');
    lines.push('- Baseline: unreadable snapshot');
  } else if (summary.isInitialRun) {
    if (summary.baselineStatus === 'repository-mismatch') {
      lines.push('- Initial run: yes');
      lines.push('- Baseline: ignored (repository root mismatch)');
    } else {
      lines.push('- Initial run: yes (baseline created)');
    }
  } else {
    lines.push('- Initial run: no');
    lines.push(
      `- Changed sections: ${summary.changedSections.length > 0 ? summary.changedSections.join(', ') : 'none'}`,
    );
  }

  const detailLines: string[] = [];
  appendChangeSummaryDetailLines(detailLines, summary, '- ');
  lines.push(...detailLines);

  return lines;
}
