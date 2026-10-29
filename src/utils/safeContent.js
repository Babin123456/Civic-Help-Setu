/**
 * Safe handling of content that comes from data rather than from our code: service guides saved
 * by an admin, notices, community reports, FAQs, source links.
 *
 * Policy: dynamic content is PLAIN TEXT. It is rendered as React children (React escapes it), never
 * written into the page as markup, and a test fails if code that does so appears. Links
 * built from data must go through safeHttpUrl. If rich text is ever needed, use a maintained
 * allow-list sanitizer (DOMPurify) with the allow-list documented in docs/CONTENT_SAFETY.md; do not
 * write a regex sanitizer.
 *
 * The helpers here are defence in depth for data that was stored (or edited in the browser) before
 * it reaches a component:
 *
 *   sanitizePlainText   removes anything that parses as an HTML tag, comment or script/style block,
 *                       and control characters. A lone "<" or ">" and text like "fee < 500" stay.
 *   sanitizeTextFields  the same for every string inside an object or array
 *   safeHttpUrl         an http(s) URL or '' (never javascript:, data:, vbscript:, file: ...)
 *   safeContactHref     a tel: or mailto: link built from a value, or ''
 */

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g;

const BLOCKS = /<(script|style|iframe|object|embed|template|noscript|svg|math)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;
const COMMENTS = /<!--[\s\S]*?(?:-->|$)/g;
// "<" + optional "/" + a letter (no space between, as in a browser), up to the closing ">", is a tag.
// "<500", "a < b", "x > y" and a "<" that is never closed in the middle of a sentence are not, and
// stay. An unclosed tag at the very end of the text is removed too, because a browser would drop it
// or glue it to whatever follows. "<name@example.org>" (an email in brackets) is kept.
const TAGS = /<\/?[A-Za-z][^<>]*(?:>|$)/g;
const BRACKETED_EMAIL = /^<[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>$/;
const DECLARATIONS = /<[!?][^>]*>?/g;

const DEFAULT_MAX = 5000;

/**
 * @param {unknown} value
 * @param {{ max?: number, multiline?: boolean }} [options]
 */
export const sanitizePlainText = (value, { max = DEFAULT_MAX, multiline = true } = {}) => {
  if (typeof value !== 'string') return value === null || value === undefined ? '' : String(value);
  let text = value.replace(CONTROL_CHARS, '');
  // Removing a tag can join the pieces of another one ("<scr<script>ipt>"), so repeat to a fixed point.
  for (let i = 0; i < 5; i += 1) {
    const next = text.replace(COMMENTS, '').replace(BLOCKS, '').replace(DECLARATIONS, '').replace(TAGS, (tag) => (BRACKETED_EMAIL.test(tag) ? tag : ''));
    if (next === text) break;
    text = next;
  }
  if (!multiline) text = text.replace(/\s+/g, ' ');
  return text.trim().slice(0, max);
};

/**
 * Applies sanitizePlainText to every string in a value, keeping its shape. Keys are not changed.
 * Non-string leaves (numbers, booleans) pass through; very deep structures are cut off.
 */
export const sanitizeTextFields = (value, depth = 0) => {
  if (typeof value === 'string') return sanitizePlainText(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 6) return Array.isArray(value) ? [] : {};
  if (Array.isArray(value)) return value.map((item) => sanitizeTextFields(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = sanitizeTextFields(item, depth + 1);
  return out;
};

// eslint-disable-next-line no-control-regex -- control characters are rejected on purpose
const HAS_CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/**
 * Returns the normalized URL if it is http or https with no embedded credentials, otherwise ''.
 * Tabs and line breaks inside the value are rejected: browsers delete them, so "java\tscript:" would
 * otherwise slip past a check on the raw string.
 */
export const safeHttpUrl = (value) => {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > 2048 || HAS_CONTROL.test(text)) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (url.username || url.password || !url.hostname) return '';
    return url.href;
  } catch {
    return '';
  }
};

/** "tel:+911234567890" from a phone-like value, or ''. Only digits, +, spaces, dashes and brackets. */
export const safeTelHref = (value) => {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!/^\+?[\d\s()-]{3,20}$/.test(text)) return '';
  return `tel:${text.replace(/[\s()-]/g, '')}`;
};

/** "mailto:name@example.org" from an email-like value, or ''. */
export const safeMailtoHref = (value) => {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/.test(text) ? `mailto:${text}` : '';
};
