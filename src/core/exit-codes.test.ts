import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyPipelineMetrics } from './pipeline-metrics';
import {
  EXIT_RUNTIME_ERROR,
  EXIT_SUCCESS,
  EXIT_VALIDATION_ERROR,
  resolveExitCode,
} from './exit-codes';
import { PipelineExecutionResult } from './pipeline-orchestrator';

function buildResult(overrides: Partial<PipelineExecutionResult> = {}): PipelineExecutionResult {
  return {
    success: true,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    errors: [],
    metrics: createEmptyPipelineMetrics(),
    steps: [],
    ...overrides,
  };
}

describe('resolveExitCode', () => {
  it('returns 0 for a successful run', () => {
    assert.equal(resolveExitCode(buildResult()), EXIT_SUCCESS);
  });

  it('returns 2 when validation failed', () => {
    const result = buildResult({
      success: false,
      errors: [{ stepName: 'Validate Documentation', message: 'failed (1 error(s), 0 warning(s))' }],
      metrics: {
        ...createEmptyPipelineMetrics(),
        validation: {
          status: 'failed',
          errorCount: 1,
          warningCount: 0,
          issues: [{ severity: 'error', message: 'planned document was not written' }],
        },
      },
    });

    assert.equal(resolveExitCode(result), EXIT_VALIDATION_ERROR);
  });

  it('returns 3 for other pipeline failures', () => {
    const result = buildResult({
      success: false,
      errors: [{ stepName: 'Write Documentation', message: 'Permission denied: EACCES' }],
    });

    assert.equal(resolveExitCode(result), EXIT_RUNTIME_ERROR);
  });
});
