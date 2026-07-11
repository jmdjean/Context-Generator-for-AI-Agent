import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { buildRuntimeConfig } from '../config';
import { ANALYSIS_PIPELINE } from '../domain';
import {
  executePipeline,
  type PipelineProgressEvent,
} from './pipeline-orchestrator';

const fixtureMinimal = path.resolve(
  __dirname,
  '..',
  '..',
  'test',
  'fixtures',
  'fixture-minimal',
);

describe('executePipeline onProgress', () => {
  it('emits started and terminal status events for each step', async () => {
    const config = buildRuntimeConfig({
      targetProjectPath: fixtureMinimal,
      docsDir: '.ai-docs',
      enableAiAnalysis: false,
    });

    const events: PipelineProgressEvent[] = [];
    const result = await executePipeline(config, {
      onProgress: (event) => {
        events.push(event);
      },
    });

    assert.equal(result.success, true);
    assert.ok(events.length >= ANALYSIS_PIPELINE.length * 2);

    for (let i = 0; i < ANALYSIS_PIPELINE.length; i++) {
      const stepName = ANALYSIS_PIPELINE[i].name;
      const started = events.find(
        (event) => event.stepIndex === i && event.status === 'started',
      );
      assert.ok(started, `missing started event for ${stepName}`);
      assert.equal(started.stepName, stepName);

      const terminal = events.find(
        (event) =>
          event.stepIndex === i &&
          (event.status === 'completed' ||
            event.status === 'skipped' ||
            event.status === 'failed'),
      );
      assert.ok(terminal, `missing terminal event for ${stepName}`);
      assert.equal(terminal.stepName, stepName);
    }
  });

  it('runs without a callback (CLI-compatible)', async () => {
    const config = buildRuntimeConfig({
      targetProjectPath: fixtureMinimal,
      docsDir: '.ai-docs',
      enableAiAnalysis: false,
    });

    const result = await executePipeline(config);
    assert.equal(result.success, true);
    assert.ok(result.steps.length === ANALYSIS_PIPELINE.length);
  });
});
