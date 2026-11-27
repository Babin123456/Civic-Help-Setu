/**
 * src/services/schoolDefectRegisterService.js
 *
 * Public School Infrastructure Defect and Follow-Up Register (#1437).
 *
 * Extends src/services/upSchoolFacilityGapService.js and
 * src/services/piiLeakageGuardService.js to provide:
 * - Facility categories mapped to responsible departments
 * - Strict child privacy: zero student names, faces, minor photos, roll numbers, or PII
 * - Evidence moderation (pending_moderation -> approved/rejected)
 * - Append-only status history & department routing
 * - School & ward public progress aggregates
 * - Safe backward-compatible migrations
 */

import { UP_SCHOOL_FACILITY_CATEGORIES } from './upSchoolFacilityGapService.js';
import { inspectStringForPII } from './piiLeakageGuardService.js';

export const SCHOOL_DEFECT_SCHEMA_VERSION = '1.0.0';

export const SCHOOL_DEFECT_ORIGIN = {
  PARENT_REPORT: 'citizen_entered_fact',
  OFFICIAL_RECORD: 'official_record',
  AI_ADVISORY: 'ai_community_suggestion',
};

export const DEFECT_DEPARTMENT_ROUTING = {
  DRINKING_WATER: 'Jal Jeevan Mission / Gram Panchayat Water Cell',
  BOYS_GIRLS_TOILETS: 'Block Education Officer (BEO) & SMC Sanitation Fund',
  CLASSROOM_INFRASTRUCTURE: 'Samagra Shiksha Civil Engineering Wing',
  ELECTRICITY_FANS: 'State DISCOM & School Management Committee',
  RAMP_ACCESSIBILITY: 'PWD / Samagra Shiksha Inclusive Education Wing',
};

export const DEFECT_STATUSES = [
  'reported',
  'routed_to_department',
  'in_repair',
  'verified_resolved',
];

const PROHIBITED_STUDENT_AND_PII_KEYS = new Set([
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
  'studentname',
  'student_name',
  'childname',
  'child_name',
  'minorname',
  'minor_name',
  'rollnumber',
  'roll_number',
  'admissionno',
  'admission_no',
  'parentname',
  'parent_name',
]);

export function sanitizeSchoolText(val, maxLen = 400) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Enforces zero student names, faces, minor identifiers, or PII.
 */
export function validateNoStudentPiiOrFaces(payload, path = 'schoolDefect') {
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
      if (/\b(?:student\s+face|child\s+face|minor\s+photo|selfie\s+with\s+student|roll\s*no\.?\s*\d+)\b/i.test(node)) {
        violations.push(`${currentPath}: student face or minor identifier is strictly prohibited`);
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
        if (PROHIBITED_STUDENT_AND_PII_KEYS.has(norm) || PROHIBITED_STUDENT_AND_PII_KEYS.has(key.trim().toLowerCase())) {
          violations.push(`${currentPath}.${key}: prohibited student or PII field`);
        }
        walk(val, `${currentPath}.${key}`);
      }
    }
  }
  walk(payload, path);
  return { valid: violations.length === 0, violations };
}

export function verifySchoolRuleProvenance(meta = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof meta?.[f] !== 'string' || meta[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && meta?.verified !== false;
  return {
    source: sanitizeSchoolText(meta?.source || 'Unverified school defect record', 200),
    jurisdiction: sanitizeSchoolText(meta?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeSchoolText(meta?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeSchoolText(meta?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

export function createSchoolDefectReport(input, actorId = 'parent') {
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Payload must be a JSON object.'], report: null };
  }

  const privacyCheck = validateNoStudentPiiOrFaces(input, 'report');
  if (!privacyCheck.valid) {
    return { valid: false, errors: privacyCheck.violations, report: null };
  }

  if (input.containsStudentFacesOrMinors === true) {
    return {
      valid: false,
      errors: ['Evidence containing student faces or minors is strictly prohibited.'],
      report: null,
    };
  }
  if (input.evidencePhotoRef && input.exifStripped === false) {
    return {
      valid: false,
      errors: ['Photo EXIF metadata must be stripped before submission.'],
      report: null,
    };
  }

  const errors = [];
  const category = input.category;
  const schoolId = sanitizeSchoolText(input.schoolId, 64);
  const schoolName = sanitizeSchoolText(input.schoolName, 140);
  const wardId = sanitizeSchoolText(input.wardId, 40);
  const summary = sanitizeSchoolText(input.summary, 400);

  if (!UP_SCHOOL_FACILITY_CATEGORIES[category]) {
    errors.push(`category must be one of: ${Object.keys(UP_SCHOOL_FACILITY_CATEGORIES).join(', ')}`);
  }
  if (!schoolId) errors.push('schoolId (e.g. UDISE code) is required.');
  if (!schoolName) errors.push('schoolName is required.');
  if (!wardId) errors.push('wardId is required.');
  if (!summary || summary.length < 5) errors.push('summary must be at least 5 characters.');

  if (errors.length > 0) {
    return { valid: false, errors, report: null };
  }

  const now = new Date().toISOString();
  const routedDepartment = DEFECT_DEPARTMENT_ROUTING[category];
  const report = {
    schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION,
    defectId: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: SCHOOL_DEFECT_ORIGIN.PARENT_REPORT,
    schoolId,
    schoolName,
    wardId,
    jurisdiction: sanitizeSchoolText(input.jurisdiction || 'IN-UP', 64),
    category,
    routedDepartment,
    summary,
    evidencePhotoRef: sanitizeSchoolText(input.evidencePhotoRef || '', 120),
    moderationStatus: 'pending_moderation',
    defectStatus: 'reported',
    reporterRef: `par-${String(actorId).slice(0, 10)}`,
    officialProvenance: verifySchoolRuleProvenance({ source: 'Pending official verification' }),
    statusHistory: [
      {
        status: 'reported',
        origin: SCHOOL_DEFECT_ORIGIN.PARENT_REPORT,
        note: 'Non-identifying defect submitted for evidence moderation.',
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  return { valid: true, errors: [], report };
}

export function moderateSchoolDefectEvidence(
  report,
  { decision, actorId, role = 'admin', note = '', officialProvenance = {} } = {}
) {
  if (!report) throw new Error('Defect report not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to moderate evidence.');
  if (!['approve', 'reject'].includes(decision)) throw new Error("decision must be 'approve' or 'reject'.");

  const now = new Date().toISOString();
  const verifiedProv = verifySchoolRuleProvenance(officialProvenance);
  const nextMod = decision === 'approve' ? 'approved' : 'rejected';
  const nextDefectStatus = decision === 'approve' ? 'routed_to_department' : report.defectStatus;

  return {
    ...report,
    moderationStatus: nextMod,
    defectStatus: nextDefectStatus,
    officialProvenance: decision === 'approve' ? verifiedProv : report.officialProvenance,
    statusHistory: [
      {
        status: nextDefectStatus,
        origin: SCHOOL_DEFECT_ORIGIN.OFFICIAL_RECORD,
        note: sanitizeSchoolText(
          note || `Evidence ${nextMod} by ${actorId}; routed to ${report.routedDepartment}.`,
          300
        ),
        timestamp: now,
      },
      ...(report.statusHistory || []),
    ],
    updatedAt: now,
  };
}

export function updateSchoolDefectStatus(
  report,
  { defectStatus, actorId, role = 'admin', note = '', officialProvenance = {} } = {}
) {
  if (!report) throw new Error('Defect report not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to update defect status.');
  if (!DEFECT_STATUSES.includes(defectStatus)) {
    throw new Error(`defectStatus must be one of: ${DEFECT_STATUSES.join(', ')}`);
  }

  const verifiedProv = verifySchoolRuleProvenance(officialProvenance);
  const now = new Date().toISOString();

  return {
    ...report,
    defectStatus,
    officialProvenance: verifiedProv,
    statusHistory: [
      {
        status: defectStatus,
        origin: SCHOOL_DEFECT_ORIGIN.OFFICIAL_RECORD,
        note: sanitizeSchoolText(note || `Status updated to ${defectStatus} by ${actorId}.`, 300),
        timestamp: now,
      },
      ...(report.statusHistory || []),
    ],
    updatedAt: now,
  };
}

export function aggregateSchoolAndWardDefects(reports = [], { wardId = 'all', schoolId = 'all' } = {}) {
  const filtered = reports.filter((r) => {
    if (wardId !== 'all' && r.wardId !== wardId) return false;
    if (schoolId !== 'all' && r.schoolId !== schoolId) return false;
    return true;
  });

  const totalReports = filtered.length;
  const resolvedCount = filtered.filter((r) => r.defectStatus === 'verified_resolved').length;
  const pendingModerationCount = filtered.filter((r) => r.moderationStatus === 'pending_moderation').length;

  const byCategory = {};
  for (const cat of Object.keys(UP_SCHOOL_FACILITY_CATEGORIES)) {
    byCategory[cat] = filtered.filter((r) => r.category === cat).length;
  }

  return {
    totalReports,
    resolvedCount,
    openCount: totalReports - resolvedCount,
    pendingModerationCount,
    byCategory,
    reports: filtered,
    aiAdvisory: {
      origin: SCHOOL_DEFECT_ORIGIN.AI_ADVISORY,
      note:
        totalReports - resolvedCount > 0
          ? `AI / Community Advisory (Non-binding): ${totalReports - resolvedCount} open school infrastructure defect(s) require department follow-up.`
          : 'AI / Community Advisory (Non-binding): All filtered school infrastructure defects are verified resolved.',
    },
  };
}

export function getBuiltInSchoolDefectReports() {
  const now = '2026-11-22T09:00:00.000Z';
  const verifiedProv = verifySchoolRuleProvenance({
    source: 'Operation Kayakalp & BEO Inspection Register',
    jurisdiction: 'IN-UP',
    effectiveDate: '2026-11-01',
    lastVerifiedAt: now,
  });

  return [
    {
      schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION,
      defectId: 'sch-seed-water-01',
      origin: SCHOOL_DEFECT_ORIGIN.PARENT_REPORT,
      schoolId: 'UDISE-09150101',
      schoolName: 'Government Primary School, Chinhat Ward 14',
      wardId: 'ward-14',
      jurisdiction: 'IN-UP',
      category: 'DRINKING_WATER',
      routedDepartment: DEFECT_DEPARTMENT_ROUTING.DRINKING_WATER,
      summary: 'Two drinking water taps near courtyard leaking and low pressure.',
      evidencePhotoRef: 'photo-tap-facility-01',
      moderationStatus: 'approved',
      defectStatus: 'routed_to_department',
      reporterRef: 'par-seed1',
      officialProvenance: verifiedProv,
      statusHistory: [
        {
          status: 'routed_to_department',
          origin: SCHOOL_DEFECT_ORIGIN.OFFICIAL_RECORD,
          note: 'Routed to Jal Jeevan Mission / Gram Panchayat Water Cell.',
          timestamp: now,
        },
        {
          status: 'reported',
          origin: SCHOOL_DEFECT_ORIGIN.PARENT_REPORT,
          note: 'Non-identifying facility defect submitted.',
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION,
      defectId: 'sch-seed-ramp-02',
      origin: SCHOOL_DEFECT_ORIGIN.PARENT_REPORT,
      schoolId: 'UDISE-09150204',
      schoolName: 'Composite Vidyalaya, Alambagh Ward 08',
      wardId: 'ward-08',
      jurisdiction: 'IN-UP',
      category: 'RAMP_ACCESSIBILITY',
      routedDepartment: DEFECT_DEPARTMENT_ROUTING.RAMP_ACCESSIBILITY,
      summary: 'Handrail missing on main classroom block wheelchair ramp.',
      evidencePhotoRef: '',
      moderationStatus: 'pending_moderation',
      defectStatus: 'reported',
      reporterRef: 'par-seed2',
      officialProvenance: verifySchoolRuleProvenance({ source: 'Pending BEO verification' }),
      statusHistory: [
        {
          status: 'reported',
          origin: SCHOOL_DEFECT_ORIGIN.PARENT_REPORT,
          note: 'Submitted for evidence moderation.',
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function migrateSchoolDefectStoreState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: SCHOOL_DEFECT_SCHEMA_VERSION,
    reports: Array.isArray(safe.reports) ? safe.reports : getBuiltInSchoolDefectReports(),
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
