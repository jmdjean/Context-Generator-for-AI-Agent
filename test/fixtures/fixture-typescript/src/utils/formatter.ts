export function trim(value: string): string {
  return value.trim();
}

export function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value[0].toUpperCase() + value.slice(1).toLowerCase();
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength) + '...';
}
