import { startUiServer, resolveDefaultPublicDir } from './server';

const DEFAULT_PORT = 3847;

function resolvePort(argv: readonly string[]): number {
  const flagIndex = argv.indexOf('--port');
  if (flagIndex !== -1) {
    const raw = argv[flagIndex + 1];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error(`Invalid --port value: ${raw ?? '(missing)'}`);
    }
    return parsed;
  }

  const fromEnv = process.env.AI_PROJECT_DOCS_UI_PORT;
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    const parsed = Number(fromEnv);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error(`Invalid AI_PROJECT_DOCS_UI_PORT value: ${fromEnv}`);
    }
    return parsed;
  }

  return DEFAULT_PORT;
}

async function main(): Promise<void> {
  const port = resolvePort(process.argv.slice(2));
  await startUiServer({
    port,
    publicDir: resolveDefaultPublicDir(),
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start Web UI: ${message}`);
  process.exit(1);
});
