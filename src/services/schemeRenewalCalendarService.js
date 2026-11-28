/**
 * src/services/schemeRenewalCalendarService.js
 *
 * Government Scheme Renewal and Recertification Calendar (#1417).
 *
 * Extends `civicDocumentValidityCalendarService.js` and `icsText.js`:
 *   - Scheme-specific renewal cycles & grace-period source links
 *   - Configurable citizen reminder preferences (opt-in consent + leadDays)
 *   - Exportable RFC 5545 .ics calendar (no PII)
 *   - Never automatically claims a renewal has been completed (autoRenewalClaimed: false)
 *   - Distinct provenance: official_record | citizen_entered | ai_suggestion
 */

import { VALIDITY_TYPE, VALIDITY_STATUS } from './civicDocumentValidityCalendarService.js';
import {
  buildIcsContent,
  escapeIcsText,
  formatIcsUtcTimestamp,
  parseIsoDate,
} from '../utils/icsText.js';

export const SCHEME_RENEWAL_STORAGE_KEY = 'civicbridge_scheme_renewal_calendar_v1';

export const SCHEME_RENEWAL_RULES = Object.freeze({
  post_matric_scholarship: {
    schemeId: 'post_matric_scholarship',
    schemeName: 'Post-Matric Scholarship Renewal',
    validityType: VALIDITY_TYPE.ANNUAL_REVALIDATION,
    cycleMonths: 12,
    gracePeriodDays: 30,
    gracePeriodNote: 'Portal renewal window typically remains open for 30 days after deadline.',
    sourceUrl: 'https://scholarships.gov.in/',
    jurisdiction: 'India (National Scholarship Portal)',
    effectiveDate: '2025-04-01',
    lastVerifiedAt: '2026-02-01',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
  old_age_pension_life_cert: {
    schemeId: 'old_age_pension_life_cert',
    schemeName: 'Senior / Social Pension Annual Recertification',
    validityType: VALIDITY_TYPE.ANNUAL_REVALIDATION,
    cycleMonths: 12,
    gracePeriodDays: 30,
    gracePeriodNote: 'Annual life/income verification before cycle anniversary.',
    sourceUrl: 'https://nsap.nic.in/',
    jurisdiction: 'India (NSAP)',
    effectiveDate: '2025-01-01',
    lastVerifiedAt: '2026-02-01',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
  ews_income_asset_cert: {
    schemeId: 'ews_income_asset_cert',
    schemeName: 'EWS / Income Certificate Financial-Year Renewal',
    validityType: VALIDITY_TYPE.ANNUAL_REVALIDATION,
    cycleMonths: 12,
    gracePeriodDays: 0,
    gracePeriodNote: 'Valid for the financial year; no automatic grace period.',
    sourceUrl: 'https://dopt.gov.in/',
    jurisdiction: 'India (DoPT)',
    effectiveDate: '2019-01-31',
    lastVerifiedAt: '2026-02-01',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
  ration_card_ekyc_household: {
    schemeId: 'ration_card_ekyc_household',
    schemeName: 'NFSA Ration Card Periodic Household Verification',
    validityType: VALIDITY_TYPE.PERIODIC_RENEWAL,
    cycleMonths: 60,
    gracePeriodDays: 45,
    gracePeriodNote: 'Periodic e-KYC / household verification notice window.',
    sourceUrl: 'https://nfsa.gov.in/',
    jurisdiction: 'India (NFSA)',
    effectiveDate: '2024-06-01',
    lastVerifiedAt: '2026-02-01',
    verificationStatus: 'VERIFIED',
    provenance: 'official_record',
  },
});

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const SENSITIVE_KEY_RE = /\b(aadhaar|password|otp|biometric|fingerprint|iris)\b/i;

export function hasForbiddenPII(input) {
  if (!input) return false;
  if (typeof input === 'string') {
    return AADHAAR_RE.test(input) || PAN_RE.test(input);
  }
  if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (SENSITIVE_KEY_RE.test(k) && v !== undefined && v !== null && String(v).trim() !== '') {
        return true;
      }
      if (hasForbiddenPII(v)) return true;
    }
  }
  return false;
}

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function readStore(storage = getDefaultStorage()) {
  if (!storage) return { savedSchemes: {}, ruleOverrides: {}, auditLog: [] };
  try {
    const raw = storage.getItem(SCHEME_RENEWAL_STORAGE_KEY);
    if (!raw) return { savedSchemes: {}, ruleOverrides: {}, auditLog: [] };
    const parsed = JSON.parse(raw);
    return {
      savedSchemes: parsed?.savedSchemes && typeof parsed.savedSchemes === 'object' ? parsed.savedSchemes : {},
      ruleOverrides: parsed?.ruleOverrides && typeof parsed.ruleOverrides === 'object' ? parsed.ruleOverrides : {},
      auditLog: Array.isArray(parsed?.auditLog) ? parsed.auditLog : [],
    };
  } catch {
    return { savedSchemes: {}, ruleOverrides: {}, auditLog: [] };
  }
}

function writeStore(store, storage = getDefaultStorage()) {
  if (!storage) return false;
  storage.setItem(SCHEME_RENEWAL_STORAGE_KEY, JSON.stringify(store));
  return true;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function addMonthsIso(dateStr, months) {
  const parts = parseIsoDate(dateStr);
  if (!parts) return null;
  const d = new Date(Date.UTC(parts.year, parts.month - 1 + months, parts.day));
  return d.toISOString().slice(0, 10);
}

export function listSchemeRenewalRules(storage = getDefaultStorage()) {
  const store = readStore(storage);
  return Object.values(SCHEME_RENEWAL_RULES).map((r) => ({
    ...r,
    ...(store.ruleOverrides[r.schemeId] || {}),
  }));
}

export function saveSchemeToCalendar({
  actorId,
  schemeId,
  customSchemeName = '',
  lastCertifiedDate,
  leadDays = 15,
  optInReminder = true,
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (hasForbiddenPII({ schemeId, customSchemeName, lastCertifiedDate })) {
    return { ok: false, code: 400, error: 'Sensitive PII (Aadhaar, PAN, OTP, password) is forbidden.' };
  }
  if (!parseIsoDate(lastCertifiedDate)) {
    return { ok: false, code: 400, error: 'lastCertifiedDate must be a valid YYYY-MM-DD date.' };
  }

  const store = readStore(storage);
  const officialRule = SCHEME_RENEWAL_RULES[schemeId]
    ? { ...SCHEME_RENEWAL_RULES[schemeId], ...(store.ruleOverrides[schemeId] || {}) }
    : null;

  const cycleMonths = officialRule ? officialRule.cycleMonths : 12;
  const nextRenewalDueDate = addMonthsIso(lastCertifiedDate, cycleMonths);
  const entryId = makeId('sch');

  const record = {
    entryId,
    actorId,
    schemeId: officialRule ? officialRule.schemeId : 'custom_scheme',
    schemeName: officialRule ? officialRule.schemeName : String(customSchemeName || 'Custom Scheme').trim(),
    lastCertifiedDate,
    nextRenewalDueDate,
    validityStatus: VALIDITY_STATUS.VALID,
    // Never automatically claim renewal completion
    autoRenewalClaimed: false,
    citizenReportedCompleted: false,
    reminderPreferences: {
      optInReminder: Boolean(optInReminder),
      leadDays: Math.max(1, Math.min(90, Number(leadDays) || 15)),
    },
    officialRuleMetadata: officialRule
      ? {
          cycleMonths: officialRule.cycleMonths,
          gracePeriodDays: officialRule.gracePeriodDays,
          gracePeriodNote: officialRule.gracePeriodNote,
          sourceUrl: officialRule.sourceUrl,
          jurisdiction: officialRule.jurisdiction,
          effectiveDate: officialRule.effectiveDate,
          lastVerifiedAt: officialRule.lastVerifiedAt,
          verificationStatus: officialRule.verificationStatus,
          provenance: 'official_record',
        }
      : {
          cycleMonths: 12,
          gracePeriodDays: 0,
          gracePeriodNote: 'Unknown rule; verify official renewal cycle.',
          sourceUrl: null,
          jurisdiction: 'UNVERIFIED',
          effectiveDate: null,
          lastVerifiedAt: null,
          verificationStatus: 'UNVERIFIED',
          provenance: 'citizen_entered',
        },
    createdAt: new Date().toISOString(),
  };

  store.savedSchemes[entryId] = record;
  writeStore(store, storage);
  return { ok: true, entry: record };
}

export function listSavedSchemeCalendar({ actorId, storage = getDefaultStorage() }) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const entries = Object.values(store.savedSchemes).filter((e) => e.actorId === actorId);
  return { ok: true, entries };
}

export function updateReminderPreferences({
  entryId,
  actorId,
  leadDays,
  optInReminder,
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const entry = store.savedSchemes[entryId];
  if (!entry) return { ok: false, code: 404, error: 'Saved scheme entry not found.' };
  if (entry.actorId !== actorId) {
    return { ok: false, code: 403, error: 'Unauthorized access to another user scheme calendar.' };
  }

  entry.reminderPreferences = {
    optInReminder: typeof optInReminder === 'boolean' ? optInReminder : entry.reminderPreferences.optInReminder,
    leadDays: leadDays !== undefined ? Math.max(1, Math.min(90, Number(leadDays) || 15)) : entry.reminderPreferences.leadDays,
  };
  writeStore(store, storage);
  return { ok: true, entry };
}

export function exportSchemeCalendarIcs({ actorId, storage = getDefaultStorage() }) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const { entries } = listSavedSchemeCalendar({ actorId, storage });
  const stamp = formatIcsUtcTimestamp();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CivicHelpSetu//SchemeRenewalCalendar//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const entry of entries) {
    const dueCompact = String(entry.nextRenewalDueDate || '').replace(/-/g, '');
    if (!dueCompact) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeIcsText(entry.entryId)}@civichelpset.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dueCompact}`);
    lines.push(`SUMMARY:${escapeIcsText(`Renewal Due: ${entry.schemeName}`)}`);
    lines.push(
      `DESCRIPTION:${escapeIcsText(
        `Reminder (${entry.reminderPreferences.leadDays}d lead). Official status: ${entry.officialRuleMetadata.verificationStatus}. Renewal is NOT auto-completed.`
      )}`
    );
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return { ok: true, icsContent: buildIcsContent(lines), eventCount: entries.length };
}

export function updateSchemeRuleGovernance({
  schemeId,
  actorId,
  role = 'citizen',
  gracePeriodDays,
  sourceUrl,
  effectiveDate,
  lastVerifiedAt,
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (!['admin', 'reviewer'].includes(role)) {
    return { ok: false, code: 403, error: 'Only admin or reviewer roles can update scheme renewal rules.' };
  }
  if (!SCHEME_RENEWAL_RULES[schemeId]) {
    return { ok: false, code: 404, error: 'Scheme rule not found.' };
  }

  const store = readStore(storage);
  const verified = Boolean(sourceUrl && effectiveDate && lastVerifiedAt);
  store.ruleOverrides[schemeId] = {
    gracePeriodDays: Number.isFinite(Number(gracePeriodDays))
      ? Number(gracePeriodDays)
      : SCHEME_RENEWAL_RULES[schemeId].gracePeriodDays,
    sourceUrl: sourceUrl || SCHEME_RENEWAL_RULES[schemeId].sourceUrl,
    effectiveDate: effectiveDate || null,
    lastVerifiedAt: lastVerifiedAt || null,
    verificationStatus: verified ? 'VERIFIED' : 'UNVERIFIED',
  };
  store.auditLog.push({
    auditId: makeId('aud'),
    timestamp: new Date().toISOString(),
    actorId,
    role,
    action: 'update_scheme_rule',
    schemeId,
  });
  writeStore(store, storage);
  return { ok: true, rule: { ...SCHEME_RENEWAL_RULES[schemeId], ...store.ruleOverrides[schemeId] } };
}
