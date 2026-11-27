/**
 * src/services/accessibilityBarrierSlaService.js
 *
 * Accessibility Barrier Resolution SLA Dashboard Service (#1443).
 *
 * Provides:
 * - Aggregate metrics for barrier categories, responsible authorities,
 *   report-to-resolution duration, SLA compliance, and repeat incidents
 * - Non-reversible reporter anonymization & zero-PII enforcement
 * - Verified vs unverified state tracking with official rule provenance
 * - Ward & facility filtering
 * - Small-group suppression (k-anonymity floor) to prevent identifying reporters
 * - Safe backward-compatible store migration
 */

import { inspectStringForPII } from './piiLeakageGuardService.js';

export const BARRIER_SLA_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_MIN_GROUP_SIZE = 5;

export const BARRIER_SLA_ORIGIN = {
  CITIZEN_REPORT: 'citizen_entered_fact',
  OFFICIAL_SLA_RULE: 'official_record',
  AI_TRIAGE_SUGGESTION: 'ai_community_suggestion',
};

export const BARRIER_CATEGORIES = {
  RAMP_MISSING_OR_BLOCKED: 'ramp_missing_or_blocked',
  TACTILE_PAVING_DAMAGED: 'tactile_paving_damaged',
  ELEVATOR_OUTAGE: 'elevator_outage',
  ACCESSIBLE_TOILET_LOCKED: 'accessible_toilet_locked',
  AUDIO_SIGNAGE_ABSENT: 'audio_signage_absent',
  KERB_CUT_OBSTRUCTED: 'kerb_cut_obstructed',
};

export const AUTHORITY_SLA_TARGETS_HOURS = {
  [BARRIER_CATEGORIES.RAMP_MISSING_OR_BLOCKED]: { authority: 'Public Works Department (PWD)', targetHours: 72 },
  [BARRIER_CATEGORIES.TACTILE_PAVING_DAMAGED]: { authority: 'Municipal Engineering Cell', targetHours: 96 },
  [BARRIER_CATEGORIES.ELEVATOR_OUTAGE]: { authority: 'Smart City Transit Authority', targetHours: 24 },
  [BARRIER_CATEGORIES.ACCESSIBLE_TOILET_LOCKED]: { authority: 'Health & Civic Facilities Board', targetHours: 12 },
  [BARRIER_CATEGORIES.AUDIO_SIGNAGE_ABSENT]: { authority: 'Smart City Transit Authority', targetHours: 48 },
  [BARRIER_CATEGORIES.KERB_CUT_OBSTRUCTED]: { authority: 'Municipal Engineering Cell', targetHours: 48 },
};

const SENSITIVE_KEY_REGEX = /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email|reporter_?name)$/i;

export function anonymizeBarrierReporter(rawActorId) {
  const input = String(rawActorId || 'anonymous');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `anon-rep-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function sanitizeBarrierText(val, maxLen = 400) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateBarrierSlaZeroPii(payload, path = 'barrier') {
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

export function verifySlaRuleProvenance(rule = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof rule?.[f] !== 'string' || rule[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && rule?.verified !== false;
  return {
    source: sanitizeBarrierText(rule?.source || 'Unverified municipal SLA rule', 200),
    jurisdiction: sanitizeBarrierText(rule?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeBarrierText(rule?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeBarrierText(rule?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

export function createBarrierSlaReport(input, actorId = 'anonymous') {
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Payload must be a JSON object.'], report: null };
  }

  const piiCheck = validateBarrierSlaZeroPii(input, 'report');
  if (!piiCheck.valid) {
    return { valid: false, errors: piiCheck.violations, report: null };
  }

  const errors = [];
  const category = input.category;
  const wardId = sanitizeBarrierText(input.wardId, 40);
  const facilityId = sanitizeBarrierText(input.facilityId, 80);
  const summary = sanitizeBarrierText(input.summary, 400);

  if (!Object.values(BARRIER_CATEGORIES).includes(category)) {
    errors.push(`category must be one of: ${Object.values(BARRIER_CATEGORIES).join(', ')}`);
  }
  if (!wardId) errors.push('wardId is required.');
  if (!facilityId) errors.push('facilityId is required.');
  if (!summary || summary.length < 5) errors.push('summary must be at least 5 characters.');

  if (errors.length > 0) {
    return { valid: false, errors, report: null };
  }

  const slaMeta = AUTHORITY_SLA_TARGETS_HOURS[category];
  const reportedAt = input.reportedAt || new Date().toISOString();
  const resolvedAt = input.resolvedAt || null;
  const resolutionHours =
    resolvedAt && Date.parse(resolvedAt) >= Date.parse(reportedAt)
      ? Number(((Date.parse(resolvedAt) - Date.parse(reportedAt)) / (1000 * 60 * 60)).toFixed(2))
      : null;

  const officialRule = verifySlaRuleProvenance(
    input.officialRule || {
      source: 'Sugamya Bharat & Municipal Accessibility SLA Standards',
      jurisdiction: input.jurisdiction || 'IN-UP',
      effectiveDate: '2026-01-01',
      lastVerifiedAt: '2026-11-20T00:00:00.000Z',
    }
  );

  const report = {
    schemaVersion: BARRIER_SLA_SCHEMA_VERSION,
    reportId: `bar-sla-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reporterRef: anonymizeBarrierReporter(actorId),
    origin: BARRIER_SLA_ORIGIN.CITIZEN_REPORT,
    category,
    authority: slaMeta.authority,
    slaTargetHours: slaMeta.targetHours,
    wardId,
    facilityId,
    jurisdiction: sanitizeBarrierText(input.jurisdiction || 'IN-UP', 64),
    summary,
    verificationState: input.verificationState === 'verified' ? 'verified' : 'unverified',
    officialRule,
    reportedAt,
    resolvedAt,
    resolutionHours,
    slaMet: resolutionHours !== null ? resolutionHours <= slaMeta.targetHours : null,
  };

  return { valid: true, errors: [], report };
}

export function resolveBarrierSlaReport(report, { actorId, role = 'admin', officialRule = {}, resolvedAt = new Date().toISOString() } = {}) {
  if (!report) throw new Error('Barrier report not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to verify and resolve barrier reports.');

  const verifiedRule = verifySlaRuleProvenance(officialRule);
  const resolutionHours =
    Date.parse(resolvedAt) >= Date.parse(report.reportedAt)
      ? Number(((Date.parse(resolvedAt) - Date.parse(report.reportedAt)) / (1000 * 60 * 60)).toFixed(2))
      : 0;

  return {
    ...report,
    verificationState: verifiedRule.verified ? 'verified' : 'unverified',
    officialRule: verifiedRule,
    resolvedAt,
    resolutionHours,
    slaMet: resolutionHours <= report.slaTargetHours,
    verifiedByRef: anonymizeBarrierReporter(actorId),
  };
}

/**
 * Aggregates barrier SLA metrics with ward/facility/verification filters and
 * small-group suppression (minGroupSize = 5 by default).
 */
export function aggregateBarrierSlaMetrics(
  reports = [],
  {
    wardId = 'all',
    facilityId = 'all',
    category = 'all',
    verificationState = 'all',
    minGroupSize = DEFAULT_MIN_GROUP_SIZE,
  } = {}
) {
  const effectiveMin = Math.max(3, Number(minGroupSize) || DEFAULT_MIN_GROUP_SIZE);

  const filtered = reports.filter((r) => {
    if (wardId !== 'all' && r.wardId !== wardId) return false;
    if (facilityId !== 'all' && r.facilityId !== facilityId) return false;
    if (category !== 'all' && r.category !== category) return false;
    if (verificationState !== 'all' && r.verificationState !== verificationState) return false;
    return true;
  });

  // Track repeat incidents per (wardId, facilityId, category)
  const repeatCounter = new Map();
  for (const r of filtered) {
    const key = `${r.wardId}|${r.facilityId}|${r.category}`;
    repeatCounter.set(key, (repeatCounter.get(key) || 0) + 1);
  }
  const repeatIncidentLocations = Array.from(repeatCounter.values()).filter((c) => c > 1).length;

  const resolvedList = filtered.filter((r) => typeof r.resolutionHours === 'number');
  const avgResolutionHours =
    resolvedList.length > 0
      ? Number((resolvedList.reduce((acc, r) => acc + r.resolutionHours, 0) / resolvedList.length).toFixed(2))
      : 0;
  const slaMetCount = resolvedList.filter((r) => r.slaMet === true).length;
  const slaComplianceRate =
    resolvedList.length > 0 ? Number((slaMetCount / resolvedList.length).toFixed(4)) : 1.0;

  // Group by category + authority for transparent table with small-group suppression
  const buckets = new Map();
  for (const r of filtered) {
    const key = r.category;
    if (!buckets.has(key)) {
      buckets.set(key, {
        category: r.category,
        authority: r.authority,
        slaTargetHours: r.slaTargetHours,
        items: [],
      });
    }
    buckets.get(key).items.push(r);
  }

  let suppressedGroupCount = 0;
  const categoryBreakdown = [];
  for (const bucket of buckets.values()) {
    const count = bucket.items.length;
    if (count < effectiveMin) {
      suppressedGroupCount += 1;
      categoryBreakdown.push({
        category: bucket.category,
        authority: bucket.authority,
        slaTargetHours: bucket.slaTargetHours,
        count,
        suppressed: true,
        suppressionReason: `SMALL_GROUP_SUPPRESSION (n=${count} < minGroupSize=${effectiveMin})`,
        metrics: null,
      });
      continue;
    }

    const bucketResolved = bucket.items.filter((i) => typeof i.resolutionHours === 'number');
    const bucketAvgHours =
      bucketResolved.length > 0
        ? Number((bucketResolved.reduce((a, b) => a + b.resolutionHours, 0) / bucketResolved.length).toFixed(2))
        : 0;
    const bucketSlaMet = bucketResolved.filter((i) => i.slaMet === true).length;
    const verifiedCount = bucket.items.filter((i) => i.verificationState === 'verified').length;

    categoryBreakdown.push({
      category: bucket.category,
      authority: bucket.authority,
      slaTargetHours: bucket.slaTargetHours,
      count,
      suppressed: false,
      suppressionReason: null,
      metrics: {
        resolvedCount: bucketResolved.length,
        avgResolutionHours: bucketAvgHours,
        slaComplianceRate:
          bucketResolved.length > 0 ? Number((bucketSlaMet / bucketResolved.length).toFixed(4)) : 1.0,
        verifiedCount,
        unverifiedCount: count - verifiedCount,
      },
    });
  }

  return {
    schemaVersion: BARRIER_SLA_SCHEMA_VERSION,
    totalReports: filtered.length,
    resolvedCount: resolvedList.length,
    avgResolutionHours,
    slaComplianceRate,
    repeatIncidentLocations,
    suppressedGroupCount,
    minGroupSize: effectiveMin,
    categoryBreakdown,
    aiTriageAdvisory: {
      origin: BARRIER_SLA_ORIGIN.AI_TRIAGE_SUGGESTION,
      note:
        repeatIncidentLocations > 0
          ? `AI / Community Advisory (Non-binding): ${repeatIncidentLocations} facility location(s) show repeat accessibility barriers; schedule preventive audit.`
          : 'AI / Community Advisory (Non-binding): No repeat barrier clusters detected in current filter.',
    },
  };
}

export function getBuiltInBarrierSlaReports() {
  const seeds = [];
  const baseTime = Date.parse('2026-11-10T08:00:00.000Z');
  // 6 ramp reports in ward-14 (>= 5 unsuppressed)
  for (let i = 0; i < 6; i += 1) {
    const reportedAt = new Date(baseTime + i * 3600 * 1000).toISOString();
    const resolvedAt = new Date(baseTime + (i + 30) * 3600 * 1000).toISOString();
    const { report } = createBarrierSlaReport(
      {
        category: BARRIER_CATEGORIES.RAMP_MISSING_OR_BLOCKED,
        wardId: 'ward-14',
        facilityId: i < 3 ? 'tehsil-office-gate' : 'district-hospital-opd',
        summary: `Access ramp blocked near public entrance #${i + 1}.`,
        verificationState: i < 5 ? 'verified' : 'unverified',
        reportedAt,
        resolvedAt,
      },
      `seed-reporter-${i}`
    );
    seeds.push(report);
  }
  // 5 elevator reports in ward-08 (>= 5 unsuppressed)
  for (let i = 0; i < 5; i += 1) {
    const reportedAt = new Date(baseTime + i * 3600 * 1000).toISOString();
    const resolvedAt = new Date(baseTime + (i + 36) * 3600 * 1000).toISOString(); // > 24h SLA breach
    const { report } = createBarrierSlaReport(
      {
        category: BARRIER_CATEGORIES.ELEVATOR_OUTAGE,
        wardId: 'ward-08',
        facilityId: 'metro-station-north',
        summary: `Platform elevator out of service #${i + 1}.`,
        verificationState: 'verified',
        reportedAt,
        resolvedAt,
      },
      `seed-elev-${i}`
    );
    seeds.push(report);
  }
  // 2 toilet reports (< 5 -> suppressed to protect reporter anonymity)
  for (let i = 0; i < 2; i += 1) {
    const { report } = createBarrierSlaReport(
      {
        category: BARRIER_CATEGORIES.ACCESSIBLE_TOILET_LOCKED,
        wardId: 'ward-02',
        facilityId: 'bus-terminal-east',
        summary: `Accessible restroom locked during daytime hours #${i + 1}.`,
        verificationState: 'unverified',
      },
      `seed-toilet-${i}`
    );
    seeds.push(report);
  }
  return seeds;
}

export function migrateBarrierSlaState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: BARRIER_SLA_SCHEMA_VERSION,
    reports: Array.isArray(safe.reports) ? safe.reports : getBuiltInBarrierSlaReports(),
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
