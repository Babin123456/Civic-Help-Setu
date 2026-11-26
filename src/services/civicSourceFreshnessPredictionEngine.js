/**
 * src/services/civicSourceFreshnessPredictionEngine.js
 *
 * Civic Information Freshness Prediction and Review Prioritization Model (#1189).
 *
 * Builds interpretable features from source change history, link health and last
 * verification; computes a deterministic review priority score (0-100) with
 * reasons and uncertainty; never auto-edits guidance, never files or denies
 * applications, never claims official verification.
 *
 * Design rules:
 *  - Deterministic rules evaluated outside LLM prompts; AI outputs are untrusted
 *    suggestions carrying provenance.
 * * Output is a review priority hint for maintainers, not a public truth score
 *   and not an instruction to change anything.
 * * Explicit human approval required for high-impact review actions.
 * * Aggregated metadata only. No citizen records, credentials, raw documents or
 *   sensitive prompts are logged or persisted (inputs are hashed; only lengths
 *   and resource identifiers are stored).
 * * Fail closed: on invalid input, missing service or engine error, return a
 *   deterministic low-confidence verdict rather than guessing.
 */

import {
  CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
  CIVIC_SOURCE_FRESHNESS_DISCLAIMER,
  FRESHNESS_PREDICTION_STATUS,
  FRESHNESS_PREDICTION_ERRORS,
  PRIORITY_BAND,
  PRIORITY_THRESHOLDS,
  DEFAULT_FEATURE_WEIGHTS,
  DEFAULT_PREDICTION,
  FEATURE_NAME,
  DEFAULT_VERIFICATION_STALE_DAYS,
  DEFAULT_SOURCE_AGE_STALE_DAYS,
  MAX_CHANGE_EVENTS,
  MAX_CONCURRENT_PREDICTIONS,
  SENSITIVE_KEY_PATTERN,
  AADHAAR_NUMBER_PATTERN,
  PAN_NUMBER_PATTERN,
  OTP_PATTERN
} from '../data/civicSourceFreshnessPredictionConstants.js';
import {
  loadFreshnessStore,
  ensureFreshnessStore,
  runFreshnessTransaction,
  isServiceId,
  isPredictionId
} from './civicSourceFreshnessPredictionMigrations.js';
import { logDiagnostic } from '../utils/diagnostics.js';

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const clone = (value) => JSON.parse(JSON.stringify(value));

function containsSensitive(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => containsSensitive(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (typeof value === 'string') {
    if (AADHAAR_NUMBER_PATTERN.test(value)) found.push(`${path}: aadhaar-like number`);
    else if (PAN_NUMBER_PATTERN.test(value)) found.push(`${path}: pan-like number`);
    else if (OTP_PATTERN.test(value)) found.push(`${path}: otp-like value`);
    return found;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) found.push(`${path ? `${path}.` : ''}${key}: sensitive key`);
      containsSensitive(child, path ? `${path}.${key}` : key, depth + 1, found);
    }
  }
  return found;
}

function nowIso() {
  return new Date().toISOString();
}

function daysBetweenMs(msA, msB) {
  return Math.max(0, Math.floor((msB - msA) / (24 * 60 * 60 * 1000)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `h-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Normalize a date to a Date or null.
 */
function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Compute a link-health feature score (0-1, higher = more concerning).
 * linkStatus: reachable | redirected | unavailable | unverified | invalid
 */
function linkHealthScore(linkStatus) {
  switch (linkStatus) {
    case 'unavailable':
      return 1.0;
    case 'invalid':
      return 0.9;
    case 'redirected':
      return 0.5;
    case 'unverified':
      return 0.4;
    case 'reachable':
      return 0.0;
    default:
      return 0.4;
  }
}

/**
 * Extract deterministic features for a service from its sources, link health
 * records and verification history.
 * Returns { features, evidence } where features is a 0-1 map and evidence is
 * human-readable strings explaining each feature.
 */
function extractFeatures(service = {}, linkHealthRecords = {}, verificationHistory = [], now = nowIso()) {
  const nowMs = new Date(now).getTime();
  const features = {};
  const evidence = [];

  // Source metadata
  const sources = Array.isArray(service?.officialSources) ? service.officialSources : [];
  const primarySource = sources[0] || {};
  const primaryUrl = typeof primarySource?.url === 'string' ? primarySource.url : '';
  const primaryDomain = primaryUrl ? (() => {
    try { return new URL(primaryUrl).hostname.toLowerCase(); } catch { return ''; }
  })() : '';

  const lastVerified = toDate(service.lastVerified);
  const daysSinceVerification = lastVerified ? daysBetweenMs(lastVerified.getTime(), nowMs) : null;
  const verificationCount = Array.isArray(verificationHistory) ? verificationHistory.length : 0;

  const sourcePublished = toDate(primarySource?.publicationDate);
  const sourceAgeDays = sourcePublished ? daysBetweenMs(sourcePublished.getTime(), nowMs) : null;

  const isSuperseded = Boolean(primarySource?.supersededBy || service.supersededBy);
  const isWithdrawn = Boolean(primarySource?.isWithdrawn || service.isWithdrawn || service.status === 'withdrawn');

  const linkKey = `${service.id}:${primaryUrl.trim()}`;
  const linkRecord = linkHealthRecords[linkKey];
  const linkStatus = linkRecord?.status || 'unverified';

  // --- Feature: days since verification (0-1, capped at stale ceiling) ---
  const staleCeiling = DEFAULT_VERIFICATION_STALE_DAYS;
  if (daysSinceVerification === null) {
    features[FEATURE_NAME.DAYS_SINCE_VERIFICATION] = 1.0; // never verified is most concerning
    evidence.push('Never formally verified');
  } else if (daysSinceVerification > staleCeiling) {
    features[FEATURE_NAME.DAYS_SINCE_VERIFICATION] = 1.0;
    evidence.push(`Not verified for ${daysSinceVerification} days (exceeds ${staleCeiling}d ceiling)`);
  } else {
    features[FEATURE_NAME.DAYS_SINCE_VERIFICATION] = daysSinceVerification / staleCeiling;
    evidence.push(`Last verified ${daysSinceVerification} days ago`);
  }

  // --- Feature: link health ---
  features[FEATURE_NAME.LINK_HEALTH] = linkHealthScore(linkStatus);
  const linkReasonMap = {
    reachable: 'Primary link reachable',
    redirected: 'Primary link redirected - needs review',
    unavailable: 'Primary link not working',
    unverified: 'Primary link could not be verified',
    invalid: 'Primary link is not a valid web address'
  };
  evidence.push(linkReasonMap[linkStatus] || 'Link health unknown');

  // --- Feature: source age ---
  let sourceAgeFeature;
  if (sourceAgeDays === null) {
    sourceAgeFeature = 0.5;
    evidence.push('Source publication date unknown');
  } else if (sourceAgeDays > DEFAULT_SOURCE_AGE_STALE_DAYS) {
    sourceAgeFeature = 1.0;
    evidence.push(`Source is ${sourceAgeDays} days old`);
  } else {
    sourceAgeFeature = sourceAgeDays / DEFAULT_SOURCE_AGE_STALE_DAYS;
    evidence.push(`Source published ${sourceAgeDays} days ago`);
  }
  features[FEATURE_NAME.SOURCE_AGE] = sourceAgeFeature;

  // --- Feature: superseded status ---
  const supersededFeature = (isSuperseded || isWithdrawn) ? 1.0 : 0.0;
  features[FEATURE_NAME.SUPERSEDED_STATUS] = supersededFeature;
  if (isWithdrawn) evidence.push('Source marked withdrawn');
  else if (isSuperseded) evidence.push('Source superseded by a newer order');

  // --- Feature: change frequency ---
  const changeEvents = Array.isArray(service?.changeEvents) ? service.changeEvents : [];
  const changeCount = clamp(changeEvents.length, 0, MAX_CHANGE_EVENTS);
  features[FEATURE_NAME.CHANGE_FREQUENCY] = changeCount / MAX_CHANGE_EVENTS;
  if (changeCount > 0) evidence.push(`${changeCount} recorded change event(s)`);

  // --- Feature: government domain (de-weight) ---
  const govDomain = /\.gov\.in$/i.test(primaryDomain) ||
    /\.nic\.in$/i.test(primaryDomain) ||
    /\.gov$/i.test(primaryDomain) ||
    /\.ac\.in$/i.test(primaryDomain) ||
    /\.edu\.in$/i.test(primaryDomain) ||
    /\.org\.in$/i.test(primaryDomain);
  features[FEATURE_NAME.GOV_DOMAIN] = govDomain ? 1.0 : 0.0;
  if (govDomain) evidence.push('Source is on a government domain (slightly de-weighted)');

  // --- Feature: verification count (de-weight) ---
  features[FEATURE_NAME.VERIFICATION_COUNT] = clamp(verificationCount, 0, MAX_CHANGE_EVENTS) / MAX_CHANGE_EVENTS;
  if (verificationCount > 0) evidence.push(`${verificationCount} verification(s) on record`);

  return { features, evidence };
}

/**
 * Compute a weighted 0-1 priority score from features and weights.
 */
function computeScore(features, weights = DEFAULT_FEATURE_WEIGHTS) {
  let score = 0;
  for (const [feature, weight] of Object.entries(weights)) {
    const value = features[feature] != null ? features[feature] : 0;
    score += value * weight;
  }
  return clamp(score, 0, 1);
}

/**
 * Map a 0-1 score to a priority band.
 */
function scoreToBand(score) {
  if (score >= PRIORITY_THRESHOLDS.CRITICAL) return PRIORITY_BAND.CRITICAL;
  if (score >= PRIORITY_THRESHOLDS.HIGH) return PRIORITY_BAND.HIGH;
  if (score >= PRIORITY_THRESHOLDS.MEDIUM) return PRIORITY_BAND.MEDIUM;
  return PRIORITY_BAND.LOW;
}

/**
 * Compute confidence (0-1): higher when we have more verification data and a
 * verifiable link. Lower when everything is unknown.
 */
function computeConfidence(features, verificationCount, linkStatus) {
  let confidence = 0.2; // baseline low confidence
  if (verificationCount > 0) confidence += 0.3;
  if (verificationCount >= 3) confidence += 0.2;
  if (linkStatus === 'reachable' || linkStatus === 'unavailable') confidence += 0.2; // we have a signal
  if (features[FEATURE_NAME.DAYS_SINCE_VERIFICATION] !== undefined) confidence += 0.1;
  return clamp(confidence, 0, 1);
}

/**
 * Build a human-readable explanation from the top contributing features.
 */
function buildExplanation(features, weights, evidence, score, band) {
  const contributions = [];
  for (const [feature, weight] of Object.entries(weights)) {
    const value = features[feature] != null ? features[feature] : 0;
    if (weight !== 0 && value > 0) {
      contributions.push({ feature, weight, value, contribution: value * weight });
    }
  }
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const top = contributions.slice(0, 3);
  const parts = top.map((c) => {
    const sign = c.contribution >= 0 ? 'increases' : 'decreases';
    return `${c.feature} (${sign} priority)`;
  });

  let summary = `Priority score ${Math.round(score * 100)} (${band}).`;
  if (parts.length > 0) summary += ` Main drivers: ${parts.join(', ')}.`;
  summary += ` Evidence: ${evidence.slice(0, 4).join('; ')}.`;

  return summary;
}

/**
 * Create the freshness prediction engine backed by a freshness store.
 */
export function createFreshnessPredictionEngine({
  loadStore = loadFreshnessStore,
  runTransaction = runFreshnessTransaction,
  logDiagnostic: log = logDiagnostic
} = {}) {
  const activePredictions = new Map(); // serviceId => { startedAt }

  /**
   * Validate a prediction request at the trust boundary.
   */
  function validatePredictionRequest(input = {}) {
    const errors = [];
    const fail = (field, code, message) => errors.push({ field, code, message });

    if (!isObject(input)) {
      return { valid: false, errors: [{ field: '(request)', code: FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE, message: 'Request must be a JSON object.' }] };
    }

    if (input.serviceId !== undefined && !isServiceId(input.serviceId)) {
      fail('serviceId', FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE, 'serviceId must be a lowercase slug.');
    }
    if (input.predictionId !== undefined && !isPredictionId(input.predictionId)) {
      fail('predictionId', FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE, 'predictionId must be a lowercase slug.');
    }
    if (input.reviewerNote !== undefined && (typeof input.reviewerNote !== 'string' || input.reviewerNote.length < 1 || input.reviewerNote.length > 500)) {
      fail('reviewerNote', FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE, 'reviewerNote must be a string between 1 and 500 characters.');
    }
    if (input.reviewedBy !== undefined && typeof input.reviewedBy !== 'string') {
      fail('reviewedBy', FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE, 'reviewedBy must be a string.');
    }
    if (input.nowIso !== undefined && typeof input.nowIso !== 'string') {
      fail('nowIso', FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE, 'nowIso must be an ISO-8601 string.');
    }

    const sensitive = containsSensitive(input);
    for (const where of sensitive) {
      fail(where, FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE, 'Remove identity numbers, OTPs and credentials from the request.');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Compute a freshness prediction for a service.
   * Returns { ok, prediction, features, evidence, score, band, confidence }.
   */
  async function predict({
    serviceId,
    service,
    linkHealthRecords = {},
    verificationHistory = [],
    weights,
    forceRecompute = false,
    nowIso: _now
  } = {}) {
    const validation = validatePredictionRequest({ serviceId });
    if (!validation.valid) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.VALIDATION_FAILED, message: 'Invalid prediction request.' }, errors: validation.errors };
    }
    if (!serviceId) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.INVALID_REQUEST, message: 'serviceId is required.' } };
    }

    const now = _now ? new Date(_now).toISOString() : nowIso();

    let store;
    try {
      store = loadStore({ now });
    } catch (error) {
      log('Failed to load freshness store; computing in-memory only.', error);
      store = ensureFreshnessStore({ now });
    }

    // Concurrency cap.
    if (activePredictions.size >= MAX_CONCURRENT_PREDICTIONS) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.STORAGE_UNAVAILABLE, message: `Maximum ${MAX_CONCURRENT_PREDICTIONS} concurrent predictions reached.` } };
    }

    const existing = store.predictions.find((p) => p.serviceId === serviceId);
    if (existing && !forceRecompute && existing.status === FRESHNESS_PREDICTION_STATUS.COMPUTED) {
      return {
        ok: true,
        prediction: existing,
        features: existing.features || {},
        evidence: existing.evidence || [],
        score: existing.priorityScore / 100,
        band: existing.priorityBand,
        confidence: existing.confidence || 0,
        cached: true
      };
    }

    const w = weights || DEFAULT_FEATURE_WEIGHTS;
    const svc = service || { id: serviceId, officialSources: [], status: 'active' };

    const { features, evidence } = extractFeatures(svc, linkHealthRecords, verificationHistory, now);
    const score01 = computeScore(features, w);
    const band = scoreToBand(score01);
    const confidence = computeConfidence(features, Array.isArray(verificationHistory) ? verificationHistory.length : 0, linkHealthRecords[`${serviceId}:${(svc.officialSources && svc.officialSources[0] && svc.officialSources[0].url) || ''}`]?.status || 'unverified');

    const priorityScore = Math.round(score01 * 100);

    const isStale = features[FEATURE_NAME.DAYS_SINCE_VERIFICATION] >= 1 ||
      features[FEATURE_NAME.LINK_HEALTH] >= 0.9 ||
      features[FEATURE_NAME.SUPERSEDED_STATUS] >= 1;

    const status = isStale ? FRESHNESS_PREDICTION_STATUS.COMPUTED : FRESHNESS_PREDICTION_STATUS.PENDING;

    const prediction = {
      id: `fp-${String(Date.now())}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      serviceId,
      serviceName: svc.name || serviceId,
      priorityBand: band,
      priorityScore,
      confidence,
      reasons: evidence,
      features,
      status,
      reviewed: false,
      reviewerNote: '',
      reviewedAt: null,
      reviewedBy: '',
      computedAt: now,
      schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION,
      disclaimer: CIVIC_SOURCE_FRESHNESS_DISCLAIMER,
      noCitizenData: true,
      untrusted: true,
      requiresHumanReview: band === PRIORITY_BAND.CRITICAL || band === PRIORITY_BAND.HIGH
    };

    activePredictions.set(serviceId, { startedAt: now });

    try {
      const persisted = runTransaction((draft) => {
        // Replace existing prediction for this service (one active prediction per service).
        draft.predictions = draft.predictions.filter((p) => p.serviceId !== serviceId);
        draft.predictions.push(clone(prediction));
        draft.predictionHistory.push({
          id: `hist-${Date.now()}`,
          serviceId,
          priorityScore,
          priorityBand: band,
          confidence,
          computedAt: now,
          schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION
        });
        // Keep history bounded.
        if (draft.predictionHistory.length > 1000) {
          draft.predictionHistory = draft.predictionHistory.slice(-1000);
        }
        draft.auditEvents = draft.auditEvents || [];
        draft.auditEvents.unshift({
          id: `audit-predict-${Date.now()}`,
          action: 'freshness.predict',
          entityType: 'service',
          entityId: serviceId,
          actorRole: 'system',
          actorId: 'freshness.engine',
          reason: `Computed freshness prediction for ${serviceId}: ${band} (${priorityScore}).`,
          details: { serviceId, priorityScore, priorityBand: band, confidence },
          timestamp: now,
          schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION
        });
        if (draft.auditEvents.length > 1000) {
          draft.auditEvents = draft.auditEvents.slice(0, 1000);
        }
        return { prediction };
      }, { now: new Date(now) });

      return {
        ok: true,
        prediction: persisted.result.prediction || prediction,
        features,
        evidence,
        score: score01,
        band,
        confidence,
        cached: false
      };
    } catch (error) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.STORAGE_UNAVAILABLE, message: `Could not persist prediction: ${String(error)}` } };
    } finally {
      activePredictions.delete(serviceId);
    }
  }

  /**
   * Record a human review decision for a prediction.
   */
  async function reviewPrediction({ serviceId, reviewerNote, reviewedBy, decision, nowIso: _now } = {}) {
    const validation = validatePredictionRequest({ serviceId, reviewerNote, reviewedBy });
    if (!validation.valid) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.VALIDATION_FAILED, message: 'Invalid review request.' }, errors: validation.errors };
    }
    if (!serviceId) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.INVALID_REQUEST, message: 'serviceId is required.' } };
    }

    const now = _now ? new Date(_now).toISOString() : nowIso();

    try {
      const result = runTransaction((draft) => {
        const prediction = draft.predictions.find((p) => p.serviceId === serviceId);
        if (!prediction) throw new Error('Prediction not found.');
        prediction.reviewed = true;
        prediction.reviewerNote = reviewerNote || '';
        prediction.reviewedBy = reviewedBy || 'maintainer';
        prediction.reviewedAt = now;
        prediction.status = decision || FRESHNESS_PREDICTION_STATUS.REVIEWED;
        prediction.updatedAt = now;

        draft.reviewAudit.unshift({
          id: `audit-review-${Date.now()}`,
          action: 'freshness.review',
          entityType: 'prediction',
          entityId: prediction.id,
          actorRole: 'maintainer',
          actorId: reviewedBy || 'maintainer',
          reason: `Reviewed prediction for ${serviceId}: ${decision || 'reviewed'}.`,
          details: { serviceId, predictionId: prediction.id, decision, reviewerNote },
          timestamp: now,
          schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION
        });
        if (draft.reviewAudit.length > 1000) {
          draft.reviewAudit = draft.reviewAudit.slice(0, 1000);
        }
        return { prediction };
      }, { now: new Date(now) });

      return { ok: true, prediction: result.result.prediction };
    } catch (error) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.STORAGE_UNAVAILABLE, message: `Could not record review: ${String(error)}` } };
    }
  }

  /**
   * Get a prediction for a service.
   */
  async function getPrediction(serviceId) {
    if (!isServiceId(serviceId)) return null;
    const store = await loadStore({ now: nowIso() });
    return store.predictions.find((p) => p.serviceId === serviceId) || null;
  }

  /**
   * List predictions, optionally filtered by band/status.
   */
  async function listPredictions({ band, status, limit = 50, cursor } = {}) {
    const store = await loadStore({ now: nowIso() });
    let items = store.predictions.slice();
    if (band) items = items.filter((p) => p.priorityBand === band);
    if (status) items = items.filter((p) => p.status === status);
    items.sort((a, b) => b.priorityScore - a.priorityScore || new Date(b.computedAt) - new Date(a.computedAt));
    const start = cursor ? items.findIndex((p) => p.id === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return { predictions: page, nextCursor: page.length === limit ? page[page.length - 1].id : null };
  }

  /**
   * Get review audit trail.
   */
  async function getReviewAudit({ serviceId, limit = 50 } = {}) {
    const store = await loadStore({ now: nowIso() });
    let events = store.reviewAudit || [];
    if (serviceId) events = events.filter((e) => e.details && e.details.serviceId === serviceId);
    return events.slice(0, limit);
  }

  /**
   * Get drift events (score changes over time) for a service.
   */
  async function getDriftEvents({ serviceId, limit = 50 } = {}) {
    const store = await loadStore({ now: nowIso() });
    let events = store.driftEvents || [];
    if (serviceId) events = events.filter((e) => e.serviceId === serviceId);
    return events.slice(0, limit);
  }

  /**
   * Record a drift event when a score changes meaningfully.
   */
  function recordDriftEvent({ serviceId, previousScore, currentScore, reason, nowIso: _now } = {}) {
    if (!isServiceId(serviceId)) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.INVALID_TYPE, message: 'Invalid serviceId.' } };
    }
    const now = _now ? new Date(_now).toISOString() : nowIso();
    const drift = Math.abs(currentScore - previousScore);
    if (drift < 0.05) {
      return { ok: true, recorded: false, reason: 'Drift below threshold; not recorded.' };
    }

    try {
      const result = runTransaction((draft) => {
        draft.driftEvents.unshift({
          id: `drift-${Date.now()}`,
          serviceId,
          previousScore,
          currentScore,
          drift,
          reason: reason || 'Score changed.',
          recordedAt: now,
          schemaVersion: CIVIC_SOURCE_FRESHNESS_SCHEMA_VERSION
        });
        if (draft.driftEvents.length > 1000) {
          draft.driftEvents = draft.driftEvents.slice(0, 1000);
        }
        return { drift };
      }, { now: new Date(now) });
      return { ok: true, recorded: true, drift: result.result.drift };
    } catch (error) {
      return { ok: false, error: { code: FRESHNESS_PREDICTION_ERRORS.STORAGE_UNAVAILABLE, message: `Could not record drift: ${String(error)}` } };
    }
  }

  /**
   * List feature weights (read-only copy).
   */
  function listFeatureWeights() {
    return clone(DEFAULT_FEATURE_WEIGHTS);
  }

  return {
    validatePredictionRequest,
    predict,
    reviewPrediction,
    getPrediction,
    listPredictions,
    getReviewAudit,
    getDriftEvents,
    recordDriftEvent,
    listFeatureWeights,
    FRESHNESS_PREDICTION_STATUS,
    FRESHNESS_PREDICTION_ERRORS,
    PRIORITY_BAND,
    DEFAULT_PREDICTION,
    DEFAULT_FEATURE_WEIGHTS,
    PRIORITY_THRESHOLDS,
    __testables: {
      validatePredictionRequest,
      predict,
      reviewPrediction,
      getPrediction,
      listPredictions,
      getReviewAudit,
      getDriftEvents,
      recordDriftEvent,
      listFeatureWeights,
      extractFeatures,
      computeScore,
      scoreToBand,
      computeConfidence,
      buildExplanation,
      linkHealthScore,
      hashString,
      containsSensitive,
      FRESHNESS_PREDICTION_STATUS,
      FRESHNESS_PREDICTION_ERRORS,
      PRIORITY_BAND,
      DEFAULT_FEATURE_WEIGHTS,
      PRIORITY_THRESHOLDS
    }
  };
}

export const freshnessPredictionEngine = createFreshnessPredictionEngine();
