/**
 * Helper utility functions for Hashtag and Mention parsing
 */

export function extractHashtags(text: string): string[] {
  if (!text) return [];
  // Regex to match #hashtag words, including Portuguese accents (e.g., #viagem, #férias, #são_paulo)
  const regex = /#([a-zA-Z0-9_\u00C0-\u017F]+)/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const tag = match[1].toLowerCase().trim();
    if (tag) {
      matches.add(tag);
    }
  }
  return Array.from(matches);
}

export function extractMentions(text: string): string[] {
  if (!text) return [];
  // Regex to match @username words
  const regex = /@([a-zA-Z0-9_.]+)/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const username = match[1].toLowerCase().trim();
    if (username) {
      matches.add(username);
    }
  }
  return Array.from(matches);
}

export function formatHashtagPostCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace('.0', '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace('.0', '') + 'k';
  }
  return count.toString();
}
