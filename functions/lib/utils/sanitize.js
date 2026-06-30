"use strict";
/**
 * Input sanitization utilities.
 * User-provided text must be cleaned before it touches any Gemini prompt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeText = sanitizeText;
const HTML_TAG_RE = /<[^>]*>/g;
const MULTIPLE_SPACES_RE = /\s{2,}/g;
/**
 * Strip HTML tags, collapse whitespace, truncate to maxLength.
 * Used on issues.description before including in Gemini prompt.
 */
function sanitizeText(raw, maxLength = 500) {
    return raw
        .replace(HTML_TAG_RE, "")
        .replace(MULTIPLE_SPACES_RE, " ")
        .trim()
        .slice(0, maxLength);
}
//# sourceMappingURL=sanitize.js.map