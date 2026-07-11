import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { handleBrowseFolder } from './routes/browse-folder';
import { handleOpenFolder } from './routes/open-folder';
import { handleGetProviders } from './routes/providers';
import { handlePostRun, handlePostRunSse } from './routes/run';

const HOST = '127.0.0.1';
const MAX_JSON_BODY_BYTES = 64 * 1024;

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export interface StartUiServerOptions {
  readonly port: number;
  /** Absolute path to dist/ui/public (or equivalent). */
  readonly publicDir: string;
}

export interface UiServerHandle {
  readonly port: number;
  readonly host: typeof HOST;
  readonly url: string;
  close(): Promise<void>;
}

export async function startUiServer(options: StartUiServerOptions): Promise<UiServerHandle> {
  const publicDir = resolve(options.publicDir);
  const server = createServer((req, res) => {
    void handleRequest(req, res, publicDir);
  });

  await listen(server, options.port);

  const address = server.address();
  if (address === null || typeof address === 'string') {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) {
          rejectClose(error);
          return;
        }
        resolveClose();
      });
    });
    throw new Error('Failed to resolve UI server listen address');
  }

  const port = address.port;
  const url = `http://${HOST}:${port}/`;
  console.log(`AI Project Docs Web UI listening on ${url}`);

  return {
    port,
    host: HOST,
    url,
    close: () =>
      new Promise((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }
          resolveClose();
        });
      }),
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  publicDir: string,
): Promise<void> {
  try {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${HOST}`);

    if (url.pathname === '/api/providers' && method === 'GET') {
      const result = handleGetProviders();
      sendJson(res, result.status, result.body);
      return;
    }

    if (url.pathname === '/api/browse-folder' && method === 'POST') {
      const result = await handleBrowseFolder();
      sendJson(res, result.status, result.body);
      return;
    }

    if (url.pathname === '/api/open-folder' && method === 'POST') {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid request body';
        sendJson(res, 400, { error: message, code: 'BAD_REQUEST' });
        return;
      }
      const result = await handleOpenFolder(body);
      sendJson(res, result.status, result.body);
      return;
    }

    if (url.pathname === '/api/run' && method === 'POST') {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid request body';
        sendJson(res, 400, { error: message, code: 'BAD_REQUEST' });
        return;
      }

      const stream = url.searchParams.get('stream') === '1';
      if (stream) {
        const result = await handlePostRunSse(body, res);
        if (!result.streamed) {
          sendJson(res, result.status, result.body);
        }
        return;
      }

      const result = await handlePostRun(body);
      sendJson(res, result.status, result.body);
      return;
    }

    if (method === 'GET' || method === 'HEAD') {
      await serveStatic(req, res, publicDir, url.pathname, method === 'HEAD');
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (!res.headersSent) {
      sendJson(res, 500, { error: message, code: 'INTERNAL_ERROR' });
    } else {
      res.end();
    }
  }
}

async function serveStatic(
  _req: IncomingMessage,
  res: ServerResponse,
  publicDir: string,
  pathname: string,
  headOnly: boolean,
): Promise<void> {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (relativePath.includes('..') || relativePath.includes('\0')) {
    sendJson(res, 403, { error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  const normalizedRelative = normalize(relativePath);
  if (normalizedRelative.startsWith('..') || normalizedRelative.includes(`..${sep}`)) {
    sendJson(res, 403, { error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  const filePath = resolve(publicDir, normalizedRelative);
  if (!filePath.startsWith(publicDir + sep) && filePath !== publicDir) {
    sendJson(res, 403, { error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  try {
    const body = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': body.byteLength,
    });
    if (headOnly) {
      res.end();
      return;
    }
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'Not found', code: 'NOT_FOUND' });
  }
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Content-Type must be application/json');
  }

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > MAX_JSON_BODY_BYTES) {
      throw new Error(`Request body exceeds ${MAX_JSON_BODY_BYTES} bytes`);
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Request body is not valid JSON');
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.byteLength,
  });
  res.end(body);
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolveListen, rejectListen) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolveListen();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

/** Resolves the public asset directory relative to this compiled file (dist/ui/). */
export function resolveDefaultPublicDir(): string {
  return join(__dirname, 'public');
}
