/**
 * Input sanitization utilities.
 * User-provided text must be cleaned before it touches any Gemini prompt.
 */

const HTML_TAG_RE = /<[^>]*>/g;
const MULTIPLE_SPACES_RE = /\s{2,}/g;

/**
 * Strip HTML tags, collapse whitespace, truncate to maxLength.
 * Used on issues.description before including in Gemini prompt.
 */
export function sanitizeText(raw: string, maxLength = 500): string {
  return raw
    .replace(HTML_TAG_RE, "")
    .replace(MULTIPLE_SPACES_RE, " ")
    .trim()
    .slice(0, maxLength);
}
