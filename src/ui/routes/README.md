# src/ui/routes

HTTP route handlers for the local Web UI API.

| File | Endpoint | Role |
|---|---|---|
| `providers.ts` | `GET /api/providers` | List AI providers from the registry |
| `run.ts` | `POST /api/run` | Map body → config, run `executePipeline`, return JSON summary |
| `run.ts` | `POST /api/run?stream=1` | Same run with SSE step progress + final `done` event |
| `browse-folder.ts` | `POST /api/browse-folder` | Windows folder dialog; 501 on other platforms |
| `open-folder.ts` | `POST /api/open-folder` | Open a validated docs output folder in the OS file manager |

## Hard stops

- Call `executePipeline(config)` + `buildRunSummaryData()` — never `run()` / `printRunSummary()`.
- Do not log request bodies (may contain API keys).
- Concurrent runs return HTTP 409 via the module-level mutex in `run.ts`.
- Keep JSON mode (`POST /api/run` without `?stream=1`) working for non-SSE clients.
- Do not open arbitrary paths from `/api/open-folder` — require a readable docs output folder.
