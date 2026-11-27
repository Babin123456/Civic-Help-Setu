/**
 * src/services/grievanceDepartmentRoutingService.js
 *
 * AI-Assisted Grievance Department Routing Classifier with Human Override (#1445).
 *
 * Extends src/services/grievanceClassificationService.js and
 * src/services/piiLeakageGuardService.js to provide:
 * - Constrained classifier evaluated on reviewed, de-identified examples
 * - Ranked multi-department suggestions with evidence phrases and reasons
 * - Mandatory human confirmation below confidence threshold or on multi-department overlap
 * - Deterministic fallback when confidence is insufficient or classifier is disabled
 * - Per-class precision, recall, F1, and support metrics
 * - Zero-PII & sensitive-data exclusion
 */

import { GRIEVANCE_CATEGORIES } from './grievanceClassificationService.js';
import { inspectStringForPII } from './piiLeakageGuardService.js';

export const ROUTING_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;

export const ROUTING_ORIGIN = {
  CITIZEN_FACT: 'citizen_entered_fact',
  AI_SUGGESTION: 'ai_community_suggestion',
  OFFICIAL_RECORD: 'official_record',
};

const SENSITIVE_KEY_REGEX = /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email)$/i;

export const DEPARTMENT_CATALOG = [
  {
    category: GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE,
    department: 'Public Works Department (PWD) / Municipal Road Cell',
    phrases: ['pothole', 'broken road', 'footpath', 'flyover', 'asphalt', 'divider', 'culvert', 'road damage'],
    officialRule: {
      source: 'UP PWD & Municipal Road Maintenance Charter',
      jurisdiction: 'IN-UP',
      effectiveDate: '2026-01-01',
      lastVerifiedAt: '2026-11-20T00:00:00.000Z',
    },
  },
  {
    category: GRIEVANCE_CATEGORIES.MUNICIPAL_SANITATION,
    department: 'Municipal Solid Waste & Public Health Engineering Department',
    phrases: ['garbage', 'waste', 'trash', 'dumping', 'open drain', 'mosquito', 'cleanliness', 'stray'],
    officialRule: {
      source: 'Swachh Bharat Urban Conservancy Rules',
      jurisdiction: 'IN-UP',
      effectiveDate: '2026-01-01',
      lastVerifiedAt: '2026-11-20T00:00:00.000Z',
    },
  },
  {
    category: GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE,
    department: 'City Water Supply & Sewerage Board / Jal Board',
    phrases: ['water supply', 'dirty water', 'pipeline burst', 'sewer overflow', 'manhole', 'drainage blockage', 'no water', 'water tanker'],
    officialRule: {
      source: 'UP Jal Nigam & Urban Water Supply SLA',
      jurisdiction: 'IN-UP',
      effectiveDate: '2026-02-01',
      lastVerifiedAt: '2026-11-20T00:00:00.000Z',
    },
  },
  {
    category: GRIEVANCE_CATEGORIES.ELECTRICITY_AND_POWER,
    department: 'State Power Distribution Corporation (DISCOM)',
    phrases: ['power cut', 'transformer', 'streetlight', 'electric pole', 'voltage', 'meter fault', 'live wire'],
    officialRule: {
      source: 'UPPCL Electricity Supply Code',
      jurisdiction: 'IN-UP',
      effectiveDate: '2026-01-15',
      lastVerifiedAt: '2026-11-20T00:00:00.000Z',
    },
  },
  {
    category: GRIEVANCE_CATEGORIES.PUBLIC_TRANSPORT,
    department: 'State Road Transport & Metro Authority',
    phrases: ['bus', 'metro', 'bus stop', 'concession pass', 'fare overcharge', 'route cancelled'],
    officialRule: {
      source: 'UPSRTC Passenger Service Charter',
      jurisdiction: 'IN-UP',
      effectiveDate: '2026-01-01',
      lastVerifiedAt: '2026-11-20T00:00:00.000Z',
    },
  },
];

export const REVIEWED_DEIDENTIFIED_EXAMPLES = [
  { id: 'ex-1', text: 'Deep pothole and broken road near Ward 4 junction.', expectedCategory: GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE },
  { id: 'ex-2', text: 'Asphalt divider collapsed on flyover approach.', expectedCategory: GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE },
  { id: 'ex-3', text: 'Uncollected garbage and open drain causing mosquito breeding.', expectedCategory: GRIEVANCE_CATEGORIES.MUNICIPAL_SANITATION },
  { id: 'ex-4', text: 'Waste dumping near community cleanliness bin.', expectedCategory: GRIEVANCE_CATEGORIES.MUNICIPAL_SANITATION },
  { id: 'ex-5', text: 'Pipeline burst and dirty water supply in sector 9.', expectedCategory: GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE },
  { id: 'ex-6', text: 'Sewer overflow from blocked manhole on main lane.', expectedCategory: GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE },
  { id: 'ex-7', text: 'Transformer spark and power cut since last night.', expectedCategory: GRIEVANCE_CATEGORIES.ELECTRICITY_AND_POWER },
  { id: 'ex-8', text: 'Broken streetlight and hanging live wire near school.', expectedCategory: GRIEVANCE_CATEGORIES.ELECTRICITY_AND_POWER },
  { id: 'ex-9', text: 'Morning bus route cancelled and bus stop shelter damaged.', expectedCategory: GRIEVANCE_CATEGORIES.PUBLIC_TRANSPORT },
  { id: 'ex-10', text: 'Metro concession pass renewal counter closed.', expectedCategory: GRIEVANCE_CATEGORIES.PUBLIC_TRANSPORT },
];

export function sanitizeRoutingText(val, maxLen = 600) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateRoutingZeroPii(payload, path = 'routing') {
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

export function verifyDepartmentRuleProvenance(rule = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof rule?.[f] !== 'string' || rule[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && rule?.verified !== false;
  return {
    source: sanitizeRoutingText(rule?.source || 'Unverified routing rule', 200),
    jurisdiction: sanitizeRoutingText(rule?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeRoutingText(rule?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeRoutingText(rule?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

/**
 * Classifies a grievance description into ranked department suggestions with
 * evidence phrases, multi-department support, human-confirmation threshold,
 * and deterministic fallback.
 */
export function classifyGrievanceDepartments({
  description = '',
  jurisdiction = 'IN-UP',
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
  forceDeterministicFallback = false,
} = {}) {
  const piiCheck = validateRoutingZeroPii({ description, jurisdiction }, 'complaint');
  if (!piiCheck.valid) {
    throw new Error(`Privacy violation: ${piiCheck.violations[0]}`);
  }

  const cleanText = sanitizeRoutingText(description, 1000);
  if (cleanText.length < 5) {
    throw new Error('Complaint description must be at least 5 characters.');
  }

  const lower = cleanText.toLowerCase();

  if (forceDeterministicFallback) {
    return buildDeterministicFallbackResult({ cleanText, jurisdiction, reason: 'Classifier disabled; deterministic manual triage fallback active.' });
  }

  const scored = [];
  for (const dept of DEPARTMENT_CATALOG) {
    const matchedPhrases = dept.phrases.filter((p) => lower.includes(p));
    if (matchedPhrases.length === 0) continue;

    // Bounded deterministic confidence based on distinct evidence phrase matches
    const rawConfidence = Math.min(0.95, 0.42 + matchedPhrases.length * 0.24);
    const provenance = verifyDepartmentRuleProvenance({
      ...dept.officialRule,
      jurisdiction: jurisdiction || dept.officialRule.jurisdiction,
    });

    scored.push({
      origin: ROUTING_ORIGIN.AI_SUGGESTION,
      category: dept.category,
      department: dept.department,
      confidence: Number(rawConfidence.toFixed(4)),
      evidencePhrases: matchedPhrases,
      reasons: [`Matched ${matchedPhrases.length} domain phrase(s): ${matchedPhrases.join(', ')}`],
      officialRule: provenance,
    });
  }

  scored.sort((a, b) => b.confidence - a.confidence || a.category.localeCompare(b.category));

  if (scored.length === 0) {
    return buildDeterministicFallbackResult({
      cleanText,
      jurisdiction,
      reason: 'No department evidence phrases matched; routed to deterministic manual triage fallback.',
    });
  }

  const top = scored[0];
  const isMultiDepartment = scored.length > 1 && scored[1].confidence >= 0.45;
  const requiresHumanConfirmation = top.confidence < confidenceThreshold || isMultiDepartment;

  return {
    schemaVersion: ROUTING_SCHEMA_VERSION,
    caseId: `grv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    citizenComplaint: {
      origin: ROUTING_ORIGIN.CITIZEN_FACT,
      text: cleanText,
      jurisdiction: sanitizeRoutingText(jurisdiction, 64),
    },
    rankedDepartments: scored,
    primaryCategory: top.category,
    topConfidence: top.confidence,
    isMultiDepartment,
    requiresHumanConfirmation,
    usedDeterministicFallback: false,
    confidenceThreshold,
    humanDecision: null,
    status: requiresHumanConfirmation ? 'pending_human_confirmation' : 'auto_suggested',
    evaluatedAt: new Date().toISOString(),
  };
}

function buildDeterministicFallbackResult({ cleanText, jurisdiction, reason }) {
  return {
    schemaVersion: ROUTING_SCHEMA_VERSION,
    caseId: `grv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    citizenComplaint: {
      origin: ROUTING_ORIGIN.CITIZEN_FACT,
      text: cleanText,
      jurisdiction: sanitizeRoutingText(jurisdiction, 64),
    },
    rankedDepartments: [
      {
        origin: ROUTING_ORIGIN.OFFICIAL_RECORD,
        category: GRIEVANCE_CATEGORIES.AMBIGUOUS_MULTI_DEPARTMENT,
        department: 'Public Grievance Facilitation Desk (Deterministic Manual Triage)',
        confidence: 0,
        evidencePhrases: [],
        reasons: [reason],
        officialRule: verifyDepartmentRuleProvenance({
          source: 'CPGRAMS / State Grievance Triage Fallback Protocol',
          jurisdiction: jurisdiction || 'IN-UP',
          effectiveDate: '2026-01-01',
          lastVerifiedAt: '2026-11-20T00:00:00.000Z',
        }),
      },
    ],
    primaryCategory: GRIEVANCE_CATEGORIES.AMBIGUOUS_MULTI_DEPARTMENT,
    topConfidence: 0,
    isMultiDepartment: false,
    requiresHumanConfirmation: true,
    usedDeterministicFallback: true,
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    humanDecision: null,
    status: 'pending_human_confirmation',
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Computes per-class precision, recall, F1, and support on reviewed de-identified examples.
 */
export function evaluatePerClassRoutingMetrics(examples = REVIEWED_DEIDENTIFIED_EXAMPLES) {
  const classes = DEPARTMENT_CATALOG.map((d) => d.category);
  const stats = {};
  for (const c of classes) {
    stats[c] = { tp: 0, fp: 0, fn: 0, support: 0 };
  }

  let correct = 0;
  for (const ex of examples) {
    const res = classifyGrievanceDepartments({ description: ex.text });
    const predicted = res.primaryCategory;
    const expected = ex.expectedCategory;

    if (stats[expected]) stats[expected].support += 1;
    if (predicted === expected) {
      correct += 1;
      if (stats[expected]) stats[expected].tp += 1;
    } else {
      if (stats[expected]) stats[expected].fn += 1;
      if (stats[predicted]) stats[predicted].fp += 1;
    }
  }

  const perClass = {};
  for (const c of classes) {
    const { tp, fp, fn, support } = stats[c];
    const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 0;
    const recall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 0;
    const f1 = precision + recall > 0 ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4)) : 0;
    perClass[c] = { precision, recall, f1, support };
  }

  return {
    totalExamples: examples.length,
    accuracy: examples.length > 0 ? Number((correct / examples.length).toFixed(4)) : 0,
    perClass,
  };
}

/**
 * Applies human confirmation or multi-department override to a classified case.
 */
export function applyHumanRoutingOverride(
  routingCase,
  { actorId, role = 'admin', selectedCategories = [], rationale = '' } = {}
) {
  if (!routingCase) throw new Error('Routing case not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin operator role required.');
  if (!Array.isArray(selectedCategories) || selectedCategories.length === 0) {
    throw new Error('At least one target department category must be selected.');
  }

  const piiCheck = validateRoutingZeroPii({ rationale }, 'override');
  if (!piiCheck.valid) {
    throw new Error(piiCheck.violations[0]);
  }

  const cleanRationale = sanitizeRoutingText(rationale || 'Confirmed by operator.', 400);
  const now = new Date().toISOString();

  return {
    ...routingCase,
    status: 'human_confirmed',
    requiresHumanConfirmation: false,
    humanDecision: {
      origin: ROUTING_ORIGIN.OFFICIAL_RECORD,
      selectedCategories: selectedCategories.map((c) => sanitizeRoutingText(String(c), 80)),
      rationale: cleanRationale,
      operatorId: sanitizeRoutingText(actorId, 64),
      confirmedAt: now,
    },
    updatedAt: now,
  };
}

export function migrateGrievanceRoutingState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: ROUTING_SCHEMA_VERSION,
    cases: Array.isArray(safe.cases) ? safe.cases : [],
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
