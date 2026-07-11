import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import type { RuntimeConfig } from '../../config';
import type { ExecutePipelineOptions, PipelineExecutionResult } from '../../core';
import { createEmptyPipelineMetrics } from '../../core/pipeline-metrics';
import {
  handlePostRun,
  handlePostRunSse,
  resetRunMutexForTests,
  setPipelineRunnerForTests,
} from './run';

function emptyResult(): PipelineExecutionResult {
  const now = new Date().toISOString();
  return {
    success: true,
    steps: [],
    startedAt: now,
    finishedAt: now,
    errors: [],
    metrics: createEmptyPipelineMetrics(),
  };
}

class FakeSseResponse extends EventEmitter {
  headersSent = false;
  readonly chunks: string[] = [];
  private statusCode = 0;
  private headers: Record<string, string> = {};

  writeHead(statusCode: number, headers: Record<string, string>): this {
    this.statusCode = statusCode;
    this.headers = headers;
    this.headersSent = true;
    return this;
  }

  flushHeaders(): void {
    this.headersSent = true;
  }

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  end(chunk?: string): this {
    if (chunk) {
      this.chunks.push(chunk);
    }
    this.emit('end');
    return this;
  }

  get contentType(): string {
    return this.headers['Content-Type'] ?? '';
  }

  get status(): number {
    return this.statusCode;
  }

  get body(): string {
    return this.chunks.join('');
  }
}

describe('handlePostRun concurrency', () => {
  afterEach(() => {
    setPipelineRunnerForTests(undefined);
    resetRunMutexForTests();
  });

  it('returns 409 when a run is already in progress', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-ui-run-'));

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    setPipelineRunnerForTests(async (_config: RuntimeConfig) => {
      await gate;
      return emptyResult();
    });

    try {
      const firstPromise = handlePostRun({ targetProjectPath: tempDir });
      await new Promise((resolve) => setImmediate(resolve));

      const second = await handlePostRun({ targetProjectPath: tempDir });
      assert.equal(second.status, 409);
      const secondBody = second.body as { code?: string };
      assert.equal(secondBody.code, 'CONFLICT');

      release();
      const first = await firstPromise;
      assert.equal(first.status, 200);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('handlePostRunSse', () => {
  afterEach(() => {
    setPipelineRunnerForTests(undefined);
    resetRunMutexForTests();
  });

  it('streams step events then a done event', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-project-docs-ui-sse-'));
    const res = new FakeSseResponse();

    setPipelineRunnerForTests(
      async (_config: RuntimeConfig, options?: ExecutePipelineOptions) => {
        options?.onProgress?.({
          stepIndex: 0,
          stepName: 'Resolve Configuration',
          status: 'started',
        });
        options?.onProgress?.({
          stepIndex: 0,
          stepName: 'Resolve Configuration',
          status: 'completed',
        });
        return emptyResult();
      },
    );

    try {
      const result = await handlePostRunSse({ targetProjectPath: tempDir }, res as unknown as ServerResponse);
      assert.equal(result.streamed, true);
      assert.equal(res.status, 200);
      assert.match(res.contentType, /text\/event-stream/);

      const events = res.body
        .split('\n\n')
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.startsWith('data:'))
        .map((chunk) => JSON.parse(chunk.slice(5).trim()) as { type: string; name?: string; status?: string });

      assert.ok(events.some((event) => event.type === 'step' && event.status === 'started'));
      assert.ok(events.some((event) => event.type === 'step' && event.status === 'completed'));
      const done = events.find((event) => event.type === 'done') as
        | (Record<string, unknown> & { type: string; exitCode: number })
        | undefined;
      assert.ok(done);
      assert.equal(done.exitCode, 0);
      assert.ok('summary' in done);
      assert.ok('docsPath' in done);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns JSON error before streaming when the body is invalid', async () => {
    const res = new FakeSseResponse();
    const result = await handlePostRunSse({}, res as unknown as ServerResponse);
    assert.equal(result.streamed, false);
    if (result.streamed) {
      assert.fail('expected non-streamed error');
    }
    assert.equal(result.status, 400);
    assert.equal(res.headersSent, false);
  });
});
