export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
  recommendation?: string;
}

export interface ValidationSummary {
  totalIssues: number;
  errors: number;
  warnings: number;
  info: number;
  checkedAt: string;
}

export interface ValidationResult {
  success: boolean;
  issues: ValidationIssue[];
  summary: ValidationSummary;
}

function countBySeverity(issues: ValidationIssue[], severity: ValidationSeverity): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

export function buildValidationResult(
  issues: ValidationIssue[],
  checkedAt: string = new Date().toISOString(),
): ValidationResult {
  const errors = countBySeverity(issues, 'error');

  return {
    success: errors === 0,
    issues,
    summary: {
      totalIssues: issues.length,
      errors,
      warnings: countBySeverity(issues, 'warning'),
      info: countBySeverity(issues, 'info'),
      checkedAt,
    },
  };
}
