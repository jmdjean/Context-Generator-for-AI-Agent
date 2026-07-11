import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const fixtureMinimal = join(projectRoot, 'test', 'fixtures', 'fixture-minimal');
const publicDir = join(projectRoot, 'dist', 'ui', 'public');

function fail(message) {
  console.error(`UI smoke test failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

async function main() {
  assert(existsSync(join(projectRoot, 'dist', 'ui', 'server.js')), 'dist/ui/server.js missing — run npm run build first');
  assert(existsSync(publicDir), `UI public dir missing: ${publicDir}`);
  assert(existsSync(fixtureMinimal), `fixture missing: ${fixtureMinimal}`);

  const { startUiServer } = require(join(projectRoot, 'dist', 'ui', 'server.js'));
  const server = await startUiServer({ port: 0, publicDir });
  const baseUrl = server.url.replace(/\/$/, '');

  try {
    const providersResponse = await fetch(`${baseUrl}/api/providers`);
    assert(providersResponse.ok, `GET /api/providers returned ${providersResponse.status}`);
    const providers = await providersResponse.json();
    assert(Array.isArray(providers.providers) && providers.providers.length >= 2, 'expected openrouter + openai providers');
    assert(providers.providers.some((item) => item.id === 'openrouter'), 'missing openrouter provider');
    assert(providers.providers.some((item) => item.id === 'openai'), 'missing openai provider');

    const homeResponse = await fetch(`${baseUrl}/`);
    assert(homeResponse.ok, `GET / returned ${homeResponse.status}`);
    const html = await homeResponse.text();
    assert(html.includes('id="run-form"'), 'HTML form missing');
    assert(html.includes('enableAgentExports'), 'export checkbox missing');
    assert(html.includes('open-docs-button'), 'open docs button missing');
    assert(html.includes('clear-settings'), 'clear settings control missing');

    const runResponse = await fetch(`${baseUrl}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProjectPath: fixtureMinimal,
        docsDir: '.ai-docs',
        enableAiAnalysis: false,
      }),
    });
    assert(runResponse.ok, `POST /api/run returned ${runResponse.status}`);
    const payload = await runResponse.json();
    assert(typeof payload.exitCode === 'number', 'exitCode missing');
    assert(payload.summary && typeof payload.summary.headline === 'string', 'summary.headline missing');
    assert(typeof payload.docsPath === 'string' && payload.docsPath.includes('fixture-minimal'), 'docsPath missing');
    assert(!JSON.stringify(payload).toLowerCase().includes('apikeys'), 'response must not include apiKeys');

    const streamResponse = await fetch(`${baseUrl}/api/run?stream=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProjectPath: fixtureMinimal,
        docsDir: '.ai-docs',
        enableAiAnalysis: false,
      }),
    });
    assert(streamResponse.ok, `POST /api/run?stream=1 returned ${streamResponse.status}`);
    const contentType = streamResponse.headers.get('content-type') || '';
    assert(contentType.includes('text/event-stream'), `expected SSE content-type, got ${contentType}`);
    const streamBody = await streamResponse.text();
    assert(streamBody.includes('"type":"step"'), 'SSE missing step events');
    assert(streamBody.includes('"type":"done"'), 'SSE missing done event');

    console.log('UI smoke test passed.');
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
