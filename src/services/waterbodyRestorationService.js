/**
 * src/services/waterbodyRestorationService.js
 *
 * Public Waterbody Restoration Milestone and Evidence Tracker (#1442).
 *
 * Provides:
 * - Official restoration work plans linked to measurable milestones
 *   (inlet_cleanup, desilting, water_testing, boundary_protection)
 * - Baseline & milestone source provenance (unknown rules marked unverified)
 * - Strict separation of official claims vs community/citizen observations vs AI advisories
 * - Append-only preserved corrections history
 * - Guardrail blocking unsupported environmental health claims (e.g. "safe to drink" without lab citation)
 * - Zero-PII enforcement & safe backward-compatible migrations
 */

import { inspectStringForPII } from './piiLeakageGuardService.js';

export const WATERBODY_SCHEMA_VERSION = '1.0.0';

export const WATERBODY_ORIGIN = {
  OFFICIAL_RECORD: 'official_record',
  CITIZEN_OBSERVATION: 'citizen_entered_fact',
  AI_ADVISORY: 'ai_community_suggestion',
};

export const RESTORATION_MILESTONE_TYPES = [
  'inlet_cleanup',
  'desilting',
  'water_testing',
  'boundary_protection',
];

const UNSUPPORTED_HEALTH_CLAIM_PATTERNS = [
  /\b(?:100%\s+)?safe\s+to\s+drink\b/i,
  /\bpotable\s+without\s+treatment\b/i,
  /\bzero\s+(?:health|disease)\s+risk\b/i,
  /\bmedically\s+(?:safe|certified)\s+(?:drinking|water)\b/i,
  /\bcures?\s+waterborne\b/i,
];

const SENSITIVE_KEY_REGEX = /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email)$/i;

export function sanitizeWaterbodyText(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateWaterbodyZeroPii(payload, path = 'waterbody') {
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

export function validateNoUnsupportedHealthClaims(text = '', hasVerifiedLabCitation = false) {
  if (hasVerifiedLabCitation) return { valid: true, violations: [] };
  const violations = [];
  for (const pat of UNSUPPORTED_HEALTH_CLAIM_PATTERNS) {
    if (pat.test(text)) {
      violations.push(
        'Unsupported environmental health claim detected (e.g. "safe to drink" / "zero health risk") without a verified lab test reference.'
      );
      break;
    }
  }
  return { valid: violations.length === 0, violations };
}

export function verifyWaterbodySourceProvenance(sourceMeta = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof sourceMeta?.[f] !== 'string' || sourceMeta[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && sourceMeta?.verified !== false;
  return {
    source: sanitizeWaterbodyText(sourceMeta?.source || 'Unverified source', 200),
    jurisdiction: sanitizeWaterbodyText(sourceMeta?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeWaterbodyText(sourceMeta?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeWaterbodyText(sourceMeta?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

export function addCommunityObservation(waterbody, input, actorId = 'citizen') {
  if (!waterbody) throw new Error('Waterbody project not found.');
  const piiCheck = validateWaterbodyZeroPii(input, 'observation');
  if (!piiCheck.valid) {
    throw new Error(`Privacy violation: ${piiCheck.violations[0]}`);
  }

  const milestoneType = input?.milestoneType;
  if (!RESTORATION_MILESTONE_TYPES.includes(milestoneType)) {
    throw new Error(`milestoneType must be one of: ${RESTORATION_MILESTONE_TYPES.join(', ')}`);
  }

  const note = sanitizeWaterbodyText(input?.note || '', 500);
  if (note.length < 5) {
    throw new Error('Observation note must be at least 5 characters.');
  }

  const healthCheck = validateNoUnsupportedHealthClaims(note, Boolean(input?.verifiedLabReference));
  if (!healthCheck.valid) {
    throw new Error(healthCheck.violations[0]);
  }

  const observation = {
    observationId: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: WATERBODY_ORIGIN.CITIZEN_OBSERVATION,
    milestoneType,
    observedDate: sanitizeWaterbodyText(input?.observedDate || new Date().toISOString().slice(0, 10), 40),
    note,
    evidenceRef: sanitizeWaterbodyText(input?.evidenceRef || '', 200),
    observerRef: `obs-user-${String(actorId).slice(0, 12)}`,
    createdAt: new Date().toISOString(),
  };

  return {
    ...waterbody,
    communityObservations: [observation, ...(waterbody.communityObservations || [])],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Records a preserved correction to an official milestone without deleting history.
 */
export function recordMilestoneCorrection(
  waterbody,
  { actorId, role = 'admin', milestoneType, correctedStatus, reason = '', officialSource = {} } = {}
) {
  if (!waterbody) throw new Error('Waterbody project not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to record official corrections.');
  if (!RESTORATION_MILESTONE_TYPES.includes(milestoneType)) {
    throw new Error(`Invalid milestoneType '${milestoneType}'.`);
  }

  const piiCheck = validateWaterbodyZeroPii({ reason, officialSource }, 'correction');
  if (!piiCheck.valid) {
    throw new Error(piiCheck.violations[0]);
  }

  const cleanReason = sanitizeWaterbodyText(reason, 400);
  if (cleanReason.length < 4) {
    throw new Error('Correction reason (min 4 chars) is required.');
  }

  const targetMilestone = (waterbody.officialMilestones || []).find((m) => m.milestoneType === milestoneType);
  if (!targetMilestone) {
    throw new Error(`Milestone '${milestoneType}' not found on project.`);
  }

  const verifiedSource = verifyWaterbodySourceProvenance(officialSource);
  const now = new Date().toISOString();

  const correction = {
    correctionId: `cor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: WATERBODY_ORIGIN.OFFICIAL_RECORD,
    milestoneType,
    previousStatus: targetMilestone.status,
    correctedStatus: sanitizeWaterbodyText(correctedStatus || targetMilestone.status, 40),
    reason: cleanReason,
    officialSource: verifiedSource,
    correctedBy: sanitizeWaterbodyText(actorId, 64),
    correctedAt: now,
  };

  const nextMilestones = waterbody.officialMilestones.map((m) =>
    m.milestoneType === milestoneType
      ? { ...m, status: correction.correctedStatus, officialSource: verifiedSource }
      : m
  );

  return {
    ...waterbody,
    officialMilestones: nextMilestones,
    corrections: [correction, ...(waterbody.corrections || [])],
    updatedAt: now,
  };
}

export function getBuiltInWaterbodyProjects() {
  const now = '2026-11-20T09:00:00.000Z';
  return [
    {
      schemaVersion: WATERBODY_SCHEMA_VERSION,
      waterbodyId: 'wb-gomti-kathaura-lake',
      name: 'Kathaura Urban Lake Restoration',
      jurisdiction: 'IN-UP',
      wardId: 'ward-14',
      baselineSource: verifyWaterbodySourceProvenance({
        source: 'Lucknow Municipal Corporation — Amrit Sarovar Baseline Survey',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-01-15',
        lastVerifiedAt: now,
      }),
      officialMilestones: [
        {
          origin: WATERBODY_ORIGIN.OFFICIAL_RECORD,
          milestoneType: 'inlet_cleanup',
          targetDate: '2026-06-30',
          status: 'verified_complete',
          officialSource: verifyWaterbodySourceProvenance({
            source: 'LMC Stormwater Inlet Work Order #412',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-03-01',
            lastVerifiedAt: now,
          }),
        },
        {
          origin: WATERBODY_ORIGIN.OFFICIAL_RECORD,
          milestoneType: 'desilting',
          targetDate: '2026-09-15',
          status: 'in_progress',
          officialSource: verifyWaterbodySourceProvenance({
            source: 'Irrigation Dept Desilting Tender #88',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-05-01',
            lastVerifiedAt: now,
          }),
        },
        {
          origin: WATERBODY_ORIGIN.OFFICIAL_RECORD,
          milestoneType: 'water_testing',
          targetDate: '2026-11-30',
          status: 'pending_lab_report',
          officialSource: verifyWaterbodySourceProvenance({ source: 'Pending lab upload' }), // Unverified
        },
        {
          origin: WATERBODY_ORIGIN.OFFICIAL_RECORD,
          milestoneType: 'boundary_protection',
          targetDate: '2026-12-20',
          status: 'planned',
          officialSource: verifyWaterbodySourceProvenance({
            source: 'Revenue & Municipal Bund Demarcation Plan',
            jurisdiction: 'IN-UP',
            effectiveDate: '2026-04-01',
            lastVerifiedAt: now,
          }),
        },
      ],
      communityObservations: [
        {
          observationId: 'obs-seed-1',
          origin: WATERBODY_ORIGIN.CITIZEN_OBSERVATION,
          milestoneType: 'desilting',
          observedDate: '2026-11-18',
          note: 'Excavator active on north bank; silt heaped near east bund.',
          evidenceRef: 'photo-hash-e1a9c2',
          observerRef: 'obs-user-seed1',
          createdAt: now,
        },
      ],
      corrections: [],
      aiAdvisory: {
        origin: WATERBODY_ORIGIN.AI_ADVISORY,
        note: 'AI / Community Advisory (Non-binding): Independent water_testing milestone is unverified; avoid assuming water quality compliance until lab report is published.',
      },
      updatedAt: now,
    },
  ];
}

export function migrateWaterbodyStoreState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: WATERBODY_SCHEMA_VERSION,
    waterbodies: Array.isArray(safe.waterbodies) ? safe.waterbodies : getBuiltInWaterbodyProjects(),
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
