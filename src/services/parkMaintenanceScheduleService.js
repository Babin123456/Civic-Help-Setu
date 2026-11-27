/**
 * src/services/parkMaintenanceScheduleService.js
 *
 * Public Park Maintenance and Amenity Inspection Schedule (#1440).
 *
 * Extends src/services/publicParksDirectoryService.js and
 * src/services/piiLeakageGuardService.js to provide:
 * - Separate tracking for park amenities (play_area, public_toilet, drinking_water, walking_track, lighting)
 * - Published maintenance windows & temporary closure alerts
 * - Source provenance & freshness indicators (unknown rules marked unverified)
 * - Photo moderation for personal data (faces, license plates, unstripped EXIF, caption PII)
 * - Safe backward-compatible migrations
 */

import { inspectStringForPII } from './piiLeakageGuardService.js';

export const PARK_SCHEDULE_SCHEMA_VERSION = '1.0.0';

export const PARK_ORIGIN = {
  OFFICIAL_SCHEDULE: 'official_record',
  RESIDENT_OBSERVATION: 'citizen_entered_fact',
  AI_ADVISORY: 'ai_community_suggestion',
};

export const AMENITY_TYPES = [
  'play_area',
  'public_toilet',
  'drinking_water',
  'walking_track',
  'lighting',
];

export const AMENITY_STATUS = {
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',
  CLOSED_FOR_MAINTENANCE: 'closed_for_maintenance',
  UNVERIFIED: 'unverified',
};

const SENSITIVE_KEY_REGEX = /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email)$/i;
const PERSONAL_PHOTO_PATTERNS = [
  /\b(?:face|selfie|portrait|child\s+face|license\s+plate|number\s+plate|vehicle\s+plate)\b/i,
];

export function sanitizeParkText(val, maxLen = 400) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateParkZeroPii(payload, path = 'park') {
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

export function verifyParkSourceProvenance(sourceMeta = {}, nowMs = Date.now()) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof sourceMeta?.[f] !== 'string' || sourceMeta[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && sourceMeta?.verified !== false;

  let freshness = 'unverified';
  if (verified) {
    const verifiedMs = Date.parse(sourceMeta.lastVerifiedAt);
    const ageDays = Number.isFinite(verifiedMs) ? (nowMs - verifiedMs) / (1000 * 60 * 60 * 24) : Infinity;
    freshness = ageDays <= 7 ? 'fresh' : 'stale';
  }

  return {
    source: sanitizeParkText(sourceMeta?.source || 'Unverified park notice', 200),
    jurisdiction: sanitizeParkText(sourceMeta?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeParkText(sourceMeta?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeParkText(sourceMeta?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    freshness,
    missingFields,
  };
}

/**
 * Moderates submitted photo metadata/captions for personal data (faces, plates, EXIF, PII).
 */
export function moderatePhotoForPersonalData({
  photoRef = '',
  photoCaption = '',
  containsFacesOrPlates = false,
  exifStripped = true,
} = {}) {
  const reasons = [];
  if (containsFacesOrPlates) {
    reasons.push('Photo flagged as containing recognizable faces or vehicle license plates.');
  }
  if (!exifStripped && photoRef) {
    reasons.push('Photo EXIF metadata (GPS/device identifiers) must be stripped before publishing.');
  }
  const piiCheck = validateParkZeroPii({ photoRef, photoCaption }, 'photo');
  if (!piiCheck.valid) {
    reasons.push(piiCheck.violations[0]);
  }
  for (const pat of PERSONAL_PHOTO_PATTERNS) {
    if (pat.test(photoCaption)) {
      reasons.push('Photo caption references personal identifiers (faces/plates).');
      break;
    }
  }

  return {
    passed: reasons.length === 0,
    moderationStatus: reasons.length === 0 ? 'approved_no_personal_data' : 'held_personal_data_detected',
    reasons,
  };
}

export function publishMaintenanceWindow(
  park,
  { actorId, role = 'admin', amenityType, startAt, endAt, reason, isTemporaryClosure = false, officialSource = {} } = {}
) {
  if (!park) throw new Error('Park not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to publish maintenance windows.');
  if (!AMENITY_TYPES.includes(amenityType)) {
    throw new Error(`amenityType must be one of: ${AMENITY_TYPES.join(', ')}`);
  }

  const piiCheck = validateParkZeroPii({ reason, officialSource }, 'maintenance');
  if (!piiCheck.valid) throw new Error(piiCheck.violations[0]);

  const cleanReason = sanitizeParkText(reason, 300);
  if (cleanReason.length < 4) throw new Error('Maintenance reason (min 4 chars) is required.');

  const verifiedSource = verifyParkSourceProvenance(officialSource);
  const now = new Date().toISOString();

  const win = {
    windowId: `mw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: PARK_ORIGIN.OFFICIAL_SCHEDULE,
    amenityType,
    startAt: sanitizeParkText(startAt || now, 40),
    endAt: sanitizeParkText(endAt || now, 40),
    reason: cleanReason,
    isTemporaryClosure: Boolean(isTemporaryClosure),
    officialSource: verifiedSource,
    publishedBy: sanitizeParkText(actorId, 64),
    publishedAt: now,
  };

  const nextAmenities = park.amenities.map((a) =>
    a.amenityType === amenityType && isTemporaryClosure
      ? { ...a, operationalStatus: AMENITY_STATUS.CLOSED_FOR_MAINTENANCE, lastInspectedAt: now }
      : a
  );

  const nextAlerts = isTemporaryClosure
    ? [
        {
          alertId: `al-${Date.now()}`,
          origin: PARK_ORIGIN.OFFICIAL_SCHEDULE,
          amenityType,
          message: `Temporary Closure (${amenityType}): ${cleanReason}`,
          activeUntil: win.endAt,
          officialSource: verifiedSource,
        },
        ...(park.closureAlerts || []),
      ]
    : park.closureAlerts || [];

  return {
    ...park,
    amenities: nextAmenities,
    maintenanceWindows: [win, ...(park.maintenanceWindows || [])],
    closureAlerts: nextAlerts,
    updatedAt: now,
  };
}

export function submitResidentParkObservation(park, input, actorId = 'resident') {
  if (!park) throw new Error('Park not found.');
  const piiCheck = validateParkZeroPii(input, 'observation');
  if (!piiCheck.valid) throw new Error(`Privacy violation: ${piiCheck.violations[0]}`);

  const amenityType = input?.amenityType;
  if (!AMENITY_TYPES.includes(amenityType)) {
    throw new Error(`amenityType must be one of: ${AMENITY_TYPES.join(', ')}`);
  }

  const note = sanitizeParkText(input?.note || '', 400);
  if (note.length < 5) throw new Error('Observation note must be at least 5 characters.');

  const photoModeration = moderatePhotoForPersonalData({
    photoRef: input?.photoRef || '',
    photoCaption: input?.photoCaption || '',
    containsFacesOrPlates: Boolean(input?.containsFacesOrPlates),
    exifStripped: input?.exifStripped !== false,
  });

  if (!photoModeration.passed) {
    throw new Error(`Photo moderation blocked submission: ${photoModeration.reasons[0]}`);
  }

  const obs = {
    observationId: `pobs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: PARK_ORIGIN.RESIDENT_OBSERVATION,
    amenityType,
    note,
    photoRef: sanitizeParkText(input?.photoRef || '', 120),
    photoModerationStatus: photoModeration.moderationStatus,
    observerRef: `res-${String(actorId).slice(0, 10)}`,
    createdAt: new Date().toISOString(),
  };

  return {
    ...park,
    residentObservations: [obs, ...(park.residentObservations || [])],
    updatedAt: new Date().toISOString(),
  };
}

export function getBuiltInParkSchedules() {
  const now = '2026-11-25T09:00:00.000Z';
  const freshSource = verifyParkSourceProvenance(
    {
      source: 'Lucknow Municipal Parks & Horticulture Division',
      jurisdiction: 'IN-UP',
      effectiveDate: '2026-11-01',
      lastVerifiedAt: now,
    },
    Date.parse('2026-11-26T00:00:00.000Z')
  );

  return [
    {
      schemaVersion: PARK_SCHEDULE_SCHEMA_VERSION,
      parkId: 'park-lohia-ward14',
      name: 'Ram Manohar Lohia Neighbourhood Park',
      wardId: 'ward-14',
      jurisdiction: 'IN-UP',
      municipalOwner: 'Municipal Horticulture & Parks Wing',
      amenities: [
        { amenityType: 'play_area', operationalStatus: AMENITY_STATUS.OPERATIONAL, lastInspectedAt: now, officialSource: freshSource },
        { amenityType: 'public_toilet', operationalStatus: AMENITY_STATUS.CLOSED_FOR_MAINTENANCE, lastInspectedAt: now, officialSource: freshSource },
        { amenityType: 'drinking_water', operationalStatus: AMENITY_STATUS.OPERATIONAL, lastInspectedAt: now, officialSource: freshSource },
        { amenityType: 'walking_track', operationalStatus: AMENITY_STATUS.OPERATIONAL, lastInspectedAt: now, officialSource: freshSource },
        { amenityType: 'lighting', operationalStatus: AMENITY_STATUS.UNVERIFIED, lastInspectedAt: '', officialSource: verifyParkSourceProvenance({ source: 'Pending inspection' }) },
      ],
      maintenanceWindows: [
        {
          windowId: 'mw-seed-1',
          origin: PARK_ORIGIN.OFFICIAL_SCHEDULE,
          amenityType: 'public_toilet',
          startAt: '2026-11-26T06:00:00.000Z',
          endAt: '2026-11-28T18:00:00.000Z',
          reason: 'Plumbing & accessible ramp tile replacement.',
          isTemporaryClosure: true,
          officialSource: freshSource,
        },
      ],
      closureAlerts: [
        {
          alertId: 'al-seed-1',
          origin: PARK_ORIGIN.OFFICIAL_SCHEDULE,
          amenityType: 'public_toilet',
          message: 'Temporary Closure (public_toilet): Plumbing & accessible ramp tile replacement.',
          activeUntil: '2026-11-28T18:00:00.000Z',
          officialSource: freshSource,
        },
      ],
      residentObservations: [
        {
          observationId: 'pobs-seed-1',
          origin: PARK_ORIGIN.RESIDENT_OBSERVATION,
          amenityType: 'drinking_water',
          note: 'Drinking water kiosk tap flowing cleanly at east gate.',
          photoRef: 'photo-clean-tap-01',
          photoModerationStatus: 'approved_no_personal_data',
          observerRef: 'res-seed1',
          createdAt: now,
        },
      ],
      aiAdvisory: {
        origin: PARK_ORIGIN.AI_ADVISORY,
        note: 'AI / Community Advisory (Non-binding): Lighting amenity inspection is unverified; verify operational status before evening visits.',
      },
      updatedAt: now,
    },
  ];
}

export function migrateParkMaintenanceState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: PARK_SCHEDULE_SCHEMA_VERSION,
    parks: Array.isArray(safe.parks) ? safe.parks : getBuiltInParkSchedules(),
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
