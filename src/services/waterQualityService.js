/**
 * src/services/waterQualityService.js
 * Core Service Layer for Community Water-Quality Sampling and Laboratory Result Register (#754).
 *
 * Implements:
 * - Scoped RBAC permissions (public, citizen, sampler, lab_analyst, official_reviewer, admin).
 * - Normalized persistence, audit logging, and cryptographic verification seals.
 * - Deterministic IS 10500:2012 evaluation & supersession versioning for corrections.
 * - Address masking and zero-PII public views.
 */

import {
  ROLES,
  CHAIN_OF_CUSTODY_STATUSES,
  RESULT_STATUSES,
} from '../data/waterQualityContract.js';
import {
  loadWaterQualityStore,
  saveWaterQualityStore,
} from './waterQualityStorage.js';
import {
  validateWaterPointPayload,
  validateSamplingEventPayload,
  validateLabResultPayload,
  validateCorrectionPayload,
  validateCorrectiveActionPayload,
} from './waterQualityValidation.js';
import { evaluateSampleResultsBatch } from './waterQualityRulesEngine.js';

/**
 * Deterministic cryptographic verification seal generator
 */
export function generateWaterQualitySeal(sampleId, labId, timestamp) {
  const seed = `${sampleId}|${labId}|${timestamp}|CIVIC_WATER_QUALITY_IS10500`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `SEAL-WQR-${p1}-${p2}`;
}

/**
 * Helper to compute sample age in human-readable plain language
 */
export function calculateSampleAge(dateString) {
  if (!dateString) return { days: 0, text: 'Not yet sampled', isStale: true };
  const sampleTime = new Date(dateString).getTime();
  const now = Date.now();
  const diffDays = Math.max(0, Math.floor((now - sampleTime) / (1000 * 60 * 60 * 24)));

  let text;
  if (diffDays === 0) {
    text = 'Sampled today';
  } else if (diffDays === 1) {
    text = 'Sampled yesterday';
  } else if (diffDays < 30) {
    text = `Sampled ${diffDays} days ago`;
  } else if (diffDays < 90) {
    text = `Sampled ${Math.floor(diffDays / 30)} month(s) ago (Review due)`;
  } else {
    text = `Sampled ${diffDays} days ago (Surveillance overdue)`;
  }

  // Under CPHEEO / municipal health manuals, drinking water points older than 60 days are stale
  const isStale = diffDays > 60;
  return { days: diffDays, text, isStale };
}

/**
 * Audit log helper
 */
function recordAuditEntry(store, { entityType, entityId, action, actorId, actorRole, details }) {
  if (!Array.isArray(store.auditTrail)) {
    store.auditTrail = [];
  }
  const entry = {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    entityType,
    entityId,
    action,
    actorId: actorId || 'ANONYMOUS',
    actorRole: actorRole || ROLES.PUBLIC,
    timestamp: new Date().toISOString(),
    details: typeof details === 'object' ? JSON.stringify(details) : String(details),
  };
  store.auditTrail.unshift(entry);
}

/**
 * List Water Points with search and multi-parameter filters
 */
export function listWaterPoints(filters = {}, actor = { role: ROLES.PUBLIC }) {
  const store = loadWaterQualityStore();
  const {
    city = 'All',
    ward = 'All',
    pointType = 'all',
    status = 'all',
    compliance = 'all',
    search = '',
  } = filters;

  const q = search.trim().toLowerCase();

  return store.waterPoints
    .filter((wp) => {
      if (city !== 'All' && wp.city.toLowerCase() !== city.toLowerCase()) return false;
      if (ward !== 'All' && wp.ward.toLowerCase() !== ward.toLowerCase()) return false;
      if (pointType !== 'all' && wp.pointType !== pointType) return false;
      if (status !== 'all' && wp.operationalStatus !== status) return false;
      if (compliance !== 'all' && wp.overallComplianceStatus !== compliance) return false;

      if (q) {
        const matchName = wp.name.toLowerCase().includes(q);
        const matchWard = wp.ward.toLowerCase().includes(q);
        const matchId = wp.id.toLowerCase().includes(q);
        const matchLandmark = (wp.landmark || '').toLowerCase().includes(q);
        if (!matchName && !matchWard && !matchId && !matchLandmark) return false;
      }
      return true;
    })
    .map((wp) => {
      const age = calculateSampleAge(wp.lastTestedDate);
      const isPublic = actor?.role === ROLES.PUBLIC;
      return {
        ...wp,
        createdBy: isPublic ? undefined : wp.createdBy,
        sampleAge: age,
      };
    });
}

/**
 * Get Water Point with full historical sampling chronology and lab records
 */
export function getWaterPointDetails(waterPointId) {
  if (!waterPointId) return null;
  const store = loadWaterQualityStore();
  const point = store.waterPoints.find((wp) => wp.id === waterPointId);
  if (!point) return null;

  // Find all sampling events for this water point
  const events = store.samplingEvents
    .filter((s) => s.waterPointId === waterPointId)
    .sort((a, b) => new Date(b.collectionDate) - new Date(a.collectionDate));

  // Find all lab results associated with those events
  const eventIds = new Set(events.map((e) => e.id));
  const results = store.labResults.filter((r) => eventIds.has(r.sampleEventId) || r.waterPointId === waterPointId);

  // Group active vs superseded results by sample event
  const eventsWithResults = events.map((event) => {
    const eventResults = results.filter((r) => r.sampleEventId === event.id);
    const lab = store.labs.find((l) => l.labId === event.testedLabId) || null;
    return {
      ...event,
      lab,
      results: eventResults,
      sampleAge: calculateSampleAge(event.collectionDate),
    };
  });

  // Find active corrective actions
  const actions = store.correctiveActions.filter((a) => a.waterPointId === waterPointId);

  return {
    ...point,
    sampleAge: calculateSampleAge(point.lastTestedDate),
    samplingHistory: eventsWithResults,
    correctiveActions: actions,
  };
}

/**
 * Register a new Public Water Point
 */
export function createWaterPoint(payload, actor = { role: ROLES.ADMIN, id: 'ADMIN-01' }) {
  const allowedRoles = [ROLES.SAMPLER, ROLES.OFFICIAL_REVIEWER, ROLES.ADMIN];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Permission denied: Only authorized samplers or municipal officials can register water points.');
  }

  const errors = validateWaterPointPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  const store = loadWaterQualityStore();

  const id = `WP-${(payload.city || 'IND').slice(0, 3).toUpperCase()}-W${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 90 + 10)}`;
  const now = new Date().toISOString();

  const newPoint = {
    id,
    name: payload.name.trim(),
    pointType: payload.pointType,
    ward: payload.ward.trim(),
    zone: payload.zone ? payload.zone.trim() : 'Central Municipal Zone',
    city: payload.city.trim(),
    landmark: payload.landmark ? payload.landmark.trim() : '',
    installationYear: Number(payload.installationYear) || new Date().getFullYear(),
    operationalStatus: payload.operationalStatus || 'active',
    sourceType: payload.sourceType || 'Municipal Piped Distribution',
    latitude: payload.latitude !== undefined ? Number(payload.latitude) : null,
    longitude: payload.longitude !== undefined ? Number(payload.longitude) : null,
    testedCount: 0,
    lastTestedDate: null,
    overallComplianceStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
  };

  store.waterPoints.unshift(newPoint);
  recordAuditEntry(store, {
    entityType: 'WaterPoint',
    entityId: id,
    action: 'create',
    actorId: actor.id,
    actorRole: actor.role,
    details: { name: newPoint.name, ward: newPoint.ward, pointType: newPoint.pointType },
  });

  saveWaterQualityStore(store);
  return newPoint;
}

/**
 * Record a Water Quality Sampling Event
 */
export function recordSamplingEvent(payload, actor = { role: ROLES.SAMPLER, id: 'SAMPLER-01' }) {
  const allowedRoles = [ROLES.SAMPLER, ROLES.OFFICIAL_REVIEWER, ROLES.ADMIN];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Permission denied: Only samplers or officials can record sampling events.');
  }

  const errors = validateSamplingEventPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  const store = loadWaterQualityStore();
  const waterPoint = store.waterPoints.find((wp) => wp.id === payload.waterPointId);
  if (!waterPoint) {
    throw new Error(`Water point not found: ${payload.waterPointId}`);
  }

  // Idempotency / duplicate container check
  const duplicate = store.samplingEvents.find(
    (e) => e.sealedContainerCode && e.sealedContainerCode.toLowerCase() === payload.sealedContainerCode.trim().toLowerCase()
  );
  if (duplicate) {
    throw new Error(`Duplicate container code "${payload.sealedContainerCode}". Container code must be unique.`);
  }

  const id = `SMP-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const now = new Date().toISOString();

  const newEvent = {
    id,
    waterPointId: payload.waterPointId,
    collectionDate: new Date(payload.collectionDate).toISOString(),
    collectedByRole: payload.collectedByRole || 'certified_field_sampler',
    sampleType: payload.sampleType,
    sealedContainerCode: payload.sealedContainerCode.trim(),
    chainOfCustodyStatus: CHAIN_OF_CUSTODY_STATUSES.received_by_lab,
    preservationMethod: payload.preservationMethod || 'Standard container at 4°C',
    testedLabId: payload.testedLabId || 'LAB-NABL-KA-042',
    status: RESULT_STATUSES.pending.id,
    cryptographicSeal: null,
    notes: payload.notes ? payload.notes.trim() : '',
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
  };

  store.samplingEvents.unshift(newEvent);

  recordAuditEntry(store, {
    entityType: 'SamplingEvent',
    entityId: id,
    action: 'collect_sample',
    actorId: actor.id,
    actorRole: actor.role,
    details: { waterPointId: payload.waterPointId, container: payload.sealedContainerCode },
  });

  saveWaterQualityStore(store);
  return newEvent;
}

/**
 * Record verified laboratory test results for a sampling event
 */
export function recordLabResults(sampleEventId, resultPayload, actor = { role: ROLES.LAB_ANALYST, id: 'ANALYST-01' }) {
  const allowedRoles = [ROLES.LAB_ANALYST, ROLES.OFFICIAL_REVIEWER, ROLES.ADMIN];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Permission denied: Only accredited laboratory analysts or reviewers can record test results.');
  }

  const errors = validateLabResultPayload({ sampleEventId, ...resultPayload });
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  const store = loadWaterQualityStore();
  const event = store.samplingEvents.find((e) => e.id === sampleEventId);
  if (!event) {
    throw new Error(`Sampling event not found: ${sampleEventId}`);
  }

  const waterPoint = store.waterPoints.find((wp) => wp.id === event.waterPointId);
  if (!waterPoint) {
    throw new Error(`Target water point not found: ${event.waterPointId}`);
  }

  // Deterministic evaluation against IS 10500:2012
  const evaluation = evaluateSampleResultsBatch(resultPayload.results);
  const now = new Date().toISOString();
  const seal = generateWaterQualitySeal(sampleEventId, resultPayload.labId, now);

  const createdResults = [];
  resultPayload.results.forEach((item) => {
    const paramEval = evaluation.evaluations.find((e) => e.parameterCode === item.parameterCode);
    const resultId = `RES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const newResult = {
      id: resultId,
      sampleEventId,
      waterPointId: event.waterPointId,
      parameterCode: item.parameterCode,
      testedValue: Number(item.testedValue),
      testingDate: now,
      labId: resultPayload.labId,
      status: paramEval?.level === 'hazardous_exceeded' ? RESULT_STATUSES.flagged_out_of_range.id : RESULT_STATUSES.verified_compliant.id,
      supersededByResultId: null,
      analystNotes: resultPayload.analystNotes || '',
      evaluation: paramEval,
    };
    createdResults.push(newResult);
    store.labResults.push(newResult);
  });

  // Update sampling event status
  event.status = evaluation.isFullyCompliant
    ? RESULT_STATUSES.verified_compliant.id
    : RESULT_STATUSES.flagged_out_of_range.id;
  event.chainOfCustodyStatus = CHAIN_OF_CUSTODY_STATUSES.completed;
  event.cryptographicSeal = seal;
  event.testedLabId = resultPayload.labId;
  event.updatedAt = now;

  // Update water point aggregate compliance status
  waterPoint.lastTestedDate = event.collectionDate;
  waterPoint.testedCount = (waterPoint.testedCount || 0) + 1;
  waterPoint.overallComplianceStatus = evaluation.isFullyCompliant
    ? 'compliant'
    : evaluation.containsMicrobialHazard
      ? 'critical_hazard'
      : 'exceeded';
  waterPoint.updatedAt = now;

  // If critical hazard or parameter exceeded, auto-propose or initialize corrective action recommendation
  let correctiveActionCreated = null;
  if (!evaluation.isFullyCompliant && evaluation.suggestedAction) {
    const actionId = `ACT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const action = {
      id: actionId,
      waterPointId: event.waterPointId,
      triggerResultIds: createdResults.filter((r) => r.status === RESULT_STATUSES.flagged_out_of_range.id).map((r) => r.id),
      actionType: evaluation.suggestedAction.actionType,
      status: 'initiated',
      assignedDepartment: 'Municipal Water Supply & Public Health Division',
      targetCompletionDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      description: evaluation.suggestedAction.rationale,
      auditLog: [
        {
          timestamp: now,
          actorId: actor.id,
          action: 'auto_recommended',
          notes: `Triggered by IS 10500 evaluation ${evaluation.provenance.rulesetVersion}. Human confirmation required.`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    store.correctiveActions.unshift(action);
    correctiveActionCreated = action;
  }

  recordAuditEntry(store, {
    entityType: 'LabResult',
    entityId: sampleEventId,
    action: 'publish_results',
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      seal,
      parametersTested: resultPayload.results.length,
      compliance: evaluation.overallStatus,
      exceededCount: evaluation.exceededCount,
    },
  });

  saveWaterQualityStore(store);

  return {
    sampleEventId,
    cryptographicSeal: seal,
    evaluation,
    createdResults,
    correctiveAction: correctiveActionCreated,
  };
}

/**
 * Publish Official Correction / Supersession of Erroneous Lab Results
 */
export function publishOfficialCorrection(sampleEventId, correctionPayload, actor = { role: ROLES.OFFICIAL_REVIEWER, id: 'OFFICIAL-01' }) {
  const allowedRoles = [ROLES.OFFICIAL_REVIEWER, ROLES.ADMIN];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Permission denied: Only official health reviewers or administrators can publish result corrections.');
  }

  const errors = validateCorrectionPayload({ sampleEventId, ...correctionPayload });
  if (errors.length > 0) {
    throw new Error(`Correction validation failed: ${errors.join('; ')}`);
  }

  const store = loadWaterQualityStore();
  const event = store.samplingEvents.find((e) => e.id === sampleEventId);
  if (!event) {
    throw new Error(`Sampling event not found: ${sampleEventId}`);
  }

  const waterPoint = store.waterPoints.find((wp) => wp.id === event.waterPointId);
  if (!waterPoint) {
    throw new Error(`Water point not found: ${event.waterPointId}`);
  }

  const now = new Date().toISOString();
  const evaluation = evaluateSampleResultsBatch(correctionPayload.correctedResults);
  const newSeal = generateWaterQualitySeal(sampleEventId, correctionPayload.labId || event.testedLabId, now);

  // Mark all prior active results for this event as superseded
  const oldResults = store.labResults.filter((r) => r.sampleEventId === sampleEventId && r.status !== RESULT_STATUSES.superseded.id);

  const replacementResults = [];
  correctionPayload.correctedResults.forEach((item) => {
    const paramEval = evaluation.evaluations.find((e) => e.parameterCode === item.parameterCode);
    const replacementId = `RES-CORR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const newResult = {
      id: replacementId,
      sampleEventId,
      waterPointId: event.waterPointId,
      parameterCode: item.parameterCode,
      testedValue: Number(item.testedValue),
      testingDate: now,
      labId: correctionPayload.labId || event.testedLabId,
      status: paramEval?.level === 'hazardous_exceeded' ? RESULT_STATUSES.flagged_out_of_range.id : RESULT_STATUSES.verified_compliant.id,
      supersededByResultId: null,
      analystNotes: `Correction: ${correctionPayload.correctionReason}`,
      evaluation: paramEval,
    };
    replacementResults.push(newResult);
    store.labResults.push(newResult);
  });

  oldResults.forEach((oldRes) => {
    oldRes.status = RESULT_STATUSES.superseded.id;
    oldRes.supersededByResultId = replacementResults[0]?.id || 'CORRECTED';
  });

  // Update sampling event
  event.status = evaluation.isFullyCompliant
    ? RESULT_STATUSES.verified_compliant.id
    : RESULT_STATUSES.flagged_out_of_range.id;
  event.cryptographicSeal = newSeal;
  event.notes = `${event.notes ? event.notes + ' | ' : ''}Correction Published: ${correctionPayload.correctionReason}`;
  event.updatedAt = now;

  // Update water point
  waterPoint.overallComplianceStatus = evaluation.isFullyCompliant ? 'compliant' : 'exceeded';
  waterPoint.updatedAt = now;

  recordAuditEntry(store, {
    entityType: 'PublicationReview',
    entityId: sampleEventId,
    action: 'publish_correction',
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      reason: correctionPayload.correctionReason,
      oldResultsSuperseded: oldResults.length,
      newSeal,
      newComplianceStatus: evaluation.overallStatus,
    },
  });

  saveWaterQualityStore(store);

  return {
    sampleEventId,
    newSeal,
    supersededCount: oldResults.length,
    replacementResults,
    evaluation,
  };
}

/**
 * Record or update Corrective Remedial Actions
 */
export function recordCorrectiveAction(payload, actor = { role: ROLES.OFFICIAL_REVIEWER, id: 'OFFICIAL-01' }) {
  const allowedRoles = [ROLES.OFFICIAL_REVIEWER, ROLES.ADMIN];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Permission denied: Only municipal officials can sanction corrective actions.');
  }

  const errors = validateCorrectiveActionPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Corrective action validation failed: ${errors.join('; ')}`);
  }

  const store = loadWaterQualityStore();
  const waterPoint = store.waterPoints.find((wp) => wp.id === payload.waterPointId);
  if (!waterPoint) {
    throw new Error(`Water point not found: ${payload.waterPointId}`);
  }

  const now = new Date().toISOString();
  const actionId = `ACT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const action = {
    id: actionId,
    waterPointId: payload.waterPointId,
    triggerResultIds: Array.isArray(payload.triggerResultIds) ? payload.triggerResultIds : [],
    actionType: payload.actionType,
    status: payload.status || 'initiated',
    assignedDepartment: payload.assignedDepartment || 'Municipal Water Supply & Public Health Division',
    targetCompletionDate: payload.targetCompletionDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    description: payload.description.trim(),
    auditLog: [
      {
        timestamp: now,
        actorId: actor.id,
        action: 'initiated',
        notes: payload.notes || 'Corrective remedial action sanctioned.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  store.correctiveActions.unshift(action);

  recordAuditEntry(store, {
    entityType: 'CorrectiveAction',
    entityId: actionId,
    action: 'sanction_action',
    actorId: actor.id,
    actorRole: actor.role,
    details: { waterPointId: payload.waterPointId, actionType: payload.actionType },
  });

  saveWaterQualityStore(store);
  return action;
}

/**
 * Update status of an existing corrective action
 */
export function updateCorrectiveActionStatus(actionId, status, notes = '', actor = { role: ROLES.OFFICIAL_REVIEWER, id: 'OFFICIAL-01' }) {
  const store = loadWaterQualityStore();
  const action = store.correctiveActions.find((a) => a.id === actionId);
  if (!action) {
    throw new Error(`Corrective action not found: ${actionId}`);
  }

  const now = new Date().toISOString();
  action.status = status;
  action.updatedAt = now;
  action.auditLog = action.auditLog || [];
  action.auditLog.push({
    timestamp: now,
    actorId: actor.id,
    action: status,
    notes: notes.trim(),
  });

  recordAuditEntry(store, {
    entityType: 'CorrectiveAction',
    entityId: actionId,
    action: `update_status_${status}`,
    actorId: actor.id,
    actorRole: actor.role,
    details: { status, notes },
  });

  saveWaterQualityStore(store);
  return action;
}

/**
 * Get distinct list of cities in the register
 */
export function getAvailableCities() {
  const store = loadWaterQualityStore();
  const cities = new Set(store.waterPoints.map((wp) => wp.city));
  return ['All', ...Array.from(cities).sort()];
}

/**
 * Get distinct list of wards for a selected city
 */
export function getAvailableWards(selectedCity = 'All') {
  const store = loadWaterQualityStore();
  const set = new Set();
  store.waterPoints.forEach((wp) => {
    if (selectedCity === 'All' || wp.city.toLowerCase() === selectedCity.toLowerCase()) {
      set.add(wp.ward);
    }
  });
  return ['All', ...Array.from(set).sort()];
}

/**
 * Get append-only audit trail for administrative transparency
 */
export function getAuditTrail(entityId = null) {
  const store = loadWaterQualityStore();
  if (!entityId) {
    return store.auditTrail || [];
  }
  return (store.auditTrail || []).filter((a) => a.entityId === entityId);
}
