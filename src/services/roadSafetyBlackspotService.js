/**
 * Road-Safety Blackspot Detection, Risk Analysis, and Evidence Review Service
 * Follows MoRTH & IRC SP:88 Guidelines for Blackspot Identification and Human Oversight.
 */

import {
  ROAD_SAFETY_SCHEMA_VERSION,
  ROAD_SAFETY_STORAGE_KEYS,
  CASE_STATES,
  ALLOWED_STATE_TRANSITIONS,
  SEVERITY_WEIGHTS,
  DEFAULT_RISK_WEIGHTS,
  SEED_ROAD_SEGMENTS,
  SEED_CRASH_AGGREGATES,
  SEED_ROAD_FEATURES,
  SEED_HAZARD_REPORTS,
  ETHICAL_NON_FAULT_NOTICE,
} from '../data/roadSafetyContract';
import { requirePermission, actorLabel as getActorLabel, getCurrentActor } from './accessControl';
import { sanitizePlainText, safeHttpUrl } from '../utils/safeContent';
import { minimizeForExternal } from '../utils/dataMinimization';

export class RoadSafetyServiceError extends Error {
  constructor(message, code = 'RS_INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = 'RoadSafetyServiceError';
    this.code = code;
    this.details = details;
  }
}

export const RATE_LIMIT_MAX_SUBMISSIONS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readStorageJson = (key, fallback, storage) => {
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

const writeStorageJson = (key, data, storage) => {
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
 * Append-only audit logger for sensitive road-safety administrative actions.
 */
export const recordRoadSafetyAuditEvent = (action, details = {}, storage) => {
  const s = getStorage(storage);
  if (!s) return null;
  const auditKey = ROAD_SAFETY_STORAGE_KEYS.AUDIT_LOGS;
  const logs = readStorageJson(auditKey, [], s);
  const entry = {
    id: `rs-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    timestamp: new Date().toISOString(),
    actor: getActorLabel('Safety Officer'),
    details,
  };
  writeStorageJson(auditKey, [entry, ...logs].slice(0, 500), s);
  return entry;
};

export const getRoadSafetyAuditLogs = (storage) => {
  const s = getStorage(storage);
  return readStorageJson(ROAD_SAFETY_STORAGE_KEYS.AUDIT_LOGS, [], s);
};

/**
 * Initialize storage with verified seed data if not present.
 */
export const ensureRoadSafetySeedData = (storage) => {
  const s = getStorage(storage);
  if (!s) return false;

  const rawSegments = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, [], s);
  const rawCases = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, [], s);

  let modified = false;

  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, SEED_ROAD_SEGMENTS, s);
    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.CRASHES, SEED_CRASH_AGGREGATES, s);
    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.FEATURES, SEED_ROAD_FEATURES, s);
    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.HAZARDS, SEED_HAZARD_REPORTS, s);
    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.RUNS, [], s);
    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.INTERVENTIONS, [], s);
    modified = true;
  }

  if (!Array.isArray(rawCases) || rawCases.length === 0) {
    bootstrapInitialCases(s);
    modified = true;
  }

  return modified;
};

/**
 * Seed initial risk evaluation cases for pre-seeded corridors
 */
function bootstrapInitialCases(storage) {
  const segments = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, [], storage);
  const crashes = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CRASHES, [], storage);
  const features = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.FEATURES, [], storage);
  const hazards = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.HAZARDS, [], storage);

  const effectiveSegments = Array.isArray(segments) && segments.length > 0 ? segments : SEED_ROAD_SEGMENTS;
  const effectiveCrashes = Array.isArray(crashes) && crashes.length > 0 ? crashes : SEED_CRASH_AGGREGATES;
  const effectiveFeatures = Array.isArray(features) && features.length > 0 ? features : SEED_ROAD_FEATURES;
  const effectiveHazards = Array.isArray(hazards) && hazards.length > 0 ? hazards : SEED_HAZARD_REPORTS;

  const initialCases = effectiveSegments.map((segment) => {
    const segmentCrashes = effectiveCrashes.filter((c) => c.segmentId === segment.id);
    const feature = effectiveFeatures.find((f) => f.segmentId === segment.id);
    const segmentHazards = effectiveHazards.filter((h) => h.segmentId === segment.id);

    const evaluation = evaluateSegmentRisk(segment, segmentCrashes, feature, segmentHazards);

    return {
      id: `case-${segment.id}`,
      segmentId: segment.id,
      riskRunId: 'bootstrap-initial-run',
      compositeRiskScore: evaluation.compositeRiskScore,
      severityWeightedFrequency: evaluation.severityWeightedFrequency,
      exposureRatePerMillionVkm: evaluation.exposureRatePerMillionVkm,
      confidenceLevel: evaluation.confidenceLevel,
      exposureUncertainty: evaluation.exposureUncertainty,
      primaryRiskFactors: evaluation.explainabilityFactors,
      status: CASE_STATES.CANDIDATE,
      assignedOfficer: null,
      reviewNotes: [],
      inspectionRecords: [],
      interventionRecords: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
    };
  });

  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, initialCases, storage);
  return initialCases;
}

/**
 * Frequency calculation with weighted severity according to MoRTH criteria.
 * Crash Frequency = 5.0 * Fatal + 3.0 * Severe + 1.0 * Minor + 0.2 * PropertyDamage
 */
export const calculateWeightedCrashScore = (crashes = []) => {
  if (!Array.isArray(crashes) || crashes.length === 0) return 0;
  return crashes.reduce((acc, c) => {
    const fatal = Number(c.fatalCount) || 0;
    const severe = Number(c.severeInjuryCount) || 0;
    const minor = Number(c.minorInjuryCount) || 0;
    const prop = Number(c.propertyDamageCount) || 0;
    return (
      acc +
      fatal * SEVERITY_WEIGHTS.FATAL +
      severe * SEVERITY_WEIGHTS.SEVERE_INJURY +
      minor * SEVERITY_WEIGHTS.MINOR_INJURY +
      prop * SEVERITY_WEIGHTS.PROPERTY_DAMAGE
    );
  }, 0);
};

/**
 * Exposure-adjusted crash risk rate.
 * Rate = (Weighted Crashes / Exposure Denominator)
 * Where Denominator is in Million Vehicle-Kilometers (MVKM).
 */
export const calculateExposureRiskRate = (weightedScore, exposureDenominator) => {
  const denom = Number(exposureDenominator);
  if (!denom || denom <= 0 || isNaN(denom)) {
    return {
      rate: null,
      uncertainty: 'high',
      reason: 'Traffic volume (ADT) or exposure denominator census unavailable',
    };
  }
  const rate = Number((weightedScore / denom).toFixed(3));
  return {
    rate,
    uncertainty: 'low',
    reason: 'Calculated per million vehicle-kilometers',
  };
};

/**
 * Evaluates infrastructure hazard penalty score (0 to 30) based on physical attributes.
 */
export const calculateInfrastructureHazardScore = (feature, speedLimitKmph = 50, hazards = []) => {
  let score = 0;
  const factors = [];

  if (feature) {
    if (feature.lightingQuality === 'unlit') {
      score += 8;
      factors.push('Unlit night corridor (+8 infrastructure risk)');
    } else if (feature.lightingQuality === 'poor') {
      score += 5;
      factors.push('Substandard illumination (+5 infrastructure risk)');
    }

    if (feature.crossingType === 'none' && speedLimitKmph >= 60) {
      score += 8;
      factors.push(`No pedestrian crossing facilities on high-speed ${speedLimitKmph} km/h corridor (+8 infrastructure risk)`);
    } else if (feature.crossingType === 'zebra_unsignalized' && speedLimitKmph >= 70) {
      score += 6;
      factors.push('Uncontrolled zebra crossing on high-speed multi-lane roadway (+6 infrastructure risk)');
    }

    if (feature.blindCurve) {
      score += 5;
      factors.push('Sightline obstruction or acute blind curve (+5 infrastructure risk)');
    }

    if (feature.surfaceCondition === 'deteriorated' || feature.surfaceCondition === 'hazardous') {
      score += 5;
      factors.push('Potholes and deteriorated pavement surface (+5 infrastructure risk)');
    }

    if (feature.speedCalming === 'none' && speedLimitKmph >= 65) {
      score += 4;
      factors.push('Absence of speed-management or traffic-calming devices (+4 infrastructure risk)');
    }
  }

  // Factor in verified citizen hazard reports
  const activeHazards = (hazards || []).filter((h) => h.status !== 'resolved' && h.status !== 'dismissed');
  if (activeHazards.length > 0) {
    const hazardBonus = Math.min(activeHazards.length * 2, 6);
    score += hazardBonus;
    factors.push(`${activeHazards.length} recurring citizen hazard reports logged (+${hazardBonus} infrastructure risk)`);
  }

  return {
    hazardScore: Math.min(score, 30),
    factors,
  };
};

/**
 * Composite risk evaluation for a single road corridor.
 * Bounded between 0 and 100.
 */
export const evaluateSegmentRisk = (
  segment,
  crashes = [],
  feature = null,
  hazards = [],
  weights = DEFAULT_RISK_WEIGHTS
) => {
  const wFreq = weights.crashFrequencyWeight ?? 0.35;
  const wSev = weights.crashSeverityWeight ?? 0.35;
  const wInfra = weights.infrastructureHazardWeight ?? 0.20;
  const wExpo = weights.exposureDenominatorWeight ?? 0.10;

  const totalCrashes = crashes.reduce((acc, c) => acc + (Number(c.totalCrashes) || 0), 0);
  const totalFatal = crashes.reduce((acc, c) => acc + (Number(c.fatalCount) || 0), 0);
  const totalSevere = crashes.reduce((acc, c) => acc + (Number(c.severeInjuryCount) || 0), 0);
  const weightedCrashScore = calculateWeightedCrashScore(crashes);

  // Exposure calculation
  const latestCrash = crashes[crashes.length - 1];
  const exposureResult = calculateExposureRiskRate(weightedCrashScore, latestCrash?.exposureDenominator);

  // Infrastructure penalty
  const infraResult = calculateInfrastructureHazardScore(feature, segment.speedLimitKmph, hazards);

  // Normalized component scores (0 - 100)
  const normFrequency = Math.min((totalCrashes / 30) * 100, 100);
  const normSeverity = Math.min(((totalFatal * 5 + totalSevere * 3) / 25) * 100, 100);
  const normInfra = (infraResult.hazardScore / 30) * 100;
  const normExposure = exposureResult.rate !== null ? Math.min((exposureResult.rate / 2.0) * 100, 100) : 50;

  const rawScore =
    normFrequency * wFreq +
    normSeverity * wSev +
    normInfra * wInfra +
    normExposure * wExpo;

  const compositeRiskScore = Math.min(Math.max(Math.round(rawScore), 5), 98);

  const explainabilityFactors = [];
  if (totalFatal > 0) {
    explainabilityFactors.push(`${totalFatal} fatal crashes recorded in assessment window.`);
  }
  if (totalSevere > 0) {
    explainabilityFactors.push(`${totalSevere} severe-injury crashes logged.`);
  }
  explainabilityFactors.push(...infraResult.factors);
  if (exposureResult.uncertainty === 'high') {
    explainabilityFactors.push('Notice: Exposure rate calculated with estimated traffic volume baseline due to missing ADT census.');
  }

  return {
    compositeRiskScore,
    severityWeightedFrequency: Number(weightedCrashScore.toFixed(2)),
    exposureRatePerMillionVkm: exposureResult.rate,
    confidenceLevel: exposureResult.uncertainty === 'high' ? 'medium' : 'high',
    exposureUncertainty: exposureResult.uncertainty === 'high',
    explainabilityFactors,
  };
};

/**
 * Execute an automated risk run across all known segments.
 * Protected by 'roadSafety.admin'.
 */
export const executeRiskRun = (parameters = {}, storage) => {
  requirePermission('roadSafety.admin');
  const s = getStorage(storage);
  ensureRoadSafetySeedData(s);

  const segments = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, [], s);
  const crashes = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CRASHES, [], s);
  const features = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.FEATURES, [], s);
  const hazards = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.HAZARDS, [], s);
  const existingCases = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, [], s);

  const runId = `run-${Date.now()}`;
  const weights = {
    ...DEFAULT_RISK_WEIGHTS,
    ...(parameters.weights || {}),
  };

  const runRecord = {
    id: runId,
    runTimestamp: new Date().toISOString(),
    rulesetVersion: 'MoRTH-IRC-SP88-v1.2',
    featureWindowStart: parameters.startDate || '2025-01-01',
    featureWindowEnd: parameters.endDate || '2025-12-31',
    totalSegmentsEvaluated: segments.length,
    algorithmWeights: weights,
    executedBy: getActorLabel('Safety Analytics Engine'),
    disclaimer: ETHICAL_NON_FAULT_NOTICE,
  };

  const updatedCases = segments.map((segment) => {
    const segmentCrashes = crashes.filter((c) => c.segmentId === segment.id);
    const feature = features.find((f) => f.segmentId === segment.id);
    const segmentHazards = hazards.filter((h) => h.segmentId === segment.id);

    const evalResult = evaluateSegmentRisk(segment, segmentCrashes, feature, segmentHazards, weights);

    const existingCase = existingCases.find((c) => c.segmentId === segment.id);

    return {
      id: existingCase?.id || `case-${segment.id}`,
      segmentId: segment.id,
      riskRunId: runId,
      compositeRiskScore: evalResult.compositeRiskScore,
      severityWeightedFrequency: evalResult.severityWeightedFrequency,
      exposureRatePerMillionVkm: evalResult.exposureRatePerMillionVkm,
      confidenceLevel: evalResult.confidenceLevel,
      exposureUncertainty: evalResult.exposureUncertainty,
      primaryRiskFactors: evalResult.explainabilityFactors,
      status: existingCase?.status || CASE_STATES.CANDIDATE,
      assignedOfficer: existingCase?.assignedOfficer || null,
      reviewNotes: existingCase?.reviewNotes || [],
      inspectionRecords: existingCase?.inspectionRecords || [],
      interventionRecords: existingCase?.interventionRecords || [],
      createdAt: existingCase?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
    };
  });

  const runs = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.RUNS, [], s);
  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.RUNS, [runRecord, ...runs], s);
  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, updatedCases, s);

  recordRoadSafetyAuditEvent('RISK_RUN_EXECUTED', {
    runId,
    totalSegments: segments.length,
    featureWindowStart: runRecord.featureWindowStart,
    featureWindowEnd: runRecord.featureWindowEnd,
  }, s);

  return {
    runRecord,
    cases: updatedCases,
  };
};

/**
 * List review cases with search, jurisdiction filters, and pagination.
 */
export const listReviewCases = (filters = {}, storage) => {
  const s = getStorage(storage);
  ensureRoadSafetySeedData(s);

  let cases = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, [], s);
  let segments = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, [], s);

  if (!Array.isArray(cases) || cases.length === 0) {
    cases = bootstrapInitialCases(s);
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    segments = SEED_ROAD_SEGMENTS;
    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, SEED_ROAD_SEGMENTS, s);
  }

  let result = cases.map((c) => {
    const seg = segments.find((sItem) => sItem.id === c.segmentId);
    return {
      ...c,
      segment: seg || null,
    };
  });

  if (filters.state && filters.state !== 'all') {
    result = result.filter((c) => c.segment?.jurisdiction?.state === filters.state);
  }
  if (filters.status && filters.status !== 'all') {
    result = result.filter((c) => c.status === filters.status);
  }
  if (filters.minScore) {
    const min = Number(filters.minScore);
    if (!isNaN(min)) result = result.filter((c) => c.compositeRiskScore >= min);
  }
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase().trim();
    result = result.filter(
      (c) =>
        c.segment?.name?.toLowerCase().includes(query) ||
        c.segment?.code?.toLowerCase().includes(query) ||
        c.segment?.jurisdiction?.district?.toLowerCase().includes(query)
    );
  }

  // Sort by highest risk score descending
  result.sort((a, b) => b.compositeRiskScore - a.compositeRiskScore);

  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.max(Number(filters.limit) || 20, 1);
  const totalItems = result.length;
  const paginated = result.slice((page - 1) * limit, page * limit);

  return {
    cases: paginated,
    totalItems,
    page,
    totalPages: Math.ceil(totalItems / limit),
  };
};

/**
 * Retrieve single review case with full corridor and historical relations.
 */
export const getReviewCaseDetail = (caseId, storage) => {
  const s = getStorage(storage);
  ensureRoadSafetySeedData(s);

  let cases = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, [], s);
  if (!Array.isArray(cases) || cases.length === 0) {
    cases = bootstrapInitialCases(s);
  }
  const targetCase = cases.find((c) => c.id === caseId || c.segmentId === caseId);
  if (!targetCase) return null;

  let segments = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, [], s);
  if (!Array.isArray(segments) || segments.length === 0) segments = SEED_ROAD_SEGMENTS;

  let crashes = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CRASHES, [], s);
  if (!Array.isArray(crashes) || crashes.length === 0) crashes = SEED_CRASH_AGGREGATES;

  let features = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.FEATURES, [], s);
  if (!Array.isArray(features) || features.length === 0) features = SEED_ROAD_FEATURES;

  let hazards = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.HAZARDS, [], s);
  if (!Array.isArray(hazards) || hazards.length === 0) hazards = SEED_HAZARD_REPORTS;

  const segment = segments.find((seg) => seg.id === targetCase.segmentId) || SEED_ROAD_SEGMENTS.find((seg) => seg.id === targetCase.segmentId);
  const segmentCrashes = crashes.filter((cr) => cr.segmentId === targetCase.segmentId);
  const feature = features.find((ft) => ft.segmentId === targetCase.segmentId);
  const segmentHazards = hazards.filter((hz) => hz.segmentId === targetCase.segmentId);

  return {
    ...targetCase,
    segment: segment || null,
    crashes: segmentCrashes,
    feature: feature || null,
    hazards: segmentHazards,
  };
};

/**
 * Finite State Machine Transition for ReviewCase.
 * Protected by 'roadSafety.review'.
 */
export const transitionReviewCaseState = (caseId, targetState, transitionData = {}, storage) => {
  requirePermission('roadSafety.review');
  const s = getStorage(storage);
  ensureRoadSafetySeedData(s);

  const cases = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, [], s);
  const caseIndex = cases.findIndex((c) => c.id === caseId);
  if (caseIndex === -1) {
    throw new RoadSafetyServiceError(`Review case with ID ${caseId} not found.`, 'RS_NOT_FOUND');
  }

  const currentCase = cases[caseIndex];
  const currentState = currentCase.status;

  // Scope access by authenticated actor's jurisdiction when specified
  const actor = getCurrentActor();
  const segments = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, [], s);
  const segment = segments.find((seg) => seg.id === currentCase.segmentId);
  if (actor?.jurisdiction?.state && segment?.jurisdiction?.state && actor.jurisdiction.state !== segment.jurisdiction.state) {
    throw new RoadSafetyServiceError(
      `Access Denied: You are authorized for jurisdiction '${actor.jurisdiction.state}', cannot modify '${segment.jurisdiction.state}'.`,
      'RS_FORBIDDEN_JURISDICTION'
    );
  }

  const allowedNext = ALLOWED_STATE_TRANSITIONS[currentState] || [];
  if (!allowedNext.includes(targetState)) {
    throw new RoadSafetyServiceError(
      `Invalid state transition: Cannot transition from '${currentState}' to '${targetState}'. Allowed transitions are: [${allowedNext.join(', ')}]`,
      'RS_INVALID_STATE_TRANSITION',
      { currentState, targetState, allowedTransitions: allowedNext }
    );
  }

  // Sanitize transition note
  const justification = sanitizePlainText(transitionData.reason || transitionData.notes || '', { max: 1000 });
  if (!justification && (targetState === CASE_STATES.DISMISSED_FALSE_POSITIVE || targetState === CASE_STATES.DEFERRED)) {
    throw new RoadSafetyServiceError(
      'A documented justification reason is required when dismissing or deferring a detected blackspot.',
      'RS_JUSTIFICATION_REQUIRED'
    );
  }

  const updatedCase = {
    ...currentCase,
    status: targetState,
    updatedAt: new Date().toISOString(),
    reviewNotes: [
      {
        fromState: currentState,
        toState: targetState,
        note: justification,
        officer: getActorLabel('Safety Officer'),
        timestamp: new Date().toISOString(),
      },
      ...currentCase.reviewNotes,
    ],
  };

  cases[caseIndex] = updatedCase;
  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, cases, s);

  recordRoadSafetyAuditEvent('CASE_STATE_TRANSITION', {
    caseId,
    fromState: currentState,
    toState: targetState,
    justification,
    segmentId: currentCase.segmentId,
  }, s);

  return updatedCase;
};

/**
 * Record a physical site inspection for a review case.
 * Protected by 'roadSafety.review'.
 */
export const recordSiteInspection = (caseId, inspectionData = {}, storage) => {
  requirePermission('roadSafety.review');
  const s = getStorage(storage);
  ensureRoadSafetySeedData(s);

  const cases = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, [], s);
  const caseIndex = cases.findIndex((c) => c.id === caseId);
  if (caseIndex === -1) {
    throw new RoadSafetyServiceError(`Review case ${caseId} not found.`, 'RS_NOT_FOUND');
  }

  const currentCase = cases[caseIndex];

  // Scope access by authenticated actor's jurisdiction when specified
  const actor = getCurrentActor();
  const segments = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.SEGMENTS, [], s);
  const segment = segments.find((seg) => seg.id === currentCase.segmentId);
  if (actor?.jurisdiction?.state && segment?.jurisdiction?.state && actor.jurisdiction.state !== segment.jurisdiction.state) {
    throw new RoadSafetyServiceError(
      `Access Denied: You are authorized for jurisdiction '${actor.jurisdiction.state}', cannot inspect '${segment.jurisdiction.state}'.`,
      'RS_FORBIDDEN_JURISDICTION'
    );
  }

  const inspectionDate = inspectionData.inspectionDate || new Date().toISOString().split('T')[0];
  const findings = sanitizePlainText(inspectionData.findings || '', { max: 2000 });
  const crossingObservations = sanitizePlainText(inspectionData.crossingObservations || '', { max: 1000 });
  const lightingCondition = inspectionData.lightingCondition || 'as_recorded';
  const speedSurveyObservedKmph = Number(inspectionData.speedSurveyObservedKmph) || null;

  if (!findings || findings.length < 10) {
    throw new RoadSafetyServiceError('Detailed site inspection findings (minimum 10 characters) are required.', 'RS_VALIDATION_ERROR');
  }

  const newInspectionRecord = {
    id: `insp-${Date.now()}`,
    inspectionDate,
    inspectedBy: getActorLabel('Certified Road Safety Auditor'),
    findings,
    crossingObservations,
    lightingCondition,
    speedSurveyObservedKmph,
    evidencePhotos: (inspectionData.evidencePhotos || []).slice(0, 4).map((p) => ({
      name: sanitizePlainText(p.name || 'Site Photo', { max: 100 }),
      url: safeHttpUrl(p.url || ''),
      caption: sanitizePlainText(p.caption || '', { max: 200 }),
    })),
    createdAt: new Date().toISOString(),
  };

  const updatedCase = {
    ...currentCase,
    status: CASE_STATES.INSPECTED,
    updatedAt: new Date().toISOString(),
    inspectionRecords: [newInspectionRecord, ...(currentCase.inspectionRecords || [])],
  };

  cases[caseIndex] = updatedCase;
  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, cases, s);

  recordRoadSafetyAuditEvent('SITE_INSPECTION_RECORDED', {
    caseId,
    inspectionId: newInspectionRecord.id,
    segmentId: currentCase.segmentId,
  }, s);

  return {
    inspection: newInspectionRecord,
    reviewCase: updatedCase,
  };
};

/**
 * Record an engineering intervention for a review case.
 * Protected by 'roadSafety.review'.
 */
export const recordIntervention = (caseId, interventionData = {}, storage) => {
  requirePermission('roadSafety.review');
  const s = getStorage(storage);
  ensureRoadSafetySeedData(s);

  const cases = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, [], s);
  const caseIndex = cases.findIndex((c) => c.id === caseId);
  if (caseIndex === -1) {
    throw new RoadSafetyServiceError(`Review case ${caseId} not found.`, 'RS_NOT_FOUND');
  }

  const currentCase = cases[caseIndex];

  const interventionType = interventionData.interventionType;
  if (!interventionType) {
    throw new RoadSafetyServiceError('An intervention type (e.g. rumble_strips, speed_table_pedestrian) is required.', 'RS_VALIDATION_ERROR');
  }

  const description = sanitizePlainText(interventionData.description || '', { max: 1500 });
  const targetDate = interventionData.targetCompletionDate || '';
  const costEstimateInr = Number(interventionData.costEstimateInr) || 0;
  const contractor = sanitizePlainText(interventionData.contractor || '', { max: 150 });

  const newIntervention = {
    id: `int-${Date.now()}`,
    reviewCaseId: caseId,
    segmentId: currentCase.segmentId,
    interventionType,
    description,
    targetCompletionDate: targetDate,
    completedDate: interventionData.completedDate || null,
    costEstimateInr,
    contractor,
    status: interventionData.completedDate ? 'completed' : 'planned',
    outcomeEvaluation: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const allInterventions = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.INTERVENTIONS, [], s);
  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.INTERVENTIONS, [newIntervention, ...allInterventions], s);

  const updatedCase = {
    ...currentCase,
    status: newIntervention.completedDate ? CASE_STATES.MONITORING : CASE_STATES.INTERVENTION_PLANNED,
    updatedAt: new Date().toISOString(),
    interventionRecords: [newIntervention, ...(currentCase.interventionRecords || [])],
  };

  cases[caseIndex] = updatedCase;
  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, cases, s);

  recordRoadSafetyAuditEvent('INTERVENTION_RECORDED', {
    caseId,
    interventionId: newIntervention.id,
    interventionType,
    costEstimateInr,
  }, s);

  return {
    intervention: newIntervention,
    reviewCase: updatedCase,
  };
};

/**
 * Evaluate before-and-after outcome for a completed intervention.
 */
export const evaluateInterventionOutcome = (interventionId, outcomeData = {}, storage) => {
  requirePermission('roadSafety.review');
  const s = getStorage(storage);

  const interventions = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.INTERVENTIONS, [], s);
  const intIndex = interventions.findIndex((i) => i.id === interventionId);
  if (intIndex === -1) {
    throw new RoadSafetyServiceError(`Intervention record ${interventionId} not found.`, 'RS_NOT_FOUND');
  }

  const preCrashes = Number(outcomeData.preInterventionCrashes) || 0;
  const postCrashes = Number(outcomeData.postInterventionCrashes) || 0;
  const reductionPercentage = preCrashes > 0 ? Number((((preCrashes - postCrashes) / preCrashes) * 100).toFixed(1)) : 0;

  const outcome = {
    monitoringMonths: Number(outcomeData.monitoringMonths) || 6,
    preInterventionCrashes: preCrashes,
    postInterventionCrashes: postCrashes,
    reductionPercentage,
    notes: sanitizePlainText(outcomeData.notes || '', { max: 1000 }),
    evaluatedAt: new Date().toISOString(),
    evaluator: getActorLabel('Safety Auditor'),
  };

  interventions[intIndex].outcomeEvaluation = outcome;
  interventions[intIndex].status = 'evaluated';
  interventions[intIndex].updatedAt = new Date().toISOString();

  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.INTERVENTIONS, interventions, s);

  recordRoadSafetyAuditEvent('INTERVENTION_OUTCOME_EVALUATED', {
    interventionId,
    preCrashes,
    postCrashes,
    reductionPercentage,
  }, s);

  return interventions[intIndex];
};

/**
 * Citizen Road Hazard Submission with Rate-Limiting & Anti-Abuse Guard.
 * Public endpoint (no privileged role required, but strictly rate-limited).
 */
export const submitCitizenHazardReport = (reportData = {}, storage, clientId = 'anon-client') => {
  const s = getStorage(storage);
  ensureRoadSafetySeedData(s);

  // Idempotency guard: If an idempotencyKey is supplied and already stored, return existing report safely
  const idempotencyKey = reportData.idempotencyKey;
  const hazards = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.HAZARDS, [], s);
  if (idempotencyKey) {
    const existing = hazards.find((h) => h.idempotencyKey === idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  // Rate Limiting Enforcement
  const rateKey = ROAD_SAFETY_STORAGE_KEYS.RATE_LIMIT;
  const rateRecords = readStorageJson(rateKey, {}, s);
  const now = Date.now();
  const clientHistory = (rateRecords[clientId] || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (clientHistory.length >= RATE_LIMIT_MAX_SUBMISSIONS) {
    throw new RoadSafetyServiceError(
      `Rate limit exceeded: You have submitted ${RATE_LIMIT_MAX_SUBMISSIONS} hazard reports in the last 15 minutes. Please wait before reporting again.`,
      'RS_RATE_LIMITED'
    );
  }

  // Text Sanitization & PII Minimization
  const segmentId = reportData.segmentId;
  const hazardType = reportData.hazardType;
  if (!hazardType) {
    throw new RoadSafetyServiceError('Please select a valid hazard type.', 'RS_VALIDATION_ERROR');
  }

  const rawDescription = String(reportData.description || '');
  if (rawDescription.trim().length < 10) {
    throw new RoadSafetyServiceError('Please provide at least 10 characters describing the hazard.', 'RS_VALIDATION_ERROR');
  }

  const description = minimizeForExternal(sanitizePlainText(rawDescription, { max: 1000 }));
  const locationHint = minimizeForExternal(sanitizePlainText(reportData.locationHint || '', { max: 200 }));

  const newReport = {
    id: `haz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    idempotencyKey: idempotencyKey || null,
    segmentId: segmentId || 'unassigned-corridor',
    hazardType,
    severity: reportData.severity || 'medium',
    description,
    locationHint,
    reporterRole: 'citizen',
    reportedAt: new Date().toISOString(),
    status: 'submitted',
  };

  writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.HAZARDS, [newReport, ...hazards], s);

  // Update client rate-limit tracking
  rateRecords[clientId] = [...clientHistory, now];
  writeStorageJson(rateKey, rateRecords, s);

  return newReport;
};

/**
 * Compare two time periods for a given road corridor.
 */
export const compareTimePeriods = (segmentId, periodA, periodB, storage) => {
  const s = getStorage(storage);
  ensureRoadSafetySeedData(s);

  const crashes = readStorageJson(ROAD_SAFETY_STORAGE_KEYS.CRASHES, [], s);
  const segmentCrashes = crashes.filter((c) => c.segmentId === segmentId);

  const aggregatePeriod = (period) => {
    const matches = segmentCrashes.filter(
      (c) => c.periodStart >= period.start && c.periodEnd <= period.end
    );
    const fatal = matches.reduce((acc, m) => acc + (Number(m.fatalCount) || 0), 0);
    const severe = matches.reduce((acc, m) => acc + (Number(m.severeInjuryCount) || 0), 0);
    const total = matches.reduce((acc, m) => acc + (Number(m.totalCrashes) || 0), 0);
    return {
      fatal,
      severe,
      total,
      weightedScore: calculateWeightedCrashScore(matches),
    };
  };

  const statsA = aggregatePeriod(periodA);
  const statsB = aggregatePeriod(periodB);

  const deltaTotal = statsB.total - statsA.total;
  const deltaWeighted = statsB.weightedScore - statsA.weightedScore;
  const percentChange = statsA.total > 0 ? Number(((deltaTotal / statsA.total) * 100).toFixed(1)) : 0;

  return {
    segmentId,
    periodA: { ...periodA, stats: statsA },
    periodB: { ...periodB, stats: statsB },
    deltaTotal,
    deltaWeighted: Number(deltaWeighted.toFixed(2)),
    percentChange,
    improvementDemonstrated: deltaWeighted < 0,
  };
};

/**
 * Migration helper to ensure schema version integrity.
 */
export const migrateRoadSafetyStorage = (storage) => {
  const s = getStorage(storage);
  if (!s) return { success: false, reason: 'No storage available' };

  const rawCases = s.getItem(ROAD_SAFETY_STORAGE_KEYS.CASES);
  if (!rawCases) {
    ensureRoadSafetySeedData(s);
    return { success: true, migratedCount: 0, version: ROAD_SAFETY_SCHEMA_VERSION };
  }

  try {
    // Preserve rollback snapshot prior to applying version mutation
    s.setItem(`${ROAD_SAFETY_STORAGE_KEYS.CASES}_backup_v${ROAD_SAFETY_SCHEMA_VERSION}`, rawCases);

    const cases = JSON.parse(rawCases);
    let migratedCount = 0;
    const migrated = cases.map((c) => {
      if (!c.schemaVersion || c.schemaVersion < ROAD_SAFETY_SCHEMA_VERSION) {
        migratedCount++;
        return {
          ...c,
          schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });

    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, migrated, s);
    recordRoadSafetyAuditEvent('STORAGE_MIGRATION_EXECUTED', { version: ROAD_SAFETY_SCHEMA_VERSION, migratedCount }, s);
    return { success: true, migratedCount, version: ROAD_SAFETY_SCHEMA_VERSION };
  } catch (err) {
    return { success: false, reason: err.message };
  }
};

/**
 * Rollback strategy: restores schema snapshot from previous version backup.
 */
export const rollbackRoadSafetyStorage = (targetVersion = 1, storage) => {
  const s = getStorage(storage);
  if (!s) return { success: false, reason: 'No storage available' };
  const backupKey = `${ROAD_SAFETY_STORAGE_KEYS.CASES}_backup_v${targetVersion}`;
  const backupRaw = s.getItem(backupKey);
  if (!backupRaw) {
    return { success: false, reason: `No backup snapshot found for version ${targetVersion}` };
  }
  try {
    const cases = JSON.parse(backupRaw);
    writeStorageJson(ROAD_SAFETY_STORAGE_KEYS.CASES, cases, s);
    recordRoadSafetyAuditEvent('STORAGE_ROLLBACK_EXECUTED', { targetVersion, count: cases.length }, s);
    return { success: true, restoredVersion: targetVersion, count: cases.length };
  } catch (err) {
    return { success: false, reason: err.message };
  }
};

/**
 * Spatial join: associates a point coordinate { lat, lng } with the nearest or enclosing road segment.
 * Uses Euclidean approximation suitable for short corridor lengths (< 5km).
 * @param {{ lat: number, lng: number }} coords
 * @param {Array<Object>} segments
 * @param {number} maxDistanceKm - maximum buffer distance (default 0.5 km)
 * @returns {Object|null} matched segment with calculated offsetDistanceKm
 */
export const spatialJoinCrashToSegment = (coords, segments = [], maxDistanceKm = 0.5) => {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || !Array.isArray(segments) || segments.length === 0) {
    return null;
  }
  let closest = null;
  let minDistance = Infinity;

  for (const seg of segments) {
    if (!seg.startCoords || !seg.endCoords) continue;
    // Midpoint of corridor
    const midLat = (seg.startCoords.lat + seg.endCoords.lat) / 2;
    const midLng = (seg.startCoords.lng + seg.endCoords.lng) / 2;
    // Approximate distance in km using equirectangular projection
    const dLat = (coords.lat - midLat) * 111.0;
    const dLng = (coords.lng - midLng) * 111.0 * Math.cos((midLat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    if (dist <= maxDistanceKm && dist < minDistance) {
      minDistance = dist;
      closest = {
        segmentId: seg.id,
        segmentName: seg.name,
        offsetDistanceKm: Number(dist.toFixed(3)),
      };
    }
  }
  return closest;
};

/**
 * Boundary change handler: recalculates vehicle-km exposure denominator when a road segment's
 * physical boundaries (length in meters) or geometry are altered.
 * Denominator (Million Vkm/year) = (365 * AADT * lengthKm) / 1,000,000.
 * @param {Object} segment - road segment entity
 * @param {number} newLengthMeters - revised length
 * @param {number} [aadt] - Annual Average Daily Traffic (defaults to estimated volume if omitted)
 * @returns {{ newLengthMeters: number, exposureDenominator: number, deltaRatio: number }}
 */
export const rescaleSegmentExposureForBoundaryChange = (segment, newLengthMeters, aadt = 30000) => {
  if (!segment || !newLengthMeters || newLengthMeters <= 0) {
    throw new RoadSafetyServiceError(
      'Valid road segment and positive new length in meters are required for boundary rescaling.',
      'RS_VALIDATION_ERROR'
    );
  }
  const oldLengthKm = (segment.lengthMeters || 1000) / 1000;
  const newLengthKm = newLengthMeters / 1000;
  const oldExposure = (365 * aadt * oldLengthKm) / 1000000;
  const newExposure = (365 * aadt * newLengthKm) / 1000000;
  const deltaRatio = Number((newExposure / (oldExposure || 1)).toFixed(3));

  return {
    segmentId: segment.id,
    previousLengthMeters: segment.lengthMeters,
    newLengthMeters,
    previousExposureDenominator: Number(oldExposure.toFixed(3)),
    newExposureDenominator: Number(newExposure.toFixed(3)),
    deltaRatio,
  };
};

/**
 * Detects temporal and seasonal bias across crash records (e.g. night glare skew, monsoon season spike).
 * Useful to distinguish true infrastructure hazards from transient seasonal exposure peaks.
 * @param {Array<Object>} crashRecords
 * @returns {{ hasTemporalBias: boolean, dominantWindow: string, nocturnalRatio: number, seasonalRatio: number, flags: string[] }}
 */
export const detectTemporalBiasInCrashHistory = (crashRecords = []) => {
  if (!Array.isArray(crashRecords) || crashRecords.length === 0) {
    return { hasTemporalBias: false, dominantWindow: 'insufficient_data', nocturnalRatio: 0, seasonalRatio: 0, flags: [] };
  }
  let nocturnal = 0;
  let diurnal = 0;
  let monsoon = 0; // June - September
  const flags = [];

  for (const c of crashRecords) {
    if (c.lightingCondition === 'night' || c.timeOfDay === 'night' || c.isNight) {
      nocturnal += (c.totalCrashes || 1);
    } else {
      diurnal += (c.totalCrashes || 1);
    }

    if (c.periodStart) {
      const month = new Date(c.periodStart).getMonth() + 1; // 1-12
      if (month >= 6 && month <= 9) {
        monsoon += (c.totalCrashes || 1);
      }
    }
  }

  const total = nocturnal + diurnal;
  const nocturnalRatio = total > 0 ? Number((nocturnal / total).toFixed(2)) : 0;
  const seasonalRatio = total > 0 ? Number((monsoon / total).toFixed(2)) : 0;

  if (nocturnalRatio >= 0.65) {
    flags.push(`Nocturnal clustering bias: ${Math.round(nocturnalRatio * 100)}% of crashes occur during dark hours (lighting deficiency indicated).`);
  }
  if (seasonalRatio >= 0.50) {
    flags.push(`Monsoon seasonal skew: ${Math.round(seasonalRatio * 100)}% of crashes clustered between June and September (hydroplaning / drainage indicated).`);
  }

  return {
    hasTemporalBias: flags.length > 0,
    dominantWindow: nocturnalRatio >= 0.65 ? 'night_skew' : seasonalRatio >= 0.50 ? 'monsoon_skew' : 'uniform',
    nocturnalRatio,
    seasonalRatio,
    flags,
  };
};

/**
 * Public Data Minimization Serializer:
 * Ensures public views and exports contain only aggregated metrics,
 * stripping internal reviewer notes, inspector names, and officer IDs.
 */
export const serializePublicBlackspotSummary = (caseItem) => {
  if (!caseItem) return null;
  return {
    code: caseItem.segment?.code || '',
    name: caseItem.segment?.name || '',
    jurisdiction: {
      state: caseItem.segment?.jurisdiction?.state || '',
      district: caseItem.segment?.jurisdiction?.district || '',
      zone: caseItem.segment?.jurisdiction?.zone || '',
    },
    roadType: caseItem.segment?.roadType || '',
    speedLimitKmph: caseItem.segment?.speedLimitKmph || 0,
    compositeRiskScore: caseItem.compositeRiskScore || 0,
    status: caseItem.status || '',
    confidenceLevel: caseItem.confidenceLevel || 'medium',
    primaryRiskFactors: caseItem.primaryRiskFactors || [],
    publishedAt: caseItem.updatedAt || caseItem.createdAt,
  };
};

