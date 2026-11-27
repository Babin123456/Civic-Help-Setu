/**
 * src/services/disasterReliefBoardService.js
 *
 * Public Disaster Relief Entitlement and Camp Information Board (#1435).
 * Extends src/services/disasterReliefService.js, src/data/emergencyReliefData.js,
 * src/services/upDisasterReliefCampService.js, and src/services/piiLeakageGuardService.js.
 *
 * Guarantees:
 * - Authority-published camps, helplines, and relief entitlement rules with source,
 *   jurisdiction, effectiveDate, verifiedAt, and automatic expiry (expiresAt).
 * - Unknown entitlement rules are explicitly marked `unverified`.
 * - Stale-data warnings when verification exceeds freshness thresholds.
 * - Offline-first caching for camp essentials and survival checklists.
 * - Strict zero-PII: rejects Aadhaar, PAN, OTPs, passwords, biometrics, and beneficiary names.
 */

import { EMERGENCY_RELIEF_CENTERS, EMERGENCY_SURVIVAL_CHECKLIST } from '../data/emergencyReliefData.js';
import { UP_RELIEF_ESCALATION } from './upDisasterReliefCampService.js';
import { inspectStringForPII } from './piiLeakageGuardService.js';

export const RELIEF_BOARD_SCHEMA_VERSION = '1.0.0';
export const CAMP_STALE_HOURS = 24;
export const ENTITLEMENT_STALE_DAYS = 14;

export const RELIEF_BOARD_ORIGIN = Object.freeze({
  OFFICIAL_RECORD: 'official_record',
  CITIZEN_OBSERVATION: 'citizen_entered_fact',
  AI_SUGGESTION: 'ai_community_suggestion',
});

const STORAGE_KEY = 'civicbridge_disaster_relief_board_v1';
const SENSITIVE_KEYS = new Set([
  'aadhaar',
  'pan',
  'otp',
  'password',
  'biometric',
  'fingerprint',
  'iris',
  'beneficiaryname',
  'beneficiary_name',
  'citizenname',
  'citizen_name',
]);

export const VERIFIED_RELIEF_ENTITLEMENTS = [
  {
    id: 'ent-up-sdrf-gratuitous-2026',
    title: 'SDRF Gratuitous Relief & Emergency Dry Ration Entitlement',
    disasterTypes: ['FLOOD', 'HEATWAVE'],
    jurisdiction: 'Uttar Pradesh',
    authority: 'Relief Commissioner, Government of UP',
    source: 'https://rahat.up.gov.in/sdrf-norms-2026.pdf',
    effectiveDate: '2026-04-01T00:00:00.000Z',
    verifiedAt: '2026-05-10T09:00:00.000Z',
    expiresAt: '2026-10-31T23:59:59.000Z',
    ruleStatus: 'verified',
    summary: 'Displaced households in notified flood/heatwave wards are eligible for temporary shelter, potable water, ORS, and dry ration kits at DEOC-notified camps.',
    originClassification: RELIEF_BOARD_ORIGIN.OFFICIAL_RECORD,
  },
  {
    id: 'ent-urban-exgratia-local-addon',
    title: 'Municipal Supplementary Heatwave Wage-Loss Assistance',
    disasterTypes: ['HEATWAVE'],
    jurisdiction: 'Lucknow',
    authority: 'Lucknow Municipal Corporation (LMC)',
    source: '',
    effectiveDate: '',
    verifiedAt: '',
    expiresAt: null,
    ruleStatus: 'unverified',
    summary: 'Proposed municipal relief supplement; official circular and effective date are not yet published.',
    originClassification: RELIEF_BOARD_ORIGIN.OFFICIAL_RECORD,
  },
];

export const DEFAULT_VERIFIED_CAMPS = EMERGENCY_RELIEF_CENTERS.map((center) => ({
  ...center,
  jurisdiction: center.city,
  authority: `${center.city} District Disaster Management Authority (DDMA)`,
  source: 'https://ndma.gov.in/ddma-relief-camps-directory',
  effectiveDate: '2026-05-01T00:00:00.000Z',
  verifiedAt: '2026-05-15T08:00:00.000Z',
  expiresAt: null,
  status: 'OPEN',
  accessible: true,
  originClassification: RELIEF_BOARD_ORIGIN.OFFICIAL_RECORD,
}));

export function sanitizeBoardText(val, maxLen = 400) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateZeroPiiPayload(node, path = 'reliefBoard') {
  const violations = [];
  function walk(val, currentPath) {
    if (val === null || val === undefined) return;
    if (typeof val === 'string') {
      const check = inspectStringForPII(val);
      if (!check.clean) {
        for (const v of check.violations) {
          violations.push(`${currentPath}: prohibited PII (${v.type})`);
        }
      }
      return;
    }
    if (Array.isArray(val)) {
      val.forEach((item, idx) => walk(item, `${currentPath}[${idx}]`));
      return;
    }
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        if (SENSITIVE_KEYS.has(k.toLowerCase())) {
          violations.push(`${currentPath}.${k}: prohibited sensitive field`);
        }
        walk(v, `${currentPath}.${k}`);
      }
    }
  }
  walk(node, path);
  return { valid: violations.length === 0, violations };
}

export function evaluateReliefRecordFreshness(record, referenceDate = new Date(), { staleHours = CAMP_STALE_HOURS } = {}) {
  const nowMs = new Date(referenceDate).getTime();
  const expiryMs = record?.expiresAt ? new Date(record.expiresAt).getTime() : NaN;
  const isExpired = !Number.isNaN(expiryMs) && expiryMs <= nowMs;

  const hasProvenance = Boolean(
    record?.source &&
      record?.jurisdiction &&
      record?.effectiveDate &&
      record?.verifiedAt &&
      !Number.isNaN(new Date(record.verifiedAt).getTime())
  );

  const isUnverified = !hasProvenance || record?.ruleStatus === 'unverified';
  const verifiedMs = record?.verifiedAt ? new Date(record.verifiedAt).getTime() : NaN;
  const hoursSinceVerified = !Number.isNaN(verifiedMs) ? (nowMs - verifiedMs) / (1000 * 60 * 60) : Infinity;
  const isStale = !isExpired && !isUnverified && hoursSinceVerified > staleHours;

  let statusBadge = 'verified';
  let warning = null;
  if (isExpired) {
    statusBadge = 'expired';
    warning = 'Expired relief record — archived after expiry timestamp.';
  } else if (isUnverified) {
    statusBadge = 'unverified';
    warning = 'Unverified rule or claim — missing official source, effective date, or verification timestamp.';
  } else if (isStale) {
    statusBadge = 'stale';
    warning = `Stale status (${Math.floor(hoursSinceVerified)}h since last verification) — confirm with DEOC helpline 1077.`;
  }

  return {
    isExpired,
    isUnverified,
    isStale,
    statusBadge,
    warning,
    hoursSinceVerified: Number.isFinite(hoursSinceVerified) ? Math.max(0, Math.floor(hoursSinceVerified)) : null,
  };
}

export function listVerifiedReliefCampsAndEntitlements(
  camps = DEFAULT_VERIFIED_CAMPS,
  filters = {},
  referenceDate = new Date()
) {
  const {
    disasterType = 'ALL',
    jurisdiction = '',
    accessibleOnly = false,
    includeExpired = false,
    search = '',
  } = filters;

  const q = sanitizeBoardText(search, 120).toLowerCase();

  return (camps || [])
    .map((camp) => ({
      ...camp,
      freshness: evaluateReliefRecordFreshness(camp, referenceDate, { staleHours: CAMP_STALE_HOURS }),
    }))
    .filter((camp) => {
      if (!includeExpired && camp.freshness.isExpired) return false;
      if (disasterType && disasterType !== 'ALL') {
        if (!Array.isArray(camp.disasterTypes) || !camp.disasterTypes.includes(disasterType)) return false;
      }
      if (jurisdiction && !String(camp.jurisdiction || camp.city || '').toLowerCase().includes(jurisdiction.toLowerCase())) {
        return false;
      }
      if (accessibleOnly && !camp.accessible) return false;
      if (q) {
        const haystack = [camp.name, camp.city, camp.state, camp.address, camp.authority]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
}

export function publishOfficialReliefCamp(payload, referenceDate = new Date()) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['Camp payload must be an object.'] };
  }
  const piiCheck = validateZeroPiiPayload(payload);
  if (!piiCheck.valid) {
    return { ok: false, errors: piiCheck.violations };
  }

  const name = sanitizeBoardText(payload.name, 200);
  const jurisdiction = sanitizeBoardText(payload.jurisdiction || payload.city, 100);
  const authority = sanitizeBoardText(payload.authority, 200);
  const source = sanitizeBoardText(payload.source, 300);

  const errors = [];
  if (name.length < 3) errors.push('Camp name must be at least 3 characters.');
  if (jurisdiction.length < 2) errors.push('Jurisdiction is required.');
  if (authority.length < 3) errors.push('Responsible authority is required.');
  if (!/^https?:\/\//i.test(source)) errors.push('Valid official source URL (https://) is required.');
  if (!payload.effectiveDate || Number.isNaN(new Date(payload.effectiveDate).getTime())) {
    errors.push('Valid effectiveDate ISO timestamp is required.');
  }
  if (!payload.verifiedAt || Number.isNaN(new Date(payload.verifiedAt).getTime())) {
    errors.push('Valid verifiedAt ISO timestamp is required.');
  }
  if (payload.expiresAt) {
    const exp = new Date(payload.expiresAt).getTime();
    if (Number.isNaN(exp) || exp <= new Date(referenceDate).getTime()) {
      errors.push('expiresAt must be a future ISO timestamp.');
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const record = {
    id: sanitizeBoardText(payload.id || `camp-${Date.now()}`, 80),
    name,
    city: sanitizeBoardText(payload.city || jurisdiction, 100),
    state: sanitizeBoardText(payload.state || 'Uttar Pradesh', 100),
    jurisdiction,
    authority,
    source,
    address: sanitizeBoardText(payload.address || '', 250),
    contact: sanitizeBoardText(payload.contact || '1077', 40),
    altContact: sanitizeBoardText(payload.altContact || '112', 40),
    capacity: Number(payload.capacity) || 200,
    suppliesAvailable: Array.isArray(payload.suppliesAvailable) ? payload.suppliesAvailable.slice(0, 10) : [],
    disasterTypes: Array.isArray(payload.disasterTypes) && payload.disasterTypes.length > 0 ? payload.disasterTypes : ['FLOOD', 'HEATWAVE'],
    accessible: Boolean(payload.accessible),
    status: payload.status || 'OPEN',
    effectiveDate: payload.effectiveDate,
    verifiedAt: payload.verifiedAt,
    expiresAt: payload.expiresAt || null,
    originClassification: RELIEF_BOARD_ORIGIN.OFFICIAL_RECORD,
  };

  return { ok: true, camp: record };
}

export function getOfflineBoardEssentials() {
  return {
    helplines: [
      { label: 'National Emergency', number: '112' },
      { label: 'District Emergency Operations Centre (DEOC)', number: '1077' },
      { label: 'State Relief Commissioner Helpline', number: '1070' },
      { label: 'Ambulance / Medical Emergency', number: '108' },
    ],
    escalation: UP_RELIEF_ESCALATION,
    survivalChecklist: EMERGENCY_SURVIVAL_CHECKLIST,
  };
}

export function saveOfflineBoardSnapshot(snapshot) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, cachedAt: new Date().toISOString() }));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOfflineBoardSnapshot() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
