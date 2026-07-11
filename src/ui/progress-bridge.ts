import type { ServerResponse } from 'node:http';
import type { PipelineProgressEvent } from '../core/pipeline-orchestrator';

export interface SseStepEvent {
  readonly type: 'step';
  readonly name: string;
  readonly status: PipelineProgressEvent['status'];
}

export interface SseDoneEvent {
  readonly type: 'done';
  readonly exitCode: number;
  readonly summary: unknown;
  readonly docsPath: string;
  readonly warnings: readonly string[];
}

export type SseProgressEvent = SseStepEvent | SseDoneEvent;

export function writeSseHeaders(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  // Flush headers for proxies / browsers that buffer.
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
}

export function sendSseEvent(res: ServerResponse, event: SseProgressEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function createProgressBridge(
  res: ServerResponse,
): (event: PipelineProgressEvent) => void {
  return (event: PipelineProgressEvent): void => {
    sendSseEvent(res, {
      type: 'step',
      name: event.stepName,
      status: event.status,
    });
  };
}
