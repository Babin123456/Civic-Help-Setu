/**
 * Helpers for anything that leaves the browser for a third party.
 *
 * redactSecrets       tokens, session/user ids and key-looking strings
 * redactPersonalData  Aadhaar, PAN, phone, email, voter/passport numbers,
 *                     app reference IDs (SRV-, GRV-, TKN-) and coordinates
 * minimizeForExternal both of the above, for text that is about to be sent or logged
 * stripUrlForSharing  origin + path only, no query string or fragment
 *
 * Patterns are deliberately a bit greedy: over-redacting a log line is fine,
 * letting a phone number through to another service is not.
 */

const SECRET_PATTERNS = [
  // JWT-like (header.payload.signature) and a bare "eyJ..." prefix
  /\beyJ[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]+){0,2}/g,
  // Clerk / Stripe style secret and publishable keys
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+/g,
  // OpenAI style key
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  // Google API key
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  // Clerk object ids: sess_..., user_..., client_..., org_...
  /\b(?:sess|user|client|org|sia|idn|oauth|ac)_[A-Za-z0-9]{3,}/g,
  // Authorization headers
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  // key=value / key: value pairs that name a credential
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|password|authorization|__clerk_db_jwt)\s*[:=]\s*["']?[^\s"',;&]+/gi,
];

const PERSONAL_PATTERNS = [
  // email
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]'],
  // Indian mobile numbers (before Aadhaar, so +91 98... is not read as 12 digits), with or without +91 / 0 prefix
  [/(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/g, '[REDACTED_PHONE]'],
  // Aadhaar: 12 digits, optionally grouped 4-4-4
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_AADHAAR]'],
  // PAN: AAAAA9999A
  [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, '[REDACTED_PAN]'],
  // Voter ID (EPIC): 3 letters + 7 digits
  [/\b[A-Z]{3}[0-9]{7}\b/gi, '[REDACTED_ID]'],
  // Passport: 1 letter + 7 digits
  [/\b[A-PR-WY][0-9]{7}\b/gi, '[REDACTED_ID]'],
  // App reference ids: SRV-98234710, GRV-2026-123456, TKN-123456
  [/\b(?:SRV|GRV|TKN)-[A-Z0-9-]{4,}\b/gi, '[REDACTED_REF]'],
  // lat, lng pairs with decimals
  [/-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g, '[REDACTED_LOCATION]'],
];

export const redactSecrets = (text = '') => {
  if (text === null || text === undefined) return '';
  return SECRET_PATTERNS.reduce((out, re) => out.replace(re, '[REDACTED_SECRET]'), String(text));
};

export const redactPersonalData = (text = '') => {
  if (text === null || text === undefined) return '';
  return PERSONAL_PATTERNS.reduce((out, [re, label]) => out.replace(re, label), String(text));
};

export const minimizeForExternal = (text = '') => redactPersonalData(redactSecrets(text));

/**
 * Keeps only origin and path. Query strings and fragments are where ids,
 * tokens and search terms end up, and they do not belong in a URL that is
 * handed to a third party (QR generator, share link, referrer).
 */
export const stripUrlForSharing = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '';
  }
};
