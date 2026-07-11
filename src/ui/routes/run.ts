import * as path from 'node:path';
import type { ServerResponse } from 'node:http';
import {
  executePipeline,
  buildRunSummaryData,
  resolveExitCode,
  type ExecutePipelineOptions,
  type PipelineExecutionResult,
} from '../../core';
import type { RuntimeConfig } from '../../config';
import { mapRunRequestToConfig } from '../config-mapper';
import { createProgressBridge, sendSseEvent, writeSseHeaders } from '../progress-bridge';

export interface JsonHttpResult {
  readonly status: number;
  readonly body: unknown;
}

export type SseRunHandleResult =
  | { readonly streamed: false; readonly status: number; readonly body: unknown }
  | { readonly streamed: true };

type PipelineRunner = (
  config: RuntimeConfig,
  options?: ExecutePipelineOptions,
) => Promise<PipelineExecutionResult>;

let runInProgress = false;
let pipelineRunner: PipelineRunner = executePipeline;

/** Test helper — resets the module-level run mutex. */
export function resetRunMutexForTests(): void {
  runInProgress = false;
}

/** Test helper — inject a pipeline runner (pass undefined to restore default). */
export function setPipelineRunnerForTests(runner: PipelineRunner | undefined): void {
  pipelineRunner = runner ?? executePipeline;
}

/**
 * Handles POST /api/run: map body → RuntimeConfig, run executePipeline,
 * return structured summary. Never calls run() / printRunSummary().
 */
export async function handlePostRun(body: unknown): Promise<JsonHttpResult> {
  if (runInProgress) {
    return {
      status: 409,
      body: { error: 'A run is already in progress', code: 'CONFLICT' },
    };
  }

  const mapped = mapRunRequestToConfig(body);
  if (!mapped.ok) {
    return {
      status: mapped.status,
      body: { error: mapped.error, code: 'BAD_REQUEST' },
    };
  }

  runInProgress = true;
  try {
    const result = await pipelineRunner(mapped.config);
    return buildSuccessBody(mapped.config, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pipeline execution failed';
    return {
      status: 500,
      body: { error: message, code: 'INTERNAL_ERROR' },
    };
  } finally {
    runInProgress = false;
  }
}

/**
 * Handles POST /api/run?stream=1 — SSE step progress, then a final done event.
 * Pre-stream errors (409/400) are returned as JSON via { streamed: false }.
 */
export async function handlePostRunSse(
  body: unknown,
  res: ServerResponse,
): Promise<SseRunHandleResult> {
  if (runInProgress) {
    return {
      streamed: false,
      status: 409,
      body: { error: 'A run is already in progress', code: 'CONFLICT' },
    };
  }

  const mapped = mapRunRequestToConfig(body);
  if (!mapped.ok) {
    return {
      streamed: false,
      status: mapped.status,
      body: { error: mapped.error, code: 'BAD_REQUEST' },
    };
  }

  runInProgress = true;
  try {
    writeSseHeaders(res);
    const onProgress = createProgressBridge(res);
    const result = await pipelineRunner(mapped.config, { onProgress });
    const success = buildSuccessBody(mapped.config, result);
    const payload = success.body as {
      exitCode: number;
      summary: unknown;
      docsPath: string;
      warnings: string[];
    };
    sendSseEvent(res, {
      type: 'done',
      exitCode: payload.exitCode,
      summary: payload.summary,
      docsPath: payload.docsPath,
      warnings: payload.warnings,
    });
    res.end();
    return { streamed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pipeline execution failed';
    if (!res.headersSent) {
      return {
        streamed: false,
        status: 500,
        body: { error: message, code: 'INTERNAL_ERROR' },
      };
    }
    // Best-effort close after headers were already sent as SSE.
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    } catch {
      // ignore write failures on a broken connection
    }
    res.end();
    return { streamed: true };
  } finally {
    runInProgress = false;
  }
}

function buildSuccessBody(
  config: RuntimeConfig,
  result: PipelineExecutionResult,
): JsonHttpResult {
  const summary = buildRunSummaryData({ config, result });
  const exitCode = resolveExitCode(result);
  const docsPath = path.join(config.targetProjectPath, config.docsDir);
  const warnings = summary.agentExports?.warnings ?? [];

  return {
    status: 200,
    body: {
      exitCode,
      summary,
      docsPath,
      warnings,
    },
  };
}
