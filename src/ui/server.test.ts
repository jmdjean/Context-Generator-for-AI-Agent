import assert from 'node:assert/strict';
import http from 'node:http';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { startUiServer, type UiServerHandle } from './server';

const projectRoot = path.resolve(__dirname, '..', '..');
const fixtureMinimal = path.join(projectRoot, 'test', 'fixtures', 'fixture-minimal');
const publicDir = path.join(projectRoot, 'dist', 'ui', 'public');

describe('UI HTTP server (integration)', () => {
  let server: UiServerHandle;
  let baseUrl: string;

  before(async () => {
    server = await startUiServer({ port: 0, publicDir });
    baseUrl = server.url.replace(/\/$/, '');
  });

  after(async () => {
    await server.close();
  });

  it('GET / returns the HTML form', async () => {
    const response = await request('GET', '/');
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'] ?? '', /text\/html/);
    assert.match(response.body, /AI Project Docs/);
    assert.match(response.body, /id="run-form"/);
    assert.match(response.body, /type="password"/);
    assert.match(response.body, /enableAgentExports/);
    assert.match(response.body, /open-docs-button/);
    assert.match(response.body, /clear-settings/);
  });

  it('GET /api/providers returns registry providers', async () => {
    const response = await request('GET', '/api/providers');
    assert.equal(response.status, 200);
    const payload = JSON.parse(response.body) as {
      providers: Array<{ id: string; name: string; requiresApiKey: boolean }>;
      defaultProvider: string;
      defaultModel: string;
    };
    assert.ok(Array.isArray(payload.providers));
    assert.ok(payload.providers.length >= 1);
    assert.equal(payload.providers[0].id, 'openrouter');
    assert.equal(payload.defaultProvider, 'openrouter');
    assert.ok(typeof payload.defaultModel === 'string' && payload.defaultModel.length > 0);
  });

  it('POST /api/run runs the pipeline on fixture-minimal', async () => {
    const response = await request('POST', '/api/run', {
      targetProjectPath: fixtureMinimal,
      docsDir: '.ai-docs',
      enableAiAnalysis: false,
    });
    assert.equal(response.status, 200);
    const payload = JSON.parse(response.body) as {
      exitCode: number;
      summary: { headline?: string; projectName?: string };
      docsPath: string;
      warnings: string[];
    };
    assert.equal(typeof payload.exitCode, 'number');
    assert.ok(payload.summary);
    assert.ok(typeof payload.summary.headline === 'string');
    assert.ok(payload.docsPath.includes('fixture-minimal'));
    assert.ok(Array.isArray(payload.warnings));
    assert.doesNotMatch(response.body, /sk-/i);
    assert.doesNotMatch(response.body, /apiKeys/i);
  });

  it('POST /api/run?stream=1 returns SSE step and done events', async () => {
    const response = await request('POST', '/api/run?stream=1', {
      targetProjectPath: fixtureMinimal,
      docsDir: '.ai-docs',
      enableAiAnalysis: false,
    });
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'] ?? '', /text\/event-stream/);

    const events = response.body
      .split('\n\n')
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.startsWith('data:'))
      .map((chunk) => JSON.parse(chunk.slice(5).trim()) as { type: string });

    assert.ok(events.some((event) => event.type === 'step'));
    const done = events.find((event) => event.type === 'done') as
      | { type: string; exitCode: number; summary: unknown; docsPath: string }
      | undefined;
    assert.ok(done);
    assert.equal(typeof done.exitCode, 'number');
    assert.ok(done.summary);
    assert.ok(typeof done.docsPath === 'string');
    assert.doesNotMatch(response.body, /sk-/i);
  });

  it('POST /api/run with empty body returns 400', async () => {
    const response = await request('POST', '/api/run', {});
    assert.equal(response.status, 400);
    const payload = JSON.parse(response.body) as { error?: string; code?: string };
    assert.equal(payload.code, 'BAD_REQUEST');
    assert.match(payload.error ?? '', /targetProjectPath/i);
  });

  it('POST /api/browse-folder returns 501 outside Windows', async () => {
    if (process.platform === 'win32') {
      // Real dialog is covered by browse-folder unit tests with an injected opener.
      return;
    }
    const response = await request('POST', '/api/browse-folder');
    assert.equal(response.status, 501);
    const payload = JSON.parse(response.body) as { code?: string };
    assert.equal(payload.code, 'NOT_IMPLEMENTED');
  });

  it('POST /api/open-folder rejects non-docs directories', async () => {
    const response = await request('POST', '/api/open-folder', {
      path: fixtureMinimal,
    });
    assert.equal(response.status, 400);
    const payload = JSON.parse(response.body) as { error?: string; code?: string };
    assert.equal(payload.code, 'BAD_REQUEST');
    assert.match(payload.error ?? '', /does not look like an AI Project Docs output folder/);
  });

  it('blocks path traversal in static URLs', async () => {
    const response = await request('GET', '/../../package.json');
    assert.ok(response.status === 403 || response.status === 404);
    assert.doesNotMatch(response.body, /"name"\s*:\s*"ai-project-docs"/);
  });

  function request(
    method: string,
    requestPath: string,
    body?: unknown,
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const url = new URL(requestPath, `${baseUrl}/`);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          method,
          headers:
            payload === undefined
              ? undefined
              : {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: data,
            });
          });
        },
      );
      req.on('error', reject);
      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  }
});
