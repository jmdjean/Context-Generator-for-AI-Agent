import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertReadableDirectory } from '../../utils/fs';
import type { JsonHttpResult } from './run';

const execFileAsync = promisify(execFile);

export interface BrowseFolderOptions {
  /** Override platform detection (tests). */
  readonly platform?: NodeJS.Platform;
  /** Override dialog opener (tests). */
  readonly openDialog?: () => Promise<string | null>;
}

/**
 * Handles POST /api/browse-folder.
 * Opens a native folder dialog on Windows; returns 501 elsewhere.
 */
export async function handleBrowseFolder(
  options: BrowseFolderOptions = {},
): Promise<JsonHttpResult> {
  const platform = options.platform ?? process.platform;

  if (platform !== 'win32') {
    return {
      status: 501,
      body: {
        error:
          'Native folder browse is only available on Windows. Paste an absolute path instead.',
        code: 'NOT_IMPLEMENTED',
      },
    };
  }

  try {
    const openDialog = options.openDialog ?? openWindowsFolderDialog;
    const selected = await openDialog();

    if (selected === null || selected.trim() === '') {
      return {
        status: 200,
        body: { cancelled: true },
      };
    }

    const absolutePath = assertReadableDirectory(selected.trim());
    return {
      status: 200,
      body: { path: absolutePath },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to browse for a folder';
    return {
      status: 400,
      body: { error: message, code: 'BAD_REQUEST' },
    };
  }
}

async function openWindowsFolderDialog(): Promise<string | null> {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = 'Select a project folder'",
    '$dialog.ShowNewFolderButton = $false',
    '$result = $dialog.ShowDialog()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  [Console]::Out.Write($dialog.SelectedPath)',
    '} else {',
    '  exit 2',
    '}',
  ].join('; ');

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-STA', '-NonInteractive', '-Command', script],
      {
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      },
    );
    const path = stdout.trim();
    return path.length > 0 ? path : null;
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? (error as { code?: number | string }).code
        : undefined;
    // PowerShell exit 2 = user cancelled the dialog.
    if (code === 2) {
      return null;
    }
    throw error;
  }
}
