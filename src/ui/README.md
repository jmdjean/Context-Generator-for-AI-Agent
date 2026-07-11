# src/ui

**Responsibility:** Local Web UI entry point — HTTP server, static frontend assets, and request mapping into shared config/pipeline APIs.

This module is an **additional entry point** beside the CLI. It does not replace `src/cli.ts` or `src/config/` argument parsing. The MVP serves a browser UI on `127.0.0.1` so users can pick a target folder, configure options, and run the existing analysis pipeline without using the terminal.

---

## Ownership

| File | Role |
|---|---|
| `index.ts` | Process entry: resolve port (`AI_PROJECT_DOCS_UI_PORT` / `--port`), call `startUiServer` |
| `server.ts` | `node:http` server — static files + API routes |
| `config-mapper.ts` | HTTP JSON body → `RuntimeConfig` via `buildRuntimeConfig()` |
| `progress-bridge.ts` | Pipeline `onProgress` → SSE `step` / helpers for `done` |
| `routes/` | `GET /api/providers`, `POST /api/run` (+ `?stream=1`), `POST /api/browse-folder`, `POST /api/open-folder` |
| `public/` | Static HTML/CSS/JS form served at `/` |

---

## Hard stops

- **No pipeline logic** — do not implement scan, detect, analyze, write, or validate here. `POST /api/run` calls `executePipeline(config)` + `buildRunSummaryData()`. Do **not** call `run()` (it prints CLI stdout).
- **No `process.argv` / `process.env` in the mapper** — `config-mapper.ts` receives a typed JSON body only. Port/env for the server process itself stays in `index.ts`. Never log request bodies (API keys).
- **No Express / Fastify / other frameworks** — use Node.js `http` only.
- **Localhost only** — bind `127.0.0.1`, never `0.0.0.0`.
- **No repository analysis inside the frontend** — the browser talks to the local API; analysis stays in the pipeline.

---

## How to run

```bash
npm run ui
# opens http://127.0.0.1:3847

npm run ui:smoke
# builds, starts an ephemeral UI server, POSTs fixture-minimal, asserts JSON + SSE
```

Optional port:

```bash
AI_PROJECT_DOCS_UI_PORT=4000 npm run ui
# or after build:
node dist/ui/index.js --port 4000
```

Static assets are copied from `src/ui/public/` to `dist/ui/public/` by `scripts/copy-ui-assets.mjs` during `npm run build`.

---

## Related docs

- [`docs/web-ui/plan.md`](../../docs/web-ui/plan.md) — full Web UI plan and locked decisions
- [`docs/web-ui/tasks/`](../../docs/web-ui/tasks/) — step-by-step implementation tasks
- [`src/config/README.md`](../config/README.md) — `buildRuntimeConfig()`
- [`src/core/README.md`](../core/README.md) — `executePipeline` / run summary
