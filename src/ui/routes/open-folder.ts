import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { pathExists, assertReadableDirectory } from '../../utils/fs';
import type { JsonHttpResult } from './run';

export interface OpenFolderRequestBody {
  readonly path?: unknown;
}

export interface OpenFolderOptions {
  readonly platform?: NodeJS.Platform;
  /** Injected for tests — opens the validated absolute path. */
  readonly openPath?: (absolutePath: string) => Promise<void>;
}

/**
 * Handles POST /api/open-folder.
 * Opens a validated AI Project Docs output folder in the OS file manager.
 */
export async function handleOpenFolder(
  body: unknown,
  options: OpenFolderOptions = {},
): Promise<JsonHttpResult> {
  if (!isPlainObject(body)) {
    return {
      status: 400,
      body: { error: 'Request body must be a JSON object', code: 'BAD_REQUEST' },
    };
  }

  if (typeof body.path !== 'string' || body.path.trim() === '') {
    return {
      status: 400,
      body: { error: 'path is required', code: 'BAD_REQUEST' },
    };
  }

  try {
    const absolutePath = assertOpenableDocsFolder(body.path.trim());
    const openPath = options.openPath ?? ((target) => openInFileManager(target, options.platform));
    await openPath(absolutePath);
    return {
      status: 200,
      body: { opened: true, path: absolutePath },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open folder';
    return {
      status: 400,
      body: { error: message, code: 'BAD_REQUEST' },
    };
  }
}

function assertOpenableDocsFolder(targetPath: string): string {
  const absolutePath = assertReadableDirectory(targetPath);
  const knowledgeFile = path.join(absolutePath, 'knowledge', 'project-knowledge.json');
  const agentsFile = path.join(absolutePath, 'AGENTS.md');

  if (!pathExists(knowledgeFile) && !pathExists(agentsFile)) {
    throw new Error(
      'Path does not look like an AI Project Docs output folder (missing knowledge/project-knowledge.json or AGENTS.md)',
    );
  }

  return absolutePath;
}

async function openInFileManager(
  absolutePath: string,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let child;
    if (platform === 'win32') {
      child = spawn('explorer', [absolutePath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
    } else if (platform === 'darwin') {
      child = spawn('open', [absolutePath], {
        detached: true,
        stdio: 'ignore',
      });
    } else {
      child = spawn('xdg-open', [absolutePath], {
        detached: true,
        stdio: 'ignore',
      });
    }

    child.on('error', reject);
    child.unref();
    // explorer on Windows often exits with a non-zero code even when it opens.
    resolve();
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
