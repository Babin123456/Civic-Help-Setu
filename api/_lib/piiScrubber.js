/**
 * api/_lib/piiScrubber.js
 *
 * Centralized PII Redaction and Log-Scrubbing Pipeline for Serverless
 * Telemetry and Error Reporting (#1348).
 *
 * Uses bounded, linear-time / ReDoS-safe regular expressions, WeakSet
 * circular-reference tracking, and configurable key allow/deny lists.
 */

export const REDACTED_VALUE = '[REDACTED]';
export const CIRCULAR_VALUE = '[CIRCULAR]';
export const MAX_DEPTH_VALUE = '[MAX_DEPTH]';

const DEFAULT_MAX_DEPTH = 12;
const DEFAULT_MAX_STRING_LENGTH = 8192;

export const DEFAULT_SENSITIVE_KEYS = Object.freeze([
  'password',
  'passcode',
  'pin',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'aadhaar',
  'aadhar',
  'pan',
  'phone',
  'mobile',
  'phonenumber',
  'email',
  'address',
  'dob',
  'dateofbirth',
  'ip',
  'ipaddress',
  'x-forwarded-for',
  'x-real-ip',
]);

// Bounded, linear-time patterns (no nested quantifiers) to prevent ReDoS.
const PII_STRING_PATTERNS = Object.freeze([
  { name: 'bearer_jwt', regex: /\bBearer\s+[A-Za-z0-9._-]{10,512}\b/gi, replacement: '[REDACTED:TOKEN]' },
  { name: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{8,256}\.[A-Za-z0-9_-]{8,256}\.[A-Za-z0-9_-]{8,256}\b/g, replacement: '[REDACTED:JWT]' },
  { name: 'google_api_key', regex: /\bAIza[0-9A-Za-z_-]{30,45}\b/g, replacement: '[REDACTED:API_KEY]' },
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,128}\.[A-Za-z]{2,24}\b/g, replacement: '[REDACTED:EMAIL]' },
  { name: 'pan', regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, replacement: '[REDACTED:PAN]' },
  { name: 'aadhaar', regex: /\b[2-9][0-9]{3}(?:[ -]?[0-9]{4}){2}\b/g, replacement: '[REDACTED:AADHAAR]' },
  { name: 'phone_in', regex: /(?:\+91[- ]?)?[6-9][0-9]{9}\b/g, replacement: '[REDACTED:PHONE]' },
]);

function normalizeKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Scrubs PII/secrets from a string using ReDoS-safe patterns.
 */
export function scrubString(input, { maxStringLength = DEFAULT_MAX_STRING_LENGTH, customPatterns = [] } = {}) {
  if (typeof input !== 'string') return input;
  const bounded = input.length > maxStringLength ? input.slice(0, maxStringLength) : input;
  let result = bounded;
  for (const { regex, replacement } of PII_STRING_PATTERNS) {
    result = result.replace(regex, replacement);
  }
  for (const { regex, replacement } of customPatterns) {
    result = result.replace(regex, replacement || REDACTED_VALUE);
  }
  return result;
}

/**
 * Recursively scrubs PII and sensitive keys from arbitrary telemetry/log objects.
 */
export function scrubPii(value, options = {}) {
  const {
    sensitiveKeys = DEFAULT_SENSITIVE_KEYS,
    allowKeys = ['correlationid', 'traceid', 'spanid', 'route', 'status', 'code', 'event'],
    maxDepth = DEFAULT_MAX_DEPTH,
    maxStringLength = DEFAULT_MAX_STRING_LENGTH,
    customPatterns = [],
    onRedaction = null,
  } = options;

  const sensitiveSet = new Set(sensitiveKeys.map(normalizeKey));
  const allowSet = new Set(allowKeys.map(normalizeKey));
  const seen = new WeakSet();

  function walk(node, depth) {
    if (node === null || node === undefined) return node;
    if (typeof node === 'string') {
      const scrubbed = scrubString(node, { maxStringLength, customPatterns });
      if (scrubbed !== node && onRedaction) {
        onRedaction({ type: 'pattern' });
      }
      return scrubbed;
    }
    if (typeof node === 'number' || typeof node === 'boolean') return node;
    if (typeof node === 'bigint') return String(node);
    if (node instanceof Date) return node.toISOString();
    if (node instanceof Error) {
      return {
        name: node.name,
        message: scrubString(node.message || '', { maxStringLength, customPatterns }),
        ...(node.code ? { code: node.code } : {}),
      };
    }
    if (typeof node !== 'object') return String(node);

    if (seen.has(node)) return CIRCULAR_VALUE;
    if (depth >= maxDepth) return MAX_DEPTH_VALUE;
    seen.add(node);

    if (Array.isArray(node)) {
      return node.map((item) => walk(item, depth + 1));
    }

    const out = {};
    for (const [rawKey, rawVal] of Object.entries(node)) {
      const norm = normalizeKey(rawKey);
      if (!allowSet.has(norm) && sensitiveSet.has(norm)) {
        out[rawKey] = REDACTED_VALUE;
        if (onRedaction) onRedaction({ type: 'key', key: rawKey });
      } else {
        out[rawKey] = walk(rawVal, depth + 1);
      }
    }
    return out;
  }

  return walk(value, 0);
}

/**
 * Wraps a structured logger so every emitted event is deterministically scrubbed.
 */
export function createScrubbingLogger(baseLogger = (event) => console.error(event), options = {}) {
  return function scrubbedLog(event) {
    try {
      return baseLogger(scrubPii(event, options));
    } catch {
      return baseLogger({ event: 'scrubbed_log_fallback', error: 'Scrubber failed safely' });
    }
  };
}
