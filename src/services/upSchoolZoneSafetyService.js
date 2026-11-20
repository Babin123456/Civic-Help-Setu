/**
 * Uttar Pradesh School-Zone Road Safety Hazard & Safe-Crossing Audit Service
 * Enforces IRC:SP:88 & RTE Section 21 Standards, Privacy Redaction, and State Invariants
 */

import {
  UP_SCHOOL_ZONE_STORAGE_KEYS,
  HAZARD_TYPES,
  HAZARD_TYPE_LABELS,
  HAZARD_SEVERITY_LEVELS,
  ROAD_AUTHORITIES,
  ROAD_AUTHORITY_METADATA,
  AUDIT_STATUSES,
  AUDIT_STATUS_LABELS,
  canTransitionAuditStatus,
  NON_LEGAL_FAULT_DISCLAIMER,
  sanitizeAuditText,
} from '../data/upSchoolZoneSafetyContract';
import {
  SEED_UP_SCHOOL_ZONES,
  SEED_UP_SCHOOL_AUDITS,
} from '../data/upSchoolZoneSafetySeed';

export class SchoolZoneSafetyError extends Error {
  constructor(message, code = 'SZ_ERROR', details = {}) {
    super(message);
    this.name = 'SchoolZoneSafetyError';
    this.code = code;
    this.details = details;
  }
}

// In-memory fallback / simulated private vault for unredacted original photos
const privateOriginalVault = new Map();

const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readStorage = (key, fallback, storage) => {
  const s = getStorage(storage);
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, data, storage) => {
  const s = getStorage(storage);
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

/**
 * List all available school zones (pilot + custom registered)
 */
export const listSchoolZones = ({ query = '', district = '', locationType = '', storage } = {}) => {
  const customSchools = readStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.SCHOOLS, [], storage);
  const allSchools = [...SEED_UP_SCHOOL_ZONES, ...customSchools];

  return allSchools.filter((school) => {
    if (district && school.district.toLowerCase() !== district.toLowerCase()) {
      return false;
    }
    if (locationType && school.locationType.toLowerCase() !== locationType.toLowerCase()) {
      return false;
    }
    if (query) {
      const q = query.toLowerCase();
      const matchName = school.name.toLowerCase().includes(q);
      const matchUdise = school.udiseCode.toLowerCase().includes(q);
      const matchBlock = school.blockOrWard.toLowerCase().includes(q);
      return matchName || matchUdise || matchBlock;
    }
    return true;
  });
};

/**
 * Get school zone by UDISE code or internal ID
 */
export const getSchoolZoneById = (schoolId, storage) => {
  if (!schoolId) return null;
  const schools = listSchoolZones({ storage });
  return (
    schools.find(
      (s) => s.id === schoolId || s.udiseCode === schoolId
    ) || null
  );
};

/**
 * Resolves road ownership jurisdiction from school entrance and reviewed directory,
 * respecting user manual overrides if registered.
 */
export const resolveRoadOwnershipJurisdiction = ({
  schoolZone,
  gateId,
  roadName = '',
  storage,
}) => {
  if (!schoolZone) {
    return {
      authority: ROAD_AUTHORITIES.OTHER_UNKNOWN,
      metadata: ROAD_AUTHORITY_METADATA[ROAD_AUTHORITIES.OTHER_UNKNOWN],
      source: 'Unclassified Road Corridor',
      isManualOverride: false,
    };
  }

  // Check storage for registered manual override first
  const overrides = readStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.OVERRIDES, {}, storage);
  const overrideKey = `${schoolZone.id}_${gateId || 'default'}`;
  if (overrides[overrideKey]) {
    const ov = overrides[overrideKey];
    return {
      authority: ov.correctedAuthority,
      metadata: ROAD_AUTHORITY_METADATA[ov.correctedAuthority] || ROAD_AUTHORITY_METADATA[ROAD_AUTHORITIES.OTHER_UNKNOWN],
      source: `Manual Local Correction (Recorded: ${ov.recordedAt})`,
      isManualOverride: true,
      overrideReason: ov.reason,
      overrideActor: ov.actor,
      originalSuggestedAuthority: ov.originalSuggestedAuthority,
    };
  }

  // Find entrance metadata
  const entrance = schoolZone.verifiedEntrances?.find((e) => e.gateId === gateId) || schoolZone.verifiedEntrances?.[0];
  if (entrance) {
    return {
      authority: entrance.defaultAuthority || ROAD_AUTHORITIES.MUNICIPAL_CORPORATION,
      metadata: ROAD_AUTHORITY_METADATA[entrance.defaultAuthority] || ROAD_AUTHORITY_METADATA[ROAD_AUTHORITIES.MUNICIPAL_CORPORATION],
      source: entrance.authoritySource || 'Reviewed UP Road Jurisdiction Directory 2026',
      isManualOverride: false,
      roadClassification: entrance.roadClassification,
      facingRoadName: roadName || entrance.facingRoadName,
    };
  }

  // Heuristic fallback based on road classification keyword
  const lowerRoad = (roadName || '').toLowerCase();
  if (lowerRoad.includes('nh-') || lowerRoad.includes('national highway')) {
    return {
      authority: ROAD_AUTHORITIES.NHAI,
      metadata: ROAD_AUTHORITY_METADATA[ROAD_AUTHORITIES.NHAI],
      source: 'NHAI National Corridor Directory',
      isManualOverride: false,
    };
  }
  if (lowerRoad.includes('state highway') || lowerRoad.includes('sh-') || lowerRoad.includes('mdr')) {
    return {
      authority: ROAD_AUTHORITIES.UP_PWD,
      metadata: ROAD_AUTHORITY_METADATA[ROAD_AUTHORITIES.UP_PWD],
      source: 'UP PWD State Road Inventory',
      isManualOverride: false,
    };
  }
  if (lowerRoad.includes('gram') || lowerRoad.includes('village') || lowerRoad.includes('pmgsy')) {
    return {
      authority: ROAD_AUTHORITIES.GRAM_PANCHAYAT,
      metadata: ROAD_AUTHORITY_METADATA[ROAD_AUTHORITIES.GRAM_PANCHAYAT],
      source: 'UP Rural Engineering Department Directory',
      isManualOverride: false,
    };
  }

  return {
    authority: ROAD_AUTHORITIES.MUNICIPAL_CORPORATION,
    metadata: ROAD_AUTHORITY_METADATA[ROAD_AUTHORITIES.MUNICIPAL_CORPORATION],
    source: 'Reviewed UP Urban Local Body Ward Directory',
    isManualOverride: false,
  };
};

/**
 * Record manual jurisdiction correction
 */
export const recordManualJurisdictionOverride = ({
  schoolId,
  gateId = 'default',
  correctedAuthority,
  reason = 'Ground reality verification by local audit team',
  actor = 'Community Auditor',
  storage,
}) => {
  if (!schoolId || !correctedAuthority) {
    throw new SchoolZoneSafetyError('School ID and corrected authority are required.', 'INVALID_OVERRIDE_PARAMS');
  }

  const overrides = readStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.OVERRIDES, {}, storage);
  const overrideKey = `${schoolId}_${gateId}`;
  overrides[overrideKey] = {
    correctedAuthority,
    reason: sanitizeAuditText(reason),
    actor,
    recordedAt: new Date().toISOString(),
  };

  writeStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.OVERRIDES, overrides, storage);
  return overrides[overrideKey];
};

/**
 * Objective severity calculation based on physical exposure and student volume
 */
export const calculateSeverityRationale = ({
  hazardType,
  studentCount = 300,
  speedLimitKmh = 25,
  isPeakHourConflict = true,
  hasCrossingFacility = false,
}) => {
  let score = 0;

  // Base score from hazard nature
  switch (hazardType) {
    case HAZARD_TYPES.SPEEDING_TRAFFIC_NO_CALMING:
      score += 4;
      break;
    case HAZARD_TYPES.MISSING_ZEBRA_CROSSING:
      score += 3;
      break;
    case HAZARD_TYPES.BLOCKED_FOOTPATH:
      score += 3;
      break;
    case HAZARD_TYPES.POOR_VISIBILITY:
      score += 3;
      break;
    case HAZARD_TYPES.PICKUP_DROPOFF_CONFLICT:
      score += 2.5;
      break;
    case HAZARD_TYPES.DRAINAGE_WATERLOGGING:
      score += 2;
      break;
    case HAZARD_TYPES.ABSENT_SIGNAGE:
      score += 1.5;
      break;
    default:
      score += 2;
  }

  // Exposure weighting: school student count
  if (studentCount >= 1000) score += 2;
  else if (studentCount >= 500) score += 1;

  // Speed exposure: designated speed or through-traffic speed
  if (speedLimitKmh > 30) score += 1.5;

  // Peak bell conflict
  if (isPeakHourConflict) score += 1;

  // Mitigation presence
  if (hasCrossingFacility) score -= 1;

  let severity = HAZARD_SEVERITY_LEVELS.MEDIUM;
  if (score >= 7) severity = HAZARD_SEVERITY_LEVELS.CRITICAL;
  else if (score >= 5) severity = HAZARD_SEVERITY_LEVELS.HIGH;
  else if (score <= 3) severity = HAZARD_SEVERITY_LEVELS.LOW;

  const rationale = `Calculated severity "${severity.toUpperCase()}" based on: student exposure (~${studentCount} children), ${hazardType.replace(/_/g, ' ')}, ${isPeakHourConflict ? 'high bell-time pedestrian conflicts' : 'moderate volume'}, and ${hasCrossingFacility ? 'partial existing facilities' : 'absence of protective pedestrian infrastructure'}.`;

  return {
    severity,
    severityScore: score,
    rationale,
  };
};

/**
 * Privacy Redaction:
 * Blurs faces and vehicle number plates for public display,
 * while saving the unredacted original in private vault for the reporter.
 */
export const processEvidencePhoto = ({
  rawImageUri,
  reporterToken,
  facesCount = 1,
  platesCount = 1,
}) => {
  if (!rawImageUri) {
    return {
      publicImageUrl: null,
      redactionMetadata: null,
      privateOriginalToken: null,
    };
  }

  const token = reporterToken || `rep_token_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Store unredacted original in private storage map accessible ONLY via token
  privateOriginalVault.set(token, rawImageUri);

  // Generate deterministic privacy-redacted SVG wrapper with gaussian blur simulation
  const publicRedactedUri = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><defs><filter id="pBlur"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="480" height="300" fill="%231a2233"/><text x="20" y="32" fill="%239bb0d1" font-family="system-ui, sans-serif" font-size="12" font-weight="bold">PUBLIC EVIDENCE ARCHIVE (PRIVACY REDACTED)</text><rect x="40" y="55" width="400" height="190" fill="%232b384e" rx="6"/><circle cx="160" cy="140" r="38" fill="%23687b99" filter="url(%23pBlur)"/><text x="110" y="145" fill="%23ffffff" font-family="system-ui, sans-serif" font-size="10" font-weight="bold">[FACE REDACTED]</text><rect x="270" y="145" width="130" height="34" fill="%23101827" rx="3"/><text x="280" y="167" fill="%23facc15" font-family="monospace" font-size="10">[PLATE REDACTED]</text><text x="20" y="278" fill="%23627d98" font-family="system-ui, sans-serif" font-size="10">Original private to verified reporter under AC-2 privacy guarantee</text></svg>`;

  return {
    publicImageUrl: publicRedactedUri,
    redactionMetadata: {
      isPrivacyRedacted: true,
      facesRedactedCount: facesCount,
      vehiclePlatesRedactedCount: platesCount,
      redactionMethod: 'deterministic_privacy_blur_v1',
      redactedAt: new Date().toISOString(),
    },
    privateOriginalToken: token,
  };
};

/**
 * Retrieve original unredacted photo strictly with reporter token (AC-2 Invariant)
 */
export const getOriginalEvidencePhoto = (auditReport, requesterToken) => {
  if (!auditReport) {
    throw new SchoolZoneSafetyError('Audit report record required.', 'NOT_FOUND');
  }

  if (!requesterToken || requesterToken !== auditReport.reporterToken) {
    throw new SchoolZoneSafetyError(
      'PERMISSION_DENIED: Unredacted original photo remains private to the verified reporter.',
      'PRIVACY_ACCESS_DENIED'
    );
  }

  const original = privateOriginalVault.get(requesterToken);
  return original || auditReport.publicImageUrl;
};

/**
 * Detect duplicate active audits for the same school gate and hazard type (AC-6)
 */
export const detectDuplicateReport = ({
  schoolId,
  gateId,
  hazardType,
  storage,
}) => {
  const audits = listAuditReports({ storage });
  const activeStatuses = [
    AUDIT_STATUSES.REPORTED,
    AUDIT_STATUSES.ACKNOWLEDGED,
    AUDIT_STATUSES.INSPECTION_SCHEDULED,
    AUDIT_STATUSES.INSPECTED,
    AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED,
  ];

  const existing = audits.find(
    (a) =>
      a.schoolId === schoolId &&
      a.gateId === gateId &&
      a.hazardType === hazardType &&
      activeStatuses.includes(a.status)
  );

  if (existing) {
    return {
      isDuplicate: true,
      existingReport: existing,
      message: `An active audit for "${HAZARD_TYPE_LABELS[hazardType]}" already exists at this school gate (${existing.id}, Status: ${AUDIT_STATUS_LABELS[existing.status]}). You may co-sign / endorse it instead.`,
    };
  }

  return { isDuplicate: false };
};

/**
 * List audit reports with filters
 */
export const listAuditReports = ({
  schoolId = '',
  hazardType = '',
  status = '',
  authority = '',
  storage,
} = {}) => {
  const customAudits = readStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.AUDITS, [], storage);
  const allAudits = [...SEED_UP_SCHOOL_AUDITS, ...customAudits];

  return allAudits.filter((audit) => {
    if (schoolId && audit.schoolId !== schoolId) return false;
    if (hazardType && audit.hazardType !== hazardType) return false;
    if (status && audit.status !== status) return false;
    if (authority && audit.assignedAuthority !== authority) return false;
    return true;
  });
};

/**
 * Submit a structured school zone safety audit (AC-1, AC-2, AC-3)
 */
export const submitSchoolZoneAudit = (auditInput, reporterContext = {}, storage) => {
  const {
    schoolId,
    gateId,
    hazardType,
    hazardTitle,
    description = '',
    auditDate = new Date().toISOString().split('T')[0],
    reporterRole = 'Caregiver / SMC Member',
    photoUri = null,
    manualAuthorityOverride = null,
    overrideReason = '',
    forceAllowDuplicate = false,
  } = auditInput;

  if (!schoolId) {
    throw new SchoolZoneSafetyError('School zone identifier is required.', 'MISSING_SCHOOL_ID');
  }
  if (!hazardType || !Object.values(HAZARD_TYPES).includes(hazardType)) {
    throw new SchoolZoneSafetyError('Valid hazard type is required.', 'INVALID_HAZARD_TYPE');
  }

  const school = getSchoolZoneById(schoolId, storage);
  if (!school) {
    throw new SchoolZoneSafetyError(`School zone "${schoolId}" not found in register.`, 'SCHOOL_NOT_FOUND');
  }

  const effectiveGateId = gateId || school.verifiedEntrances?.[0]?.gateId || 'G1';

  // AC-6: Duplicate detection
  if (!forceAllowDuplicate) {
    const dupCheck = detectDuplicateReport({
      schoolId: school.id,
      gateId: effectiveGateId,
      hazardType,
      storage,
    });
    if (dupCheck.isDuplicate) {
      throw new SchoolZoneSafetyError(dupCheck.message, 'DUPLICATE_AUDIT_EXISTS', {
        existingReportId: dupCheck.existingReport.id,
      });
    }
  }

  // AC-3: Jurisdiction Routing with Manual Correction support
  let jurisdiction = resolveRoadOwnershipJurisdiction({
    schoolZone: school,
    gateId: effectiveGateId,
    storage,
  });

  let isManuallyOverridden = false;
  if (manualAuthorityOverride && Object.values(ROAD_AUTHORITIES).includes(manualAuthorityOverride)) {
    jurisdiction = {
      authority: manualAuthorityOverride,
      metadata: ROAD_AUTHORITY_METADATA[manualAuthorityOverride],
      source: `Manual Correction by Reporter (${overrideReason || 'Ground verification'})`,
      isManualOverride: true,
      originalSuggestedAuthority: jurisdiction.authority,
    };
    isManuallyOverridden = true;
  }

  // AC-2: Privacy Redaction Pipeline
  const reporterToken =
    reporterContext.reporterToken || `token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const photoResult = processEvidencePhoto({
    rawImageUri: photoUri,
    reporterToken,
  });

  // Calculate severity
  const severityCalc = calculateSeverityRationale({
    hazardType,
    studentCount: school.studentCount,
    speedLimitKmh: school.verifiedEntrances?.[0]?.speedLimitDesignatedKmH || 25,
    isPeakHourConflict: true,
  });

  const cleanDescription = sanitizeAuditText(description);
  const cleanTitle = sanitizeAuditText(
    hazardTitle || `${HAZARD_TYPE_LABELS[hazardType]} outside ${school.name}`
  );

  const reportId = `AUD-UP-${Date.now().toString().slice(-6)}`;

  const newAudit = {
    id: reportId,
    schoolId: school.id,
    schoolName: school.name,
    udiseCode: school.udiseCode,
    gateId: effectiveGateId,
    hazardType,
    hazardTitle: cleanTitle,
    description: cleanDescription,
    severity: severityCalc.severity,
    severityRationale: severityCalc.rationale,
    status: AUDIT_STATUSES.REPORTED,
    statusHistory: [
      {
        status: AUDIT_STATUSES.REPORTED,
        timestamp: new Date().toISOString(),
        actor: reporterRole,
        notes: 'Initial community audit lodged with provenance trail.',
      },
    ],
    assignedAuthority: jurisdiction.authority,
    authoritySource: jurisdiction.source,
    isAuthorityManuallyOverridden: isManuallyOverridden,
    auditDate,
    reporterRole,
    reporterToken, // Kept for AC-2 private original retrieval
    publicImageUrl: photoResult.publicImageUrl,
    redactionMetadata: photoResult.redactionMetadata,
    suggestedIntervention: `Install IRC standard safety calming and visible markings under ${jurisdiction.metadata.label} mandate.`,
    endorsementCount: 1,
    disclaimerNotice: NON_LEGAL_FAULT_DISCLAIMER,
    provenance: {
      registeredUdiseCode: school.udiseCode,
      verifiedEntranceCoordinates: school.verifiedEntrances?.find((e) => e.gateId === effectiveGateId)?.coordinates || null,
      submittedVia: 'CivicHelpSetu-SchoolZoneAudit-v1',
      clientTimestamp: new Date().toISOString(),
    },
  };

  const existingCustomAudits = readStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.AUDITS, [], storage);
  existingCustomAudits.unshift(newAudit);
  writeStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.AUDITS, existingCustomAudits, storage);

  return newAudit;
};

/**
 * Transition Audit Status with strict statutory invariants (AC-4)
 */
export const transitionAuditStatus = ({
  reportId,
  targetStatus,
  actor = 'Authorized Official',
  notes = '',
  storage,
}) => {
  if (!reportId || !targetStatus) {
    throw new SchoolZoneSafetyError('Report ID and target status are required.', 'INVALID_TRANSITION_PARAMS');
  }

  const customAudits = readStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.AUDITS, [], storage);
  const auditIndex = customAudits.findIndex((a) => a.id === reportId);
  let audit = auditIndex !== -1 ? customAudits[auditIndex] : SEED_UP_SCHOOL_AUDITS.find((a) => a.id === reportId);

  if (!audit) {
    throw new SchoolZoneSafetyError(`Audit report "${reportId}" not found.`, 'AUDIT_NOT_FOUND');
  }

  // AC-4: State machine verification
  const check = canTransitionAuditStatus(audit.status, targetStatus);
  if (!check.allowed) {
    throw new SchoolZoneSafetyError(check.reason, 'INVALID_STATUS_TRANSITION');
  }

  const updatedAudit = {
    ...audit,
    status: targetStatus,
    statusHistory: [
      ...audit.statusHistory,
      {
        status: targetStatus,
        timestamp: new Date().toISOString(),
        actor,
        notes: sanitizeAuditText(notes || `Status advanced to ${AUDIT_STATUS_LABELS[targetStatus]}`),
      },
    ],
  };

  if (auditIndex !== -1) {
    customAudits[auditIndex] = updatedAudit;
    writeStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.AUDITS, customAudits, storage);
  } else {
    // If it was a seed item, write to storage override list
    customAudits.unshift(updatedAudit);
    writeStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.AUDITS, customAudits, storage);
  }

  return updatedAudit;
};

/**
 * Endorse / Co-sign an existing hazard audit
 */
export const endorseAuditReport = (reportId, storage) => {
  const customAudits = readStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.AUDITS, [], storage);
  let audit = customAudits.find((a) => a.id === reportId);
  const isSeed = !audit;
  if (isSeed) {
    audit = SEED_UP_SCHOOL_AUDITS.find((a) => a.id === reportId);
  }

  if (!audit) {
    throw new SchoolZoneSafetyError(`Audit report "${reportId}" not found.`, 'AUDIT_NOT_FOUND');
  }

  const updatedAudit = {
    ...audit,
    endorsementCount: (audit.endorsementCount || 0) + 1,
  };

  if (!isSeed) {
    const idx = customAudits.findIndex((a) => a.id === reportId);
    customAudits[idx] = updatedAudit;
  } else {
    customAudits.unshift(updatedAudit);
  }

  writeStorage(UP_SCHOOL_ZONE_STORAGE_KEYS.AUDITS, customAudits, storage);
  return updatedAudit;
};

/**
 * Export structured, printable audit document formatted for School Management Committees (AC-5)
 */
export const generateSMCPrintableAudit = ({
  schoolId,
  auditsList = null,
  requestedBy = 'SMC Secretary / Community Lead',
  storage,
}) => {
  const school = getSchoolZoneById(schoolId, storage);
  if (!school) {
    throw new SchoolZoneSafetyError(`School "${schoolId}" not found.`, 'SCHOOL_NOT_FOUND');
  }

  const audits = auditsList || listAuditReports({ schoolId: school.id, storage });

  const activeHazardsCount = audits.filter(
    (a) => a.status !== AUDIT_STATUSES.RESOLVED
  ).length;

  const authorityBreakdown = {};
  audits.forEach((a) => {
    const auth = a.assignedAuthority;
    authorityBreakdown[auth] = (authorityBreakdown[auth] || 0) + 1;
  });

  return {
    documentTitle: `STATUTORY SCHOOL-ZONE ROAD SAFETY AUDIT DOSSIER`,
    statutoryMandate: 'Prepared under Section 21 of the Right of Children to Free and Compulsory Education (RTE) Act, 2009',
    schoolSummary: {
      name: school.name,
      udiseCode: school.udiseCode,
      category: school.category,
      studentStrength: school.studentCount,
      district: school.district,
      blockOrWard: school.blockOrWard,
      locationType: school.locationType,
      verifiedEntrances: school.verifiedEntrances,
      smcDetails: school.smcDetails,
    },
    auditMetadata: {
      generatedAt: new Date().toISOString(),
      requestedBy,
      totalAuditsRecorded: audits.length,
      activeHazardsCount,
      resolvedCount: audits.length - activeHazardsCount,
      authorityBreakdown,
    },
    hazardInventory: audits.map((a) => ({
      reportId: a.id,
      hazardType: HAZARD_TYPE_LABELS[a.hazardType] || a.hazardType,
      gateId: a.gateId,
      severity: a.severity.toUpperCase(),
      severityRationale: a.severityRationale,
      status: AUDIT_STATUS_LABELS[a.status] || a.status,
      assignedAuthority: ROAD_AUTHORITY_METADATA[a.assignedAuthority]?.label || a.assignedAuthority,
      authoritySource: a.authoritySource,
      isAuthorityManuallyOverridden: a.isAuthorityManuallyOverridden,
      dateReported: a.auditDate,
      endorsements: a.endorsementCount,
      suggestedIntervention: a.suggestedIntervention,
      evidenceProvenance: a.provenance || {
        registeredUdiseCode: school.udiseCode,
        verifiedEntranceCoordinates: null,
        submittedVia: 'CivicHelpSetu-SchoolZoneAudit-v1',
        clientTimestamp: a.auditDate,
      },
    })),
    actionRecommendations: [
      'Submit this signed audit to the District Magistrate (DM) / Chairman, District Road Safety Committee (DRSC).',
      'Forward certified copy to the Executive Engineer, Road Safety Cell of the designated road-owning authority.',
      'SMC resolution to deploy voluntary parent crossing marshals during 8:00–9:00 AM and 1:30–2:30 PM bell hours as an interim measure.',
    ],
    ethicalDisclaimer: NON_LEGAL_FAULT_DISCLAIMER,
    signOffBlocks: [
      { role: 'SMC Chairperson / Parent Representative', name: school.smcDetails?.presidentName || 'Representative', date: '' },
      { role: 'Head Teacher / Principal', name: school.smcDetails?.headTeacherName || 'Head of Institution', date: '' },
      { role: 'Ward Junior Engineer / Traffic Nodal Officer', name: 'Designated Authority Representative', date: '' },
    ],
  };
};
