/**
 * Pre-Inference & Post-Synthesis AI Guardrail Pipeline
 *
 * Implements defense-in-depth protections for Civic Assistant workflows:
 * 1. Local pre-inference PII & secret scrubbing via dataMinimization utilities
 *    plus civic-financial identifier masking (IFSC, bank account numbers, UPI).
 * 2. Deterministic prompt-injection, instruction-override, and forced-decision
 *    detection before retrieval or synthesis.
 * 3. Post-synthesis evidence entailment verification wiring into the fail-closed
 *    entailment engine so unsupported high-risk claims surface explicit notices.
 */

import { minimizeForExternal } from '../utils/dataMinimization.js';
import {
  verifyAnswerEntailment,
  ENTAILMENT_STATUS,
} from '../services/evidenceEntailmentVerificationService.js';

export const GUARDRAIL_DECISION = Object.freeze({
  ALLOW: 'allow',
  REDACT_AND_ALLOW: 'redact_and_allow',
  BLOCK: 'block',
});

export const INJECTION_CATEGORY = Object.freeze({
  INSTRUCTION_OVERRIDE: 'instruction_override',
  SYSTEM_PROMPT_EXTRACTION: 'system_prompt_extraction',
  ROLE_MANIPULATION: 'role_manipulation',
  UNVERIFIED_DECISION_FORCING: 'unverified_decision_forcing',
});

const OFFICIAL_PORTAL_SOURCE = Object.freeze({
  name: 'National Government Services Portal (Services.india.gov.in)',
  url: 'https://services.india.gov.in',
  verified: true,
});

const FALLBACK_DISCLAIMER =
  'This guidance is strictly based on verified government guidelines in our database. It does not constitute legal advice or an official eligibility decision.';

const PII_CATEGORY_DETECTORS = [
  {
    category: 'AADHAAR',
    pattern: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/,
  },
  {
    category: 'PAN',
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/i,
  },
  {
    category: 'VOTER_ID',
    pattern: /\b[A-Z]{3}\d{7}\b/i,
  },
  {
    category: 'PASSPORT',
    pattern: /\b[A-Z]\d{7}\b/i,
  },
  {
    category: 'PHONE',
    pattern: /(?:\+91[\s-]?)?\b[6-9]\d{9}\b/,
  },
  {
    category: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  },
  {
    category: 'SERVICE_REFERENCE',
    pattern: /\b(?:SRV|GRV|TKN)-[A-Z0-9-]+\b/i,
  },
  {
    category: 'COORDINATES',
    pattern: /\b-?\d{1,2}\.\d{4,},\s*-?\d{1,3}\.\d{4,}\b/,
  },
  {
    category: 'IFSC',
    pattern: /\b[A-Za-z]{4}0[A-Za-z0-9]{6}\b/,
  },
  {
    category: 'BANK_ACCOUNT',
    pattern: /\b(?:bank\s+)?(?:account|acct|a\/c)\s*(?:no\.?|number|#|:|-)?\s*\d{9,18}\b/i,
  },
  {
    category: 'UPI',
    pattern: /\b[a-z0-9._-]{2,}@(?:oksbi|okaxis|okicici|okhdfcbank|ybl|ibl|axl|paytm|upi)\b/i,
  },
  {
    category: 'SECRET',
    pattern: /\b(?:Bearer\s+[A-Za-z0-9\-._~+/]+=*|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,}|sk_(?:live|test)_[A-Za-z0-9]{8,})\b/i,
  },
];

const INJECTION_RULES = [
  {
    id: 'INJ_INSTRUCTION_OVERRIDE',
    category: INJECTION_CATEGORY.INSTRUCTION_OVERRIDE,
    reason: 'Attempt to override system instructions or grounding constraints.',
    pattern:
      /\b(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:previous|prior|above|system|developer|grounding|safety|verification)\s+(?:instructions?|rules?|prompts?|guidelines?|policies|checks?)\b/i,
  },
  {
    id: 'INJ_IGNORE_OFFICIAL_SOURCES',
    category: INJECTION_CATEGORY.INSTRUCTION_OVERRIDE,
    reason: 'Attempt to disable official government source verification.',
    pattern:
      /\b(?:ignore|skip|bypass|disable)\s+(?:the\s+)?(?:(?:official|government|verified)\s+){1,2}(?:sources?|guidelines?|rules?|database|verification)\b/i,
  },
  {
    id: 'INJ_SYSTEM_PROMPT_EXTRACT',
    category: INJECTION_CATEGORY.SYSTEM_PROMPT_EXTRACTION,
    reason: 'Attempt to extract hidden system or developer instructions.',
    pattern:
      /\b(?:reveal|show|print|dump|repeat|output|expose|leak)\s+(?:me\s+)?(?:your\s+|the\s+)?(?:hidden\s+)?(?:system|developer|internal)\s+(?:prompt|instructions?|rules?|policy)\b/i,
  },
  {
    id: 'INJ_ROLE_MANIPULATION',
    category: INJECTION_CATEGORY.ROLE_MANIPULATION,
    reason: 'Attempt to switch persona to an unrestricted or unverified mode.',
    pattern:
      /\b(?:(?:act|pretend|behave|respond)\s+as\s+(?:an?\s+)?(?:unrestricted|unfiltered|jailbroken|dan)\b|(?:enter|enable|switch\s+to)\s+(?:developer|jailbreak|unrestricted|god)\s+mode\b|you\s+are\s+now\s+dan\b)/i,
  },
  {
    id: 'INJ_FORCED_DECISION',
    category: INJECTION_CATEGORY.UNVERIFIED_DECISION_FORCING,
    reason: 'Attempt to force an unverified eligibility approval or fabricate official fees/links.',
    pattern:
      /\b(?:(?:approve|guarantee|confirm)\s+my\s+(?:(?:passport|visa|pension|ration\s+card|birth\s+certificate|driving\s+license|aadhaar|pan)\s+)?(?:application|passport|visa|pension|ration\s+card|eligibility|claim|request)\s+(?:unconditionally|automatically|without\s+(?:documents?|verification|proof))|(?:fabricate|invent|make\s+up)\s+(?:a|an|official)?\s*(?:fee|deadline|portal|url|rule|eligibility))\b/i,
  },
];

const redactCivicFinancialIdentifiers = (text) =>
  String(text || '')
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b/gi, '[REDACTED_SECRET]')
    .replace(/\b[A-Za-z]{4}0[A-Za-z0-9]{6}\b/g, '[REDACTED_IFSC]')
    .replace(
      /\b((?:bank\s+)?(?:account|acct|a\/c)\s*(?:no\.?|number|#|:|-)?\s*)\d{9,18}\b/gi,
      '$1[REDACTED_ACCOUNT]'
    )
    .replace(
      /\b[a-z0-9._-]{2,}@(?:oksbi|okaxis|okicici|okhdfcbank|ybl|ibl|axl|paytm|upi)\b/gi,
      '[REDACTED_UPI]'
    );

export const stripRedactionPlaceholders = (text = '') =>
  String(text || '')
    .replace(/\[REDACTED_[A-Z0-9_]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const detectRedactionCategories = (text) => {
  const categories = [];
  for (const detector of PII_CATEGORY_DETECTORS) {
    if (detector.pattern.test(text)) {
      categories.push(detector.category);
    }
  }
  return categories;
};

/**
 * Scrubs PII and credentials from an outbound citizen query before storage,
 * retrieval, or echo back to the user.
 *
 * @param {string} rawQuery
 * @returns {Object} Redaction result without storing any raw sensitive values
 */
export function analyzeAndSanitizeQuery(rawQuery = '') {
  const trimmed = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!trimmed) {
    return {
      originalLength: 0,
      sanitizedQuery: '',
      wasRedacted: false,
      redactedCategories: [],
      redactionCount: 0,
      notice: null,
    };
  }

  // Mask civic-financial and prefixed key tokens first so 10-12 digit account
  // numbers are preserved as [REDACTED_ACCOUNT] instead of [REDACTED_AADHAAR].
  const financialMasked = redactCivicFinancialIdentifiers(trimmed);
  const financialCategories =
    financialMasked !== trimmed
      ? detectRedactionCategories(trimmed).filter((c) =>
          ['IFSC', 'BANK_ACCOUNT', 'UPI', 'SECRET'].includes(c)
        )
      : [];

  const sanitizedQuery = minimizeForExternal(financialMasked).trim();
  const baseCategories =
    sanitizedQuery !== financialMasked
      ? detectRedactionCategories(financialMasked)
      : [];

  const wasRedacted = sanitizedQuery !== trimmed;
  const detectedCategories = Array.from(
    new Set([...financialCategories, ...baseCategories])
  );
  const redactedCategories = wasRedacted && detectedCategories.length === 0
    ? ['SENSITIVE_IDENTIFIER']
    : detectedCategories;

  return {
    originalLength: trimmed.length,
    sanitizedQuery,
    wasRedacted,
    redactedCategories,
    redactionCount: redactedCategories.length,
    notice: wasRedacted
      ? `Privacy guardrail active: sensitive personal or financial details (${redactedCategories.join(', ')}) were redacted locally before processing or storing your message.`
      : null,
  };
}

/**
 * Deterministic pre-inference check for prompt-injection, instruction override,
 * system-prompt extraction, and forced unverified eligibility claims.
 *
 * @param {string} query
 * @returns {Object}
 */
export function detectPromptInjection(query = '') {
  const normalized = typeof query === 'string' ? query.trim() : '';
  if (!normalized) {
    return {
      blocked: false,
      riskLevel: 'none',
      category: null,
      ruleId: null,
      reason: null,
    };
  }

  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        blocked: true,
        riskLevel: 'high',
        category: rule.category,
        ruleId: rule.id,
        reason: rule.reason,
      };
    }
  }

  return {
    blocked: false,
    riskLevel: 'none',
    category: null,
    ruleId: null,
    reason: null,
  };
}

/**
 * Builds a structured fail-closed assistant response when prompt injection or
 * policy-override manipulation is detected.
 *
 * @param {Object} injectionResult
 * @param {Object} options
 * @returns {Object}
 */
export function buildBlockedGuardrailResponse(injectionResult, options = {}) {
  const disclaimer = options.disclaimer || FALLBACK_DISCLAIMER;
  const categoryLabel = injectionResult?.category || INJECTION_CATEGORY.INSTRUCTION_OVERRIDE;

  return {
    status: 'blocked',
    grounded: false,
    confidenceScore: 0,
    data: {
      title: 'Request Blocked by AI Safety Guardrail',
      summary:
        'For citizen safety and policy accuracy, Civic-Help-Setu cannot bypass verification rules, reveal internal instructions, or issue unverified approvals. Please ask a direct civic service question.',
      missingInformationNotice: `Safety Guardrail (${categoryLabel}): ${injectionResult?.reason || 'Query violated grounded verification constraints.'}`,
      officialSources: [OFFICIAL_PORTAL_SOURCE],
      disclaimer,
      isGrounded: false,
    },
    serviceId: null,
    suggestions: [
      'What documents are required for a Passport?',
      'How to register a Birth Certificate?',
      'What are the steps for Driving License renewal?',
    ],
  };
}

/**
 * Runs the complete pre-inference guardrail stage (PII/secret sanitization +
 * prompt-injection inspection) prior to retrieval or fallback routing.
 *
 * @param {string} rawQuery
 * @param {Object} options
 * @returns {Object}
 */
export function runPreInferenceGuardrails(rawQuery = '', options = {}) {
  const pii = analyzeAndSanitizeQuery(rawQuery);
  const injection = detectPromptInjection(pii.sanitizedQuery);

  if (injection.blocked) {
    return {
      decision: GUARDRAIL_DECISION.BLOCK,
      sanitizedQuery: pii.sanitizedQuery,
      pii,
      injection,
      blockedResponse: buildBlockedGuardrailResponse(injection, options),
    };
  }

  return {
    decision: pii.wasRedacted
      ? GUARDRAIL_DECISION.REDACT_AND_ALLOW
      : GUARDRAIL_DECISION.ALLOW,
    sanitizedQuery: pii.sanitizedQuery,
    pii,
    injection,
    blockedResponse: null,
  };
}

const splitChunkSentences = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const sentences = raw
    .split(/(?<=[.!?])\s+(?=[A-Z0-9([])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.length > 0 ? sentences : [raw];
};

const normalizeEvidenceChunks = (chunks) => {
  const units = [];
  chunks.forEach((chunk, index) => {
    const baseId = chunk.chunkId || chunk.id || `chunk-${index + 1}`;
    const title = chunk.sectionTitle || chunk.title || 'Verified Section';
    const rawText = String(chunk.content || chunk.excerpt || chunk.text || '').trim();
    const sourceUrl = chunk.officialSource?.url || chunk.sourceUrl || '';
    if (!rawText) return;

    const sentences = splitChunkSentences(rawText);
    if (sentences.length <= 1) {
      units.push({ id: baseId, title, text: rawText, sourceUrl });
      return;
    }

    sentences.forEach((sentence, sIdx) => {
      units.push({
        id: `${baseId}#s${sIdx + 1}`,
        title,
        text: sentence,
        sourceUrl,
      });
    });
  });
  return units;
};

const stripSectionHeadingPrefix = (answerText) =>
  String(answerText || '')
    .split('\n')
    .map((line) => line.replace(/^\[[^\]]+\]:\s*/, '').trim())
    .filter(Boolean)
    .join(' ');

/**
 * Post-synthesis guardrail: verifies synthesized answer claims against
 * retrieved evidence chunks and fails closed when high-risk claims lack support.
 *
 * @param {string} answerText
 * @param {Array} retrievedChunks
 * @param {Object} options
 * @returns {Object}
 */
export function evaluateGroundedAnswerEntailment(
  answerText = '',
  retrievedChunks = [],
  options = {}
) {
  const normalizedEvidence = Array.isArray(retrievedChunks)
    ? normalizeEvidenceChunks(retrievedChunks)
    : [];

  const cleanedAnswer = stripSectionHeadingPrefix(answerText);

  if (!cleanedAnswer || normalizedEvidence.length === 0) {
    return {
      verifiedCount: 0,
      unsupportedCount: cleanedAnswer ? 1 : 0,
      contradictedCount: 0,
      overallSupported: false,
      failClosedNotice:
        'Verification Notice: Supporting official evidence chunks were unavailable to verify claims in this answer.',
      sanitizedAnswer: cleanedAnswer,
      claims: [],
    };
  }

  const verification = verifyAnswerEntailment(cleanedAnswer, normalizedEvidence, options);
  const hasContradiction = verification.contradictedCount > 0;
  const highRiskGap = verification.claims.some(
    (c) =>
      c.status !== ENTAILMENT_STATUS.SUPPORTED &&
      c.riskCategory !== 'general_fact'
  );

  let failClosedNotice = verification.failClosedNotice || null;
  if (!failClosedNotice && !verification.overallSupported && (hasContradiction || highRiskGap)) {
    failClosedNotice =
      'Verification Notice: Some statements could not be fully verified against retrieved government sources. Please confirm details on the official portal.';
  }

  return {
    verifiedCount: verification.verifiedCount,
    unsupportedCount: verification.unsupportedCount,
    contradictedCount: verification.contradictedCount,
    overallSupported: verification.overallSupported,
    failClosedNotice,
    sanitizedAnswer: verification.sanitizedAnswer,
    claims: verification.claims,
  };
}
