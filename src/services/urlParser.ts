/**
 * Parses raw text or HTML-formatted descriptions into structured segments (plain text or safe links)
 */
export interface TextSegment {
  type: 'text' | 'link';
  content: string;
  url?: string;
}

export function parseLinksInText(text: string): TextSegment[] {
  if (!text) return [];

  // Match markdown links [label](url), standard HTML <a href="...">label</a>, or raw http(s) URLs
  const urlRegex = /(<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>)|(\bhttps?:\/\/[^\s<>"']+)/gi;

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    if (match[1]) {
      // HTML <a href="...">...</a>
      const href = match[2];
      const label = match[3] || href;
      segments.push({
        type: 'link',
        content: label,
        url: href,
      });
    } else if (match[4]) {
      // Raw URL
      const rawUrl = match[4];
      segments.push({
        type: 'link',
        content: rawUrl,
        url: rawUrl,
      });
    }

    lastIndex = urlRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
