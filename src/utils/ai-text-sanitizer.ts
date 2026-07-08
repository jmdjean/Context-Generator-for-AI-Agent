function stripMarkdownInlineFormatting(value: string): string {
  return value
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`+/g, '');
}

function stripLinePrefix(line: string): string {
  return line
    .replace(/^\s{0,3}#+\s*/, '')
    .replace(/^\s*>\s*/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .trim();
}

export function sanitizeAiInsightMetadata(value: string): string {
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s{0,3}#+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeAiInsightText(value: string): string {
  const lines = value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(stripLinePrefix)
    .filter((line) => line.length > 0);

  const collapsed = lines.join(' ').replace(/\s+/g, ' ').trim();
  const withoutHtml = collapsed.replace(/<[^>]*>/g, '');
  const withoutMarkdown = stripMarkdownInlineFormatting(withoutHtml);

  return withoutMarkdown.replace(/\s+/g, ' ').trim();
}
