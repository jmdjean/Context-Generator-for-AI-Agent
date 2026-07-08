export function formatErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }

  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'EACCES' || code === 'EPERM') {
    return `Permission denied: ${err.message}`;
  }

  return err.message;
}
