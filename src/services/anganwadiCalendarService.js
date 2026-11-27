/**
 * src/services/anganwadiCalendarService.js
 *
 * Public Anganwadi Service Availability and Nutrition-Day Calendar (#1438).
 *
 * Extends src/services/upAnganwadiService.js and src/services/piiLeakageGuardService.js to provide:
 * - Source-backed Anganwadi centre records & nutrition-day calendar
 * - Separate official schedule channel vs community status channel
 * - Strict zero-child-level-health-data & zero-PII enforcement
 * - Stale-status expiry (statuses older than threshold marked stale_expired)
 * - Accessible plain-language labels (en / hi) & official escalation hierarchy
 * - Safe backward-compatible migrations
 */

import { ANGANWADI_ESCALATION_HIERARCHY, ICDS_CORE_SERVICES } from './upAnganwadiService.js';
import { inspectStringForPII } from './piiLeakageGuardService.js';

export const ANGANWADI_CALENDAR_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_STALE_AFTER_DAYS = 7;

export const ANGANWADI_ORIGIN = {
  OFFICIAL_RECORD: 'official_record',
  COMMUNITY_STATUS: 'citizen_entered_fact',
  AI_ADVISORY: 'ai_community_suggestion',
};

export const ACCESSIBLE_LABELS = {
  en: {
    title: 'Public Anganwadi Service Availability & Nutrition-Day Calendar',
    nutritionDay: 'Nutrition & Health Day (VHSND)',
    escalation: 'Official Escalation Contacts',
    staleWarning: 'Status expired — awaiting fresh verification',
  },
  hi: {
    title: 'सार्वजनिक आंगनवाड़ी सेवा उपलब्धता और पोषण-दिवस कैलेंडर',
    nutritionDay: 'ग्राम स्वास्थ्य, स्वच्छता और पोषण दिवस (VHSND)',
    escalation: 'आधिकारिक शिकायत संपर्क',
    staleWarning: 'स्थिति पुरानी हो चुकी है — नए सत्यापन की प्रतीक्षा',
  },
};

const PROHIBITED_CHILD_HEALTH_AND_PII_KEYS = new Set([
  'aadhaar',
  'pan',
  'otp',
  'password',
  'biometric',
  'fingerprint',
  'iris',
  'phone',
  'mobile',
  'email',
  'childname',
  'child_name',
  'minorname',
  'minor_name',
  'mothername',
  'mother_name',
  'birthweight',
  'birth_weight',
  'samstatus',
  'sam_status',
  'mamstatus',
  'mam_status',
  'immunizationrecord',
  'immunization_record',
  'muac',
  'hemoglobin',
  'growthchart',
  'growth_chart',
  'dob',
  'childagemonths',
  'child_age_months',
]);

export function sanitizeAnganwadiText(val, maxLen = 400) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Enforces zero PII and zero child-level health records.
 */
export function validateNoChildHealthDataOrPii(payload, path = 'anganwadi') {
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
      if (/\b(?:sam|mam)\s+(?:child|baby|infant)\b/i.test(node) || /\bmuac\s*[:=]?\s*\d+/i.test(node)) {
        violations.push(`${currentPath}: child-level health data is strictly prohibited`);
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
        const norm = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (PROHIBITED_CHILD_HEALTH_AND_PII_KEYS.has(norm) || PROHIBITED_CHILD_HEALTH_AND_PII_KEYS.has(key.trim().toLowerCase())) {
          violations.push(`${currentPath}.${key}: prohibited child health or PII field`);
        }
        walk(val, `${currentPath}.${key}`);
      }
    }
  }
  walk(payload, path);
  return { valid: violations.length === 0, violations };
}

export function evaluateStatusFreshness(lastVerifiedAt, staleAfterDays = DEFAULT_STALE_AFTER_DAYS, nowMs = Date.now()) {
  if (typeof lastVerifiedAt !== 'string' || !lastVerifiedAt.trim()) {
    return { isStale: true, freshnessStatus: 'unverified', ageDays: null };
  }
  const parsed = Date.parse(lastVerifiedAt);
  if (!Number.isFinite(parsed)) {
    return { isStale: true, freshnessStatus: 'unverified', ageDays: null };
  }
  const ageDays = Number(((nowMs - parsed) / (1000 * 60 * 60 * 24)).toFixed(2));
  const isStale = ageDays > staleAfterDays;
  return {
    isStale,
    freshnessStatus: isStale ? 'stale_expired' : 'fresh',
    ageDays,
  };
}

export function verifyAnganwadiProvenance(meta = {}, nowMs = Date.now()) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof meta?.[f] !== 'string' || meta[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && meta?.verified !== false;
  const freshness = evaluateStatusFreshness(meta?.lastVerifiedAt, DEFAULT_STALE_AFTER_DAYS, nowMs);

  return {
    source: sanitizeAnganwadiText(meta?.source || 'Unverified Anganwadi record', 200),
    jurisdiction: sanitizeAnganwadiText(meta?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeAnganwadiText(meta?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeAnganwadiText(meta?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    ...freshness,
    missingFields,
  };
}

export function publishOfficialScheduleChange(
  centre,
  { actorId, role = 'admin', effectiveDate, openingHours, nutritionDay, reason, officialProvenance = {} } = {}
) {
  if (!centre) throw new Error('Anganwadi centre not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to publish official schedule changes.');

  const check = validateNoChildHealthDataOrPii({ effectiveDate, openingHours, nutritionDay, reason, officialProvenance }, 'scheduleChange');
  if (!check.valid) throw new Error(check.violations[0]);

  const cleanReason = sanitizeAnganwadiText(reason, 300);
  if (cleanReason.length < 4) throw new Error('Schedule change reason (min 4 chars) is required.');

  const verifiedProv = verifyAnganwadiProvenance(officialProvenance);
  const now = new Date().toISOString();

  const change = {
    changeId: `awc-chg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: ANGANWADI_ORIGIN.OFFICIAL_RECORD,
    effectiveDate: sanitizeAnganwadiText(effectiveDate || now.slice(0, 10), 40),
    openingHours: sanitizeAnganwadiText(openingHours || centre.openingHours, 80),
    nutritionDay: sanitizeAnganwadiText(nutritionDay || centre.nutritionDaySchedule, 120),
    reason: cleanReason,
    officialProvenance: verifiedProv,
    publishedBy: sanitizeAnganwadiText(actorId, 64),
    publishedAt: now,
  };

  return {
    ...centre,
    openingHours: change.openingHours,
    nutritionDaySchedule: change.nutritionDay,
    officialProvenance: verifiedProv,
    officialScheduleChanges: [change, ...(centre.officialScheduleChanges || [])],
    updatedAt: now,
  };
}

export function submitCommunityCentreStatus(centre, input, actorId = 'citizen') {
  if (!centre) throw new Error('Anganwadi centre not found.');
  const check = validateNoChildHealthDataOrPii(input, 'communityStatus');
  if (!check.valid) throw new Error(`Privacy/Child-Safety violation: ${check.violations[0]}`);

  const statusType = ['open_normal', 'closed_unannounced', 'ration_available', 'ration_unavailable'].includes(input?.statusType)
    ? input.statusType
    : 'open_normal';
  const note = sanitizeAnganwadiText(input?.note || '', 300);
  if (note.length < 5) throw new Error('Community status note must be at least 5 characters.');

  const now = new Date().toISOString();
  const entry = {
    statusId: `awc-com-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: ANGANWADI_ORIGIN.COMMUNITY_STATUS,
    statusType,
    note,
    reporterRef: `cit-${String(actorId).slice(0, 10)}`,
    reportedAt: now,
  };

  return {
    ...centre,
    communityStatusReports: [entry, ...(centre.communityStatusReports || [])],
    updatedAt: now,
  };
}

export function getBuiltInAnganwadiCentres(nowMs = Date.now()) {
  const freshTs = new Date(nowMs - 2 * 24 * 3600 * 1000).toISOString(); // 2 days ago -> fresh
  const staleTs = new Date(nowMs - 20 * 24 * 3600 * 1000).toISOString(); // 20 days ago -> stale_expired

  return [
    {
      schemaVersion: ANGANWADI_CALENDAR_SCHEMA_VERSION,
      centreId: 'awc-lucknow-w14-01',
      origin: ANGANWADI_ORIGIN.OFFICIAL_RECORD,
      name: 'Anganwadi Centre #14-A (Chinhat Block)',
      wardId: 'ward-14',
      jurisdiction: 'IN-UP',
      openingHours: '09:00 AM – 01:00 PM (Mon–Sat)',
      nutritionDaySchedule: '1st & 3rd Wednesday — VHSND / Aarogya Diwas; 5th of Month — THR Distribution',
      services: Object.values(ICDS_CORE_SERVICES).map((s) => s.name),
      escalationContacts: ANGANWADI_ESCALATION_HIERARCHY,
      officialProvenance: verifyAnganwadiProvenance(
        {
          source: 'UP ICDS / Bal Vikas Sewa Evam Pushtahar (balvikasup.gov.in)',
          jurisdiction: 'IN-UP',
          effectiveDate: '2026-10-01',
          lastVerifiedAt: freshTs,
        },
        nowMs
      ),
      officialScheduleChanges: [],
      communityStatusReports: [
        {
          statusId: 'awc-com-seed-1',
          origin: ANGANWADI_ORIGIN.COMMUNITY_STATUS,
          statusType: 'ration_available',
          note: 'THR packets distributed cleanly during morning session.',
          reporterRef: 'cit-seed1',
          reportedAt: freshTs,
        },
      ],
      aiAdvisory: {
        origin: ANGANWADI_ORIGIN.AI_ADVISORY,
        note: 'AI / Community Advisory (Non-binding): Check official schedule changes before visiting on public holidays.',
      },
      updatedAt: freshTs,
    },
    {
      schemaVersion: ANGANWADI_CALENDAR_SCHEMA_VERSION,
      centreId: 'awc-lucknow-w08-02',
      origin: ANGANWADI_ORIGIN.OFFICIAL_RECORD,
      name: 'Anganwadi Centre #08-B (Alambagh Sector)',
      wardId: 'ward-08',
      jurisdiction: 'IN-UP',
      openingHours: '08:30 AM – 12:30 PM (Mon–Sat)',
      nutritionDaySchedule: '2nd Wednesday — VHSND / Immunization Convergence',
      services: Object.values(ICDS_CORE_SERVICES).map((s) => s.name),
      escalationContacts: ANGANWADI_ESCALATION_HIERARCHY,
      officialProvenance: verifyAnganwadiProvenance(
        {
          source: 'Sector Mukhya Sevika Register',
          jurisdiction: 'IN-UP',
          effectiveDate: '2026-08-01',
          lastVerifiedAt: staleTs, // > 7 days -> stale_expired
        },
        nowMs
      ),
      officialScheduleChanges: [],
      communityStatusReports: [],
      aiAdvisory: {
        origin: ANGANWADI_ORIGIN.AI_ADVISORY,
        note: 'AI / Community Advisory (Non-binding): Centre verification is stale (> 7 days); confirm with Mukhya Sevika.',
      },
      updatedAt: staleTs,
    },
  ];
}

export function migrateAnganwadiCalendarState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: ANGANWADI_CALENDAR_SCHEMA_VERSION,
    centres: Array.isArray(safe.centres) ? safe.centres : getBuiltInAnganwadiCentres(),
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
