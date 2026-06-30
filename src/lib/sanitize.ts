const HTML_TAG_RE = /<[^>]*>/g;
const MULTIPLE_SPACES_RE = /\s{2,}/g;

export function sanitizeText(raw: string, maxLength = 500): string {
  return raw
    .replace(HTML_TAG_RE, "")
    .replace(MULTIPLE_SPACES_RE, " ")
    .trim()
    .slice(0, maxLength);
}
