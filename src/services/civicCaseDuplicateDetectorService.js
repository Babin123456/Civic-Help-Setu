/**
 * src/services/civicCaseDuplicateDetectorService.js
 *
 * Civic Application Duplicate & Related-Case Detector (#1427).
 *
 * Uses explainable signals (category, jurisdiction, time window, and
 * user-confirmed reference IDs) to suggest duplicates/related cases while:
 *   - Requiring explicit human confirmation before linking.
 *   - Preserving separate case IDs (never silently merging/deleting).
 *   - Enforcing zero PII (no Aadhaar, PAN, personal phone, or biometrics).
 *   - Providing precision/recall evaluation on synthetic fixtures.
 */

export const CASE_LINKS_STORAGE_KEY = 'civicbridge_case_duplicate_links_v1';
export const CASE_LINK_AUDIT_KEY = 'civicbridge_case_duplicate_audit_v1';

export const LINK_DECISIONS = Object.freeze({
  LINK_DUPLICATE: 'LINK_DUPLICATE',
  LINK_RELATED: 'LINK_RELATED',
  MARK_DISTINCT: 'MARK_DISTINCT',
});

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_RE = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;

export function hasForbiddenPII(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input || {});
  return AADHAAR_RE.test(s) || PAN_RE.test(s) || PHONE_RE.test(s);
}

export function detectDuplicateAndRelatedCases(
  candidateCase = {},
  existingCases = [],
  { timeWindowDays = 30, minConfidence = 0.45 } = {}
) {
  if (hasForbiddenPII(candidateCase)) {
    throw new Error('Case payload must not contain Aadhaar, PAN, or personal phone numbers.');
  }

  const candCat = String(candidateCase.category || '').trim().toLowerCase();
  const candJur = String(candidateCase.jurisdiction || '').trim().toLowerCase();
  const candRef = String(candidateCase.confirmedReferenceId || '').trim().toLowerCase();
  const candTime = candidateCase.submittedAt ? new Date(candidateCase.submittedAt).getTime() : Date.now();
  const windowMs = Math.max(1, Number(timeWindowDays)) * 24 * 60 * 60 * 1000;

  const suggestions = [];

  for (const existing of existingCases) {
    if (!existing || existing.caseId === candidateCase.caseId) continue;

    const reasons = [];
    let score = 0;

    // 1. Category match (0.30)
    const exCat = String(existing.category || '').trim().toLowerCase();
    if (candCat && exCat && candCat === exCat) {
      score += 0.3;
      reasons.push(`Same category (${existing.category})`);
    }

    // 2. Jurisdiction match (0.25)
    const exJur = String(existing.jurisdiction || '').trim().toLowerCase();
    if (candJur && exJur && candJur === exJur) {
      score += 0.25;
      reasons.push(`Same jurisdiction (${existing.jurisdiction})`);
    }

    // 3. Time window proximity (0.20)
    const exTime = existing.submittedAt ? new Date(existing.submittedAt).getTime() : candTime;
    const diffMs = Math.abs(candTime - exTime);
    if (diffMs <= windowMs) {
      const proximity = Number((0.2 * (1 - diffMs / (windowMs * 1.25))).toFixed(3));
      score += proximity;
      const daysApart = Math.round(diffMs / (24 * 60 * 60 * 1000));
      reasons.push(`Submitted within ${daysApart} day(s)`);
    }

    // 4. User-confirmed reference ID match (0.25)
    const exRef = String(existing.confirmedReferenceId || '').trim().toLowerCase();
    if (candRef && exRef && candRef === exRef) {
      score += 0.25;
      reasons.push(`Matching user-confirmed reference (${existing.confirmedReferenceId})`);
    }

    const confidence = Number(Math.min(1, score).toFixed(4));
    if (confidence >= minConfidence) {
      suggestions.push({
        candidateCaseId: existing.caseId,
        candidateTitle: existing.title || existing.caseId,
        category: existing.category,
        jurisdiction: existing.jurisdiction,
        classification: confidence >= 0.7 ? 'LIKELY_DUPLICATE' : 'RELATED_CASE',
        confidence,
        confidenceReasons: reasons,
        requiresHumanConfirmation: true,
        separateCaseIdsPreserved: true,
        provenance: 'ai_suggestion',
      });
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return {
    primaryCaseId: candidateCase.caseId,
    suggestions,
    separateCaseIdsPreserved: true,
  };
}

function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(key, fallback, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listCaseLinks(customStorage = null) {
  return readJson(CASE_LINKS_STORAGE_KEY, [], customStorage);
}

export function listCaseLinkAuditLog(customStorage = null) {
  return readJson(CASE_LINK_AUDIT_KEY, [], customStorage);
}

/**
 * Records explicit human confirmation linking or distinguishing two cases,
 * strictly preserving both separate case IDs.
 */
export function confirmCaseRelationship({
  primaryCaseId,
  candidateCaseId,
  decision,
  confirmedBy = 'citizen_local',
  reason = '',
  customStorage = null,
}) {
  if (!primaryCaseId || !candidateCaseId || primaryCaseId === candidateCaseId) {
    throw new Error('Two distinct case IDs are required.');
  }
  if (!Object.values(LINK_DECISIONS).includes(decision)) {
    throw new Error(`Invalid decision: ${decision}`);
  }
  if (hasForbiddenPII(reason)) {
    throw new Error('Confirmation reason must not contain Aadhaar, PAN, or personal phone numbers.');
  }

  const linkRecord = {
    linkId: `clink_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    primaryCaseId,
    candidateCaseId,
    decision,
    separateCaseIdsPreserved: true,
    confirmedBy,
    reason: reason.trim(),
    confirmedAt: new Date().toISOString(),
  };

  const links = listCaseLinks(customStorage);
  links.unshift(linkRecord);
  writeJson(CASE_LINKS_STORAGE_KEY, links.slice(0, 200), customStorage);

  const audit = listCaseLinkAuditLog(customStorage);
  audit.unshift({
    auditId: `claud_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    action: `CASE_${decision}`,
    primaryCaseId,
    candidateCaseId,
    actorId: confirmedBy,
    timestamp: new Date().toISOString(),
  });
  writeJson(CASE_LINK_AUDIT_KEY, audit.slice(0, 500), customStorage);

  return linkRecord;
}

// ---------------------------------------------------------------------------
// SYNTHETIC PRECISION / RECALL EVALUATION FIXTURES
// ---------------------------------------------------------------------------

export const SYNTHETIC_CASE_EVAL_FIXTURES = Object.freeze([
  {
    id: 'syn-1',
    expectedDuplicate: true,
    caseA: {
      caseId: 'CASE-101',
      category: 'Ration Card',
      jurisdiction: 'Delhi Ward 5',
      confirmedReferenceId: 'RC/2026/101',
      submittedAt: '2026-11-20T10:00:00Z',
    },
    caseB: {
      caseId: 'CASE-102',
      category: 'Ration Card',
      jurisdiction: 'Delhi Ward 5',
      confirmedReferenceId: 'RC/2026/101',
      submittedAt: '2026-11-22T10:00:00Z',
    },
  },
  {
    id: 'syn-2',
    expectedDuplicate: true,
    caseA: {
      caseId: 'CASE-201',
      category: 'Water Supply',
      jurisdiction: 'Pune PCMC Zone D',
      confirmedReferenceId: 'WS/2026/44',
      submittedAt: '2026-11-18T10:00:00Z',
    },
    caseB: {
      caseId: 'CASE-202',
      category: 'Water Supply',
      jurisdiction: 'Pune PCMC Zone D',
      confirmedReferenceId: 'WS/2026/44',
      submittedAt: '2026-11-19T10:00:00Z',
    },
  },
  {
    id: 'syn-3',
    expectedDuplicate: false, // Different citizens / different ref & category in same ward
    caseA: {
      caseId: 'CASE-301',
      category: 'Ration Card',
      jurisdiction: 'Delhi Ward 5',
      confirmedReferenceId: 'RC/2026/901',
      submittedAt: '2026-11-20T10:00:00Z',
    },
    caseB: {
      caseId: 'CASE-302',
      category: 'Pension',
      jurisdiction: 'Delhi Ward 5',
      confirmedReferenceId: 'PEN/2026/55',
      submittedAt: '2026-11-21T10:00:00Z',
    },
  },
  {
    id: 'syn-4',
    expectedDuplicate: false, // Same category & ward, but > 90 days apart and different ref
    caseA: {
      caseId: 'CASE-401',
      category: 'Streetlight',
      jurisdiction: 'Lucknow Ward 2',
      confirmedReferenceId: 'SL/2026/11',
      submittedAt: '2026-06-01T10:00:00Z',
    },
    caseB: {
      caseId: 'CASE-402',
      category: 'Streetlight',
      jurisdiction: 'Lucknow Ward 2',
      confirmedReferenceId: 'SL/2026/99',
      submittedAt: '2026-11-25T10:00:00Z',
    },
  },
]);

export function evaluateDuplicateDetector(fixtures = SYNTHETIC_CASE_EVAL_FIXTURES) {
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const fx of fixtures) {
    const res = detectDuplicateAndRelatedCases(fx.caseA, [fx.caseB]);
    const predictedDuplicate = res.suggestions.some((s) => s.classification === 'LIKELY_DUPLICATE');
    if (predictedDuplicate && fx.expectedDuplicate) tp += 1;
    else if (predictedDuplicate && !fx.expectedDuplicate) fp += 1;
    else if (!predictedDuplicate && fx.expectedDuplicate) fn += 1;
  }

  const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 1;
  const recall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 1;
  return { totalFixtures: fixtures.length, tp, fp, fn, precision, recall };
}
