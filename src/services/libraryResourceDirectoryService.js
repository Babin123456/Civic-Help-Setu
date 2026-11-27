/**
 * src/services/libraryResourceDirectoryService.js
 *
 * Public Library and Community Learning Resource Availability Directory (#1439).
 *
 * Extends src/services/libraryService.js and src/services/piiLeakageGuardService.js to provide:
 * - Official provenance & last-verified freshness tracking (unknown rules marked unverified)
 * - Accessible filters (wheelchair, Braille, screen readers, digital learning lab)
 * - Opening-hour exceptions & temporary schedule notices
 * - Membership requirements & verified facility amenities
 * - Moderated community updates (pending_moderation -> approved/rejected)
 * - Zero-PII enforcement & safe backward-compatible migrations
 */

import { inspectStringForPII } from './piiLeakageGuardService.js';

export const LIBRARY_DIR_SCHEMA_VERSION = '1.0.0';

export const LIBRARY_ORIGIN = {
  OFFICIAL_RECORD: 'official_record',
  COMMUNITY_UPDATE: 'citizen_entered_fact',
  AI_ADVISORY: 'ai_community_suggestion',
};

const SENSITIVE_KEY_REGEX = /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email)$/i;

export function sanitizeLibraryText(val, maxLen = 400) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateLibraryZeroPii(payload, path = 'library') {
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

export function verifyLibraryProvenance(meta = {}, nowMs = Date.now()) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof meta?.[f] !== 'string' || meta[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && meta?.verified !== false;

  let freshness = 'unverified';
  if (verified) {
    const verifiedMs = Date.parse(meta.lastVerifiedAt);
    const ageDays = Number.isFinite(verifiedMs) ? (nowMs - verifiedMs) / (1000 * 60 * 60 * 24) : Infinity;
    freshness = ageDays <= 14 ? 'fresh' : 'stale';
  }

  return {
    source: sanitizeLibraryText(meta?.source || 'Unverified library record', 200),
    jurisdiction: sanitizeLibraryText(meta?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeLibraryText(meta?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeLibraryText(meta?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    freshness,
    missingFields,
  };
}

export function searchLearningFacilities(
  facilities = [],
  {
    query = '',
    wardId = 'all',
    wheelchairOnly = false,
    brailleOnly = false,
    screenReaderOnly = false,
    digitalLabOnly = false,
  } = {}
) {
  const q = String(query || '').trim().toLowerCase();
  return facilities.filter((f) => {
    if (wardId !== 'all' && f.wardId !== wardId) return false;
    if (wheelchairOnly && !f.amenities?.wheelchairAccess) return false;
    if (brailleOnly && !f.amenities?.brailleCollection) return false;
    if (screenReaderOnly && !f.amenities?.screenReaderWorkstation) return false;
    if (digitalLabOnly && !f.amenities?.digitalLab) return false;
    if (q) {
      const hay = `${f.name} ${f.wardId} ${f.membership?.summary || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function addOpeningHourException(
  facility,
  { actorId, role = 'admin', dateRange, adjustedHours, reason, isClosed = false, officialProvenance = {} } = {}
) {
  if (!facility) throw new Error('Facility not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to publish opening-hour exceptions.');

  const piiCheck = validateLibraryZeroPii({ dateRange, adjustedHours, reason, officialProvenance }, 'exception');
  if (!piiCheck.valid) throw new Error(piiCheck.violations[0]);

  const cleanReason = sanitizeLibraryText(reason, 300);
  if (cleanReason.length < 4) throw new Error('Exception reason (min 4 chars) is required.');

  const provenance = verifyLibraryProvenance(officialProvenance);
  const now = new Date().toISOString();

  const exc = {
    exceptionId: `exc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: LIBRARY_ORIGIN.OFFICIAL_RECORD,
    dateRange: sanitizeLibraryText(dateRange || now.slice(0, 10), 60),
    adjustedHours: isClosed ? 'Closed' : sanitizeLibraryText(adjustedHours || 'Modified hours', 60),
    isClosed: Boolean(isClosed),
    reason: cleanReason,
    officialProvenance: provenance,
    publishedBy: sanitizeLibraryText(actorId, 64),
    publishedAt: now,
  };

  return {
    ...facility,
    openingHourExceptions: [exc, ...(facility.openingHourExceptions || [])],
    updatedAt: now,
  };
}

export function submitCommunityLibraryUpdate(facility, input, actorId = 'citizen') {
  if (!facility) throw new Error('Facility not found.');
  const piiCheck = validateLibraryZeroPii(input, 'communityUpdate');
  if (!piiCheck.valid) throw new Error(`Privacy violation: ${piiCheck.violations[0]}`);

  const field = sanitizeLibraryText(input?.field || 'hours_or_amenity', 64);
  const note = sanitizeLibraryText(input?.note || '', 400);
  if (note.length < 5) throw new Error('Correction note must be at least 5 characters.');

  const now = new Date().toISOString();
  const update = {
    updateId: `libupd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: LIBRARY_ORIGIN.COMMUNITY_UPDATE,
    field,
    note,
    moderationStatus: 'pending_moderation',
    submittedByRef: `cit-${String(actorId).slice(0, 10)}`,
    submittedAt: now,
    moderatedAt: null,
    moderatedBy: null,
  };

  return {
    ...facility,
    communityUpdates: [update, ...(facility.communityUpdates || [])],
    updatedAt: now,
  };
}

export function moderateCommunityLibraryUpdate(
  facility,
  { updateId, decision, actorId, role = 'admin', officialProvenance = {} } = {}
) {
  if (!facility) throw new Error('Facility not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to moderate community updates.');
  if (!['approve', 'reject'].includes(decision)) {
    throw new Error("decision must be 'approve' or 'reject'.");
  }

  const target = (facility.communityUpdates || []).find((u) => u.updateId === updateId);
  if (!target) throw new Error(`Community update '${updateId}' not found.`);

  const now = new Date().toISOString();
  const nextStatus = decision === 'approve' ? 'approved' : 'rejected';
  const verifiedProv = verifyLibraryProvenance(officialProvenance);

  const nextUpdates = facility.communityUpdates.map((u) =>
    u.updateId === updateId
      ? {
          ...u,
          moderationStatus: nextStatus,
          moderatedAt: now,
          moderatedBy: sanitizeLibraryText(actorId, 64),
          officialProvenance: decision === 'approve' ? verifiedProv : null,
        }
      : u
  );

  return {
    ...facility,
    communityUpdates: nextUpdates,
    updatedAt: now,
  };
}

export function getBuiltInLearningFacilities() {
  const now = '2026-11-24T10:00:00.000Z';
  const verifiedProv = verifyLibraryProvenance(
    {
      source: 'State Directorate of Public Libraries',
      jurisdiction: 'IN-UP',
      effectiveDate: '2026-04-01',
      lastVerifiedAt: now,
    },
    Date.parse('2026-11-26T00:00:00.000Z')
  );

  return [
    {
      schemaVersion: LIBRARY_DIR_SCHEMA_VERSION,
      facilityId: 'lib-amiruddaula-central',
      origin: LIBRARY_ORIGIN.OFFICIAL_RECORD,
      name: 'Amir-ud-Daula Public Library & Digital Learning Hub',
      wardId: 'ward-14',
      jurisdiction: 'IN-UP',
      regularHours: '09:00 AM – 07:00 PM (Mon–Sat)',
      amenities: {
        readingRoom: true,
        digitalLab: true,
        wifiAccess: true,
        wheelchairAccess: true,
        brailleCollection: true,
        screenReaderWorkstation: true,
      },
      membership: {
        summary: 'Free reading room; refundable Rs 200 deposit for borrowing card (ID proof at counter).',
        officialProvenance: verifiedProv,
      },
      openingHourExceptions: [
        {
          exceptionId: 'exc-seed-1',
          origin: LIBRARY_ORIGIN.OFFICIAL_RECORD,
          dateRange: '2026-11-28',
          adjustedHours: '10:00 AM – 04:00 PM',
          isClosed: false,
          reason: 'Annual digital lab workstation maintenance.',
          officialProvenance: verifiedProv,
        },
      ],
      communityUpdates: [
        {
          updateId: 'libupd-seed-1',
          origin: LIBRARY_ORIGIN.COMMUNITY_UPDATE,
          field: 'screenReaderWorkstation',
          note: 'NVDA screen reader workstation #2 operational on ground floor.',
          moderationStatus: 'approved',
          submittedByRef: 'cit-seed1',
          submittedAt: now,
          moderatedAt: now,
          moderatedBy: 'admin-seed',
        },
      ],
      officialProvenance: verifiedProv,
      aiAdvisory: {
        origin: LIBRARY_ORIGIN.AI_ADVISORY,
        note: 'AI / Community Advisory (Non-binding): Check opening-hour exceptions before visiting on Nov 28.',
      },
      updatedAt: now,
    },
    {
      schemaVersion: LIBRARY_DIR_SCHEMA_VERSION,
      facilityId: 'lib-ward08-reading-room',
      origin: LIBRARY_ORIGIN.OFFICIAL_RECORD,
      name: 'Ward 08 Community Reading Room',
      wardId: 'ward-08',
      jurisdiction: 'IN-UP',
      regularHours: '08:00 AM – 06:00 PM (Daily)',
      amenities: {
        readingRoom: true,
        digitalLab: false,
        wifiAccess: false,
        wheelchairAccess: true,
        brailleCollection: false,
        screenReaderWorkstation: false,
      },
      membership: {
        summary: 'Open access reading room; no fee required.',
        officialProvenance: verifyLibraryProvenance({ source: 'Community center notice' }), // Unverified
      },
      openingHourExceptions: [],
      communityUpdates: [],
      officialProvenance: verifyLibraryProvenance({ source: 'Community center notice' }),
      aiAdvisory: {
        origin: LIBRARY_ORIGIN.AI_ADVISORY,
        note: 'AI / Community Advisory (Non-binding): Official provenance for this reading room is unverified.',
      },
      updatedAt: now,
    },
  ];
}

export function migrateLibraryDirectoryState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: LIBRARY_DIR_SCHEMA_VERSION,
    facilities: Array.isArray(safe.facilities) ? safe.facilities : getBuiltInLearningFacilities(),
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
