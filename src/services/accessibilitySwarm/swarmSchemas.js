/**
 * Multi-Modal Civic Accessibility Testing Agent Swarm: Versioned Schemas and Constants (#1177)
 *
 * Strict Architectural Guarantees:
 * - Versioned contracts (SCHEMA_VERSION = '1.0.0')
 * - Input validation and sanitization at trust boundaries
 * - AI outputs tagged as UNVERIFIED suggestions requiring human approval for subjective items
 * - Zero citizen PII exposure (synthetic fixtures, strict scrubbing)
 * - Safe error handling, rate limiting & concurrency protection
 */

export const SCHEMA_VERSION = '1.0.0';

export const AGENT_MODALITIES = Object.freeze({
  KEYBOARD: 'keyboard',
  SCREEN_READER: 'screen_reader',
  CONTRAST: 'contrast',
  LANGUAGE_CLARITY: 'language_clarity',
  MOBILE_LAYOUT: 'mobile_layout'
});

export const FINDING_SEVERITY = Object.freeze({
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
});

export const AUDIT_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
});

export const VERIFICATION_STATUS = Object.freeze({
  AUTOMATED_VERIFIED: 'automated_verified', // Deterministic rule pass/fail
  UNVERIFIED_SUGGESTION: 'unverified_suggestion', // Subjective / AI suggestion
  HUMAN_APPROVED: 'human_approved', // Explicit maintainer sign-off
  HUMAN_REJECTED: 'human_rejected' // Discarded as false-positive
});

export const WCAG_LEVEL = Object.freeze({
  A: 'A',
  AA: 'AA',
  AAA: 'AAA'
});

export const SWARM_LIMITS = Object.freeze({
  MAX_DOM_LENGTH: 250000, // 250KB max DOM snippet / payload
  MAX_AGENTS_CONCURRENT: 5,
  AGENT_TIMEOUT_MS: 4500,
  SWARM_MAX_RETRIES: 2,
  MAX_FINDINGS_PER_PAGE: 100
});

// Regular expressions to scrub citizen PII (Aadhaar, PAN, Phone, Email)
export const PII_SCRUB_PATTERNS = [
  { name: 'AADHAAR', regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g, replacement: '[REDACTED_AADHAAR]' },
  { name: 'PAN', regex: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g, replacement: '[REDACTED_PAN]' },
  { name: 'PHONE', regex: /(?:\+91[\s-]?)?[6789]\d{9}\b/g, replacement: '[REDACTED_PHONE]' },
  { name: 'EMAIL', regex: /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, replacement: '[REDACTED_EMAIL]' }
];

/**
 * Validates audit target payload at trust boundaries
 * @param {Object} input
 * @returns {{ valid: boolean, error?: string, sanitized?: Object }}
 */
export function validateAuditTargetInput(input) {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Target input must be a non-null object' };
  }

  const { targetUrl, pageTitle, domSnapshot, activeModalities, viewport } = input;

  if (targetUrl && typeof targetUrl !== 'string') {
    return { valid: false, error: 'targetUrl must be a string' };
  }

  if (targetUrl && !/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('/')) {
    return { valid: false, error: 'targetUrl must start with http://, https:// or /' };
  }

  if (domSnapshot && typeof domSnapshot !== 'string') {
    return { valid: false, error: 'domSnapshot must be a valid HTML string' };
  }

  if (domSnapshot && domSnapshot.length > SWARM_LIMITS.MAX_DOM_LENGTH) {
    return { valid: false, error: `domSnapshot exceeds maximum allowed length of ${SWARM_LIMITS.MAX_DOM_LENGTH} chars` };
  }

  const modalities = Array.isArray(activeModalities) && activeModalities.length > 0
    ? activeModalities.filter(m => Object.values(AGENT_MODALITIES).includes(m))
    : Object.values(AGENT_MODALITIES);

  return {
    valid: true,
    sanitized: {
      targetUrl: targetUrl ? targetUrl.trim() : '/services/application',
      pageTitle: pageTitle ? String(pageTitle).slice(0, 150).trim() : 'Civic Service Page',
      domSnapshot: sanitizeAndScrubContent(domSnapshot || ''),
      activeModalities: modalities,
      viewport: viewport && typeof viewport === 'object' ? {
        width: Math.max(320, Math.min(2560, Number(viewport.width) || 375)),
        height: Math.max(480, Math.min(1600, Number(viewport.height) || 667))
      } : { width: 375, height: 667 } // mobile-first default
    }
  };
}

/**
 * Sanitizes and scrubs PII from text or DOM fragments
 * @param {string} text
 * @returns {string}
 */
export function sanitizeAndScrubContent(text = '') {
  if (typeof text !== 'string') return '';
  let sanitized = text;
  for (const { regex, replacement } of PII_SCRUB_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

/**
 * Builds a canonical finding object with provenance
 * @param {Object} params
 * @returns {Object}
 */
export function createCanonicalFinding({
  id,
  modality,
  ruleId,
  wcagCriterion = '1.3.1',
  wcagLevel = WCAG_LEVEL.AA,
  severity = FINDING_SEVERITY.MEDIUM,
  title,
  description,
  domSelector = '',
  domSnippet = '',
  remedyRecommendation = '',
  isSubjective = false,
  provenance = {}
}) {
  const verifiedStatus = isSubjective
    ? VERIFICATION_STATUS.UNVERIFIED_SUGGESTION
    : VERIFICATION_STATUS.AUTOMATED_VERIFIED;

  return {
    id: id || `find_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    schemaVersion: SCHEMA_VERSION,
    modality,
    ruleId,
    wcagCriterion,
    wcagLevel,
    severity,
    title: sanitizeAndScrubContent(title || 'Accessibility Finding'),
    description: sanitizeAndScrubContent(description || ''),
    evidence: {
      domSelector: String(domSelector || '').slice(0, 300),
      domSnippet: sanitizeAndScrubContent(String(domSnippet || '').slice(0, 500))
    },
    remedyRecommendation: sanitizeAndScrubContent(remedyRecommendation || ''),
    isSubjective: Boolean(isSubjective),
    verificationStatus: verifiedStatus,
    provenance: {
      generator: provenance.generator || 'deterministic_rule_engine',
      modelUsed: provenance.modelUsed || null,
      timestamp: provenance.timestamp || new Date().toISOString(),
      confidence: typeof provenance.confidence === 'number' ? provenance.confidence : 1.0,
      requiresHumanSignoff: Boolean(isSubjective)
    }
  };
}
