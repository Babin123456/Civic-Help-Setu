/**
 * src/services/grievanceCompletenessCoachService.js
 *
 * Public Grievance Language Quality and Completeness Coach (#1444).
 *
 * Extends src/services/complaintQualityCoachService.js and
 * src/services/piiLeakageGuardService.js to provide:
 * - Missing-field detection (date, location, requestedOutcome, supportingReference)
 * - Neutral wording suggestions without inventing facts or altering citizen intent
 * - Verbatim preservation of original citizen text
 * - Multilingual coaching prompts (en, hi, bn, ta)
 * - Explicit user approval required for every suggestion
 * - Zero-PII & sensitive-data exclusion
 */

import { detectDateCompleteness } from './complaintQualityCoachService.js';
import { inspectStringForPII } from './piiLeakageGuardService.js';

export const COACH_SCHEMA_VERSION = '1.0.0';

export const COACH_ORIGIN = {
  CITIZEN_DRAFT: 'citizen_entered_fact',
  AI_SUGGESTION: 'ai_community_suggestion',
  OFFICIAL_RULE: 'official_record',
};

export const MULTILINGUAL_COACH_PROMPTS = {
  en: {
    missingDate: 'Add the exact date or date range when the issue occurred.',
    missingLocation: 'Include the ward number, street name, or nearest landmark.',
    missingOutcome: 'State the specific action or resolution you are requesting.',
    missingReference: 'Add any ticket number, bill ID, or photo reference if available.',
  },
  hi: {
    missingDate: 'कृपया समस्या होने की सटीक तिथि या समय अवधि जोड़ें।',
    missingLocation: 'कृपया वार्ड संख्या, गली का नाम या नज़दीकी पहचान चिह्न शामिल करें।',
    missingOutcome: 'कृपया बताएं कि आप किस ठोस कार्रवाई या समाधान का अनुरोध कर रहे हैं।',
    missingReference: 'यदि उपलब्ध हो तो शिकायत संख्या, बिल आईडी या फ़ोटो संदर्भ जोड़ें।',
  },
  bn: {
    missingDate: 'সমস্যাটি ঘটার সঠিক তারিখ বা সময়কাল উল্লেখ করুন।',
    missingLocation: 'ওয়ার্ড নম্বর, রাস্তার নাম বা কাছাকাছি ল্যান্ডমার্ক যোগ করুন।',
    missingOutcome: 'আপনি কী নির্দিষ্ট সমাধান বা পদক্ষেপ চাইছেন তা স্পষ্ট করুন।',
    missingReference: 'থাকলে রেফারেন্স নম্বর, বিল আইডি বা ছবির তথ্য দিন।',
  },
  ta: {
    missingDate: 'சிக்கல் ஏற்பட்ட சரியான தேதி அல்லது கால அளவைச் சேர்க்கவும்.',
    missingLocation: 'வார்டு எண், தெருப் பெயர் அல்லது அருகிலுள்ள அடையாளத்தைக் குறிப்பிடவும்.',
    missingOutcome: 'நீங்கள் கோரும் குறிப்பிட்ட தீர்வு அல்லது நடவடிக்கையைத் தெரிவிக்கவும்.',
    missingReference: 'கிடைத்தால் குறிப்பு எண், பில் ஐடி அல்லது புகைப்பட விவரத்தைச் சேர்க்கவும்.',
  },
};

const NEUTRAL_WORDING_RULES = [
  {
    id: 'nw-corrupt',
    pattern: /\bcorrupt\b/gi,
    originalPhrase: 'corrupt',
    suggestedPhrase: 'irregularity requiring audit',
    reason: 'Replaces unverified accusation with neutral procedural phrasing without altering your complaint.',
  },
  {
    id: 'nw-useless',
    pattern: /\buseless\b/gi,
    originalPhrase: 'useless',
    suggestedPhrase: 'non-functional',
    reason: 'Uses objective condition terminology while preserving the reported defect.',
  },
  {
    id: 'nw-lazy',
    pattern: /\blazy\b/gi,
    originalPhrase: 'lazy',
    suggestedPhrase: 'delayed beyond expected timeline',
    reason: 'Focuses on observable service delay rather than personal characterization.',
  },
  {
    id: 'nw-fraud',
    pattern: /\bfraud\b/gi,
    originalPhrase: 'fraud',
    suggestedPhrase: 'discrepancy requiring verification',
    reason: 'Frames the issue for factual investigation without making a legal conclusion.',
  },
];

const SENSITIVE_KEY_REGEX = /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email)$/i;

export function sanitizeCoachText(val, maxLen = 4000) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateCoachZeroPii(payload, path = 'draft') {
  const violations = [];
  function walk(node, currentPath) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      const check = inspectStringForPII(node);
      if (!check.clean) {
        for (const v of check.violations) {
          violations.push(`${currentPath}: prohibited PII (${v.type})`);
        }
      }
      if (/\b\d{6}\b/.test(node) && /otp/i.test(currentPath)) {
        violations.push(`${currentPath}: OTP value is prohibited`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${currentPath}[${i}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        if (SENSITIVE_KEY_REGEX.test(key.trim())) {
          violations.push(`${currentPath}.${key}: sensitive field is prohibited`);
        }
        walk(val, `${currentPath}.${key}`);
      }
    }
  }
  walk(payload, path);
  return { valid: violations.length === 0, violations };
}

export function verifyCoachRuleProvenance(rule = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof rule?.[f] !== 'string' || rule[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && rule?.verified !== false;
  return {
    source: sanitizeCoachText(rule?.source || 'Unverified filing rule', 200),
    jurisdiction: sanitizeCoachText(rule?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeCoachText(rule?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeCoachText(rule?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

/**
 * Analyzes a citizen grievance draft locally/deterministically without modifying originalText
 * or applying any wording suggestions without explicit user approval.
 */
export function analyzeGrievanceDraft({
  originalText = '',
  language = 'en',
  jurisdiction = 'IN-UP',
  officialRule = {
    source: 'CPGRAMS & State Public Grievance Filing Guidelines',
    jurisdiction: 'IN-UP',
    effectiveDate: '2026-01-01',
    lastVerifiedAt: '2026-11-20T00:00:00.000Z',
  },
} = {}) {
  const piiCheck = validateCoachZeroPii({ originalText, language, jurisdiction }, 'draft');
  if (!piiCheck.valid) {
    throw new Error(`Privacy violation: ${piiCheck.violations[0]}`);
  }

  const cleanOriginal = sanitizeCoachText(originalText, 4000);
  if (cleanOriginal.length < 5) {
    throw new Error('Complaint draft must be at least 5 characters.');
  }

  const lang = MULTILINGUAL_COACH_PROMPTS[language] ? language : 'en';
  const prompts = MULTILINGUAL_COACH_PROMPTS[lang];

  const dateCheck = detectDateCompleteness(cleanOriginal);
  const hasDate = Boolean(dateCheck.hasSpecificDate);
  const hasLocation = /\b(ward|street|lane|road|sector|block|near|opposite|market|village|district|pin\s*\d{6})\b/i.test(cleanOriginal);
  const hasRequestedOutcome = /\b(request|please|repair|fix|restore|clean|resolve|refund|inspect|action|replace)\b/i.test(cleanOriginal);
  const hasSupportingRef = /\b(ticket|ref|reference|complaint\s*no|bill\s*id|photo|receipt|acknowledgement)\b/i.test(cleanOriginal);

  const missingFields = [];
  if (!hasDate) missingFields.push({ field: 'date', label: 'Incident Date', prompt: prompts.missingDate });
  if (!hasLocation) missingFields.push({ field: 'location', label: 'Location / Ward', prompt: prompts.missingLocation });
  if (!hasRequestedOutcome) missingFields.push({ field: 'requestedOutcome', label: 'Requested Outcome', prompt: prompts.missingOutcome });
  if (!hasSupportingRef) missingFields.push({ field: 'supportingReference', label: 'Supporting Reference', prompt: prompts.missingReference });

  const suggestions = [];
  for (const rule of NEUTRAL_WORDING_RULES) {
    if (rule.pattern.test(cleanOriginal)) {
      rule.pattern.lastIndex = 0;
      suggestions.push({
        id: rule.id,
        origin: COACH_ORIGIN.AI_SUGGESTION,
        originalPhrase: rule.originalPhrase,
        suggestedPhrase: rule.suggestedPhrase,
        reason: rule.reason,
        status: 'pending_approval',
      });
    }
  }

  const completenessScore = Math.round(((4 - missingFields.length) / 4) * 100);
  const now = new Date().toISOString();

  return {
    schemaVersion: COACH_SCHEMA_VERSION,
    draftId: `drf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    language: lang,
    jurisdiction: sanitizeCoachText(jurisdiction, 64),
    origin: COACH_ORIGIN.CITIZEN_DRAFT,
    originalText: cleanOriginal, // Always preserved verbatim
    approvedDraftText: cleanOriginal, // Unchanged until user explicitly approves suggestions
    completenessScore,
    missingFields,
    suggestions,
    officialRule: verifyCoachRuleProvenance(officialRule),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Applies explicit user approval or rejection for a neutral wording suggestion.
 * Never alters originalText; updates approvedDraftText only when approved.
 */
export function decideCoachSuggestion(draft, { suggestionId, decision } = {}) {
  if (!draft) throw new Error('Draft not found.');
  if (!['approve', 'reject'].includes(decision)) {
    throw new Error("decision must be 'approve' or 'reject'.");
  }

  const target = (draft.suggestions || []).find((s) => s.id === suggestionId);
  if (!target) throw new Error(`Suggestion '${suggestionId}' not found.`);

  const nextStatus = decision === 'approve' ? 'approved' : 'rejected';
  const nextSuggestions = draft.suggestions.map((s) =>
    s.id === suggestionId ? { ...s, status: nextStatus } : s
  );

  // Recompute approvedDraftText deterministically from preserved originalText + approved suggestions only
  let nextDraftText = draft.originalText;
  for (const sug of nextSuggestions) {
    if (sug.status === 'approved') {
      const rule = NEUTRAL_WORDING_RULES.find((r) => r.id === sug.id);
      if (rule) {
        nextDraftText = nextDraftText.replace(rule.pattern, sug.suggestedPhrase);
        rule.pattern.lastIndex = 0;
      }
    }
  }

  return {
    ...draft,
    suggestions: nextSuggestions,
    approvedDraftText: nextDraftText,
    updatedAt: new Date().toISOString(),
  };
}

export function migrateCoachStoreState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: COACH_SCHEMA_VERSION,
    drafts: Array.isArray(safe.drafts) ? safe.drafts : [],
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
