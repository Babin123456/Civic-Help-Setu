/**
 * src/services/civicRecommendationExperimentationEngine.js
 *
 * Core engine for the Civic Service Recommendation Experimentation Platform
 * with Guardrails (#1193).
 *
 * Features:
 * 1. Deterministic variant assignment without citizen identity tracking.
 * 2. Strict prohibited-attribute screening (caste, religion, gender, Aadhaar, etc.).
 * 3. Guardrail monitoring (relevance floor, language coverage, error rate ceiling).
 * 4. Immediate rollback / kill-switch mechanism.
 * 5. Privacy-safe cohort aggregation with minimum sample size protection.
 */

import {
  CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
  CIVIC_EXPERIMENTATION_DISCLAIMER,
  EXPERIMENT_STATUS,
  EXPERIMENTATION_ERRORS,
  PROHIBITED_TARGETING_ATTRIBUTES,
  DEFAULT_GUARDRAILS,
  DEFAULT_VARIANT,
  MAX_INPUT_BYTES
} from '../data/civicRecommendationExperimentationConstants.js';
import {
  loadExperimentationStore,
  persistExperimentationStore,
  runExperimentationTransaction,
  isExperimentId,
  isVariantId
} from './civicRecommendationExperimentationMigrations.js';

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const clone = (value) => JSON.parse(JSON.stringify(value));

function nowIso() {
  return new Date().toISOString();
}

/**
 * Fast deterministic 32-bit FNV-1a hash algorithm.
 * Guarantees consistent variant assignment across turns without storing user state.
 */
function hashFnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

/**
 * Inspect an object recursively for prohibited sensitive attributes.
 */
function findProhibitedAttributes(data, depth = 0, found = []) {
  if (depth > 6 || !data) return found;
  if (Array.isArray(data)) {
    for (const item of data) {
      findProhibitedAttributes(item, depth + 1, found);
    }
    return found;
  }
  if (isObject(data)) {
    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase();
      if (PROHIBITED_TARGETING_ATTRIBUTES.some((attr) => lowerKey.includes(attr))) {
        found.push(key);
      }
      findProhibitedAttributes(data[key], depth + 1, found);
    }
  }
  return found;
}

export function createRecommendationExperimentationEngine({
  loadStore = loadExperimentationStore,
  persistStore = persistExperimentationStore
} = {}) {
  /**
   * Validate a request at the trust boundary.
   */
  function validateRequest(input = {}) {
    const errors = [];
    const fail = (field, code, message) => errors.push({ field, code, message });

    if (!isObject(input)) {
      return { valid: false, errors: [{ field: '(request)', code: EXPERIMENTATION_ERRORS.INVALID_TYPE, message: 'Request must be a JSON object.' }] };
    }

    if (JSON.stringify(input).length > MAX_INPUT_BYTES) {
      fail('(payload)', EXPERIMENTATION_ERRORS.INVALID_REQUEST, `Payload exceeds limit of ${MAX_INPUT_BYTES} bytes.`);
    }

    const expId = input.experimentId || input.id;
    if (expId !== undefined && !isExperimentId(expId)) {
      fail('experimentId', EXPERIMENTATION_ERRORS.INVALID_TYPE, 'experimentId must be a lowercase slug.');
    }

    if (input.variantId !== undefined && !isVariantId(input.variantId)) {
      fail('variantId', EXPERIMENTATION_ERRORS.INVALID_TYPE, 'variantId must be a lowercase slug.');
    }

    // Prohibited attribute screening
    const prohibitedInContext = findProhibitedAttributes(input.context || input.audienceCriteria);
    if (prohibitedInContext.length > 0) {
      fail(
        'targeting',
        EXPERIMENTATION_ERRORS.PROHIBITED_ATTRIBUTE_TARGETING,
        `Prohibited sensitive attribute(s) detected: ${prohibitedInContext.join(', ')}`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Register or update an experiment.
   */
  function upsertExperiment(experimentData = {}) {
    const validation = validateRequest(experimentData);
    if (!validation.valid) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.VALIDATION_FAILED, message: 'Validation failed.' }, errors: validation.errors };
    }

    const {
      id,
      name,
      description,
      status = EXPERIMENT_STATUS.DRAFT,
      variants = [clone(DEFAULT_VARIANT)],
      guardrails = clone(DEFAULT_GUARDRAILS),
      audienceCriteria = {},
      optInRequired = true,
      salt = 'salt-civic-recs',
      actorId = 'maintainer'
    } = experimentData;

    if (!id || !name) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.INVALID_REQUEST, message: 'Experiment id and name are required.' } };
    }

    if (!isExperimentId(id)) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.INVALID_TYPE, message: 'id must be a lowercase slug.' } };
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.INVALID_REQUEST, message: 'At least one variant is required.' } };
    }

    // Ensure weights are valid numbers
    const totalWeight = variants.reduce((acc, v) => acc + (Number(v.weight) || 0), 0);
    if (totalWeight <= 0) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.INVALID_REQUEST, message: 'Variant weights must sum to a positive number.' } };
    }

    const now = nowIso();

    try {
      const persisted = runExperimentationTransaction((draft) => {
        const existingIdx = draft.experiments.findIndex((e) => e.id === id);
        const existing = existingIdx >= 0 ? draft.experiments[existingIdx] : null;

        const nextExp = {
          id,
          name,
          description: description || '',
          status,
          variants: variants.map((v) => ({
            id: v.id,
            name: v.name,
            weight: Number(v.weight) || 0,
            strategyConfig: v.strategyConfig || {},
            description: v.description || ''
          })),
          guardrails: {
            minRelevanceScore: guardrails.minRelevanceScore ?? DEFAULT_GUARDRAILS.minRelevanceScore,
            minLanguageCoverage: guardrails.minLanguageCoverage ?? DEFAULT_GUARDRAILS.minLanguageCoverage,
            maxErrorRate: guardrails.maxErrorRate ?? DEFAULT_GUARDRAILS.maxErrorRate,
            minCohortSize: guardrails.minCohortSize ?? DEFAULT_GUARDRAILS.minCohortSize
          },
          audienceCriteria,
          optInRequired: Boolean(optInRequired),
          salt,
          metrics: existing?.metrics || {},
          guardrailBreaches: existing?.guardrailBreaches || [],
          rollbackReason: existing?.rollbackReason || null,
          rolledBackAt: existing?.rolledBackAt || null,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          schemaVersion: CIVIC_EXPERIMENTATION_SCHEMA_VERSION,
          noCitizenData: true,
          untrusted: true,
          requiresHumanReview: true
        };

        // Initialize metrics for any new variants
        for (const variant of nextExp.variants) {
          if (!nextExp.metrics[variant.id]) {
            nextExp.metrics[variant.id] = {
              assignments: 0,
              relevanceSum: 0,
              languageCoverageSum: 0,
              errorCount: 0
            };
          }
        }

        if (existingIdx >= 0) {
          draft.experiments[existingIdx] = nextExp;
        } else {
          draft.experiments.push(nextExp);
        }

        draft.auditLog.unshift({
          id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          action: existing ? 'experiment.update' : 'experiment.create',
          entityType: 'experiment',
          entityId: id,
          actorRole: 'maintainer',
          actorId,
          reason: `Experiment ${id} ${existing ? 'updated' : 'created'} with status ${status}.`,
          timestamp: now,
          schemaVersion: CIVIC_EXPERIMENTATION_SCHEMA_VERSION
        });

        if (draft.auditLog.length > 1000) draft.auditLog = draft.auditLog.slice(0, 1000);
        return { experiment: nextExp };
      }, { loadStore, persistStore });

      return { ok: true, experiment: persisted.result.experiment };
    } catch (err) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.STORAGE_UNAVAILABLE, message: `Could not save experiment: ${String(err)}` } };
    }
  }

  /**
   * Get an experiment by id.
   */
  function getExperiment(id) {
    if (!isExperimentId(id)) return null;
    const store = loadStore();
    return store.experiments.find((e) => e.id === id) || null;
  }

  /**
   * List all experiments.
   */
  function listExperiments() {
    const store = loadStore();
    return store.experiments.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      description: e.description,
      variantCount: e.variants ? e.variants.length : 0,
      optInRequired: e.optInRequired,
      updatedAt: e.updatedAt,
      guardrailBreachesCount: e.guardrailBreaches ? e.guardrailBreaches.length : 0,
      rollbackReason: e.rollbackReason
    }));
  }

  /**
   * Deterministically assign a variant to a citizen.
   */
  function assignVariant({
    experimentId,
    citizenId = 'anonymous',
    context = {},
    optIn = false
  } = {}) {
    const val = validateRequest({ experimentId, context });
    if (!val.valid) {
      return {
        variant: clone(DEFAULT_VARIANT),
        assigned: false,
        reason: 'validation_failed',
        errors: val.errors,
        disclaimer: CIVIC_EXPERIMENTATION_DISCLAIMER
      };
    }

    const exp = getExperiment(experimentId);
    if (!exp) {
      return {
        variant: clone(DEFAULT_VARIANT),
        assigned: false,
        reason: 'experiment_not_found',
        disclaimer: CIVIC_EXPERIMENTATION_DISCLAIMER
      };
    }

    // Inactive or rolled back: return safe control
    if (exp.status !== EXPERIMENT_STATUS.ACTIVE) {
      const controlVariant = exp.variants.find((v) => v.id === 'control') || exp.variants[0] || clone(DEFAULT_VARIANT);
      return {
        variant: controlVariant,
        assigned: false,
        reason: `experiment_${exp.status}`,
        disclaimer: CIVIC_EXPERIMENTATION_DISCLAIMER
      };
    }

    // Opt-in required check
    if (exp.optInRequired && !optIn) {
      const controlVariant = exp.variants.find((v) => v.id === 'control') || exp.variants[0] || clone(DEFAULT_VARIANT);
      return {
        variant: controlVariant,
        assigned: false,
        reason: 'opt_in_required',
        disclaimer: CIVIC_EXPERIMENTATION_DISCLAIMER
      };
    }

    // Deterministic hashing
    const seed = `${citizenId}:${exp.id}:${exp.salt || ''}`;
    const hashVal = hashFnv1a(seed);
    const bucket = hashVal % 100;

    const totalWeight = exp.variants.reduce((acc, v) => acc + (Number(v.weight) || 0), 0);
    let cumulative = 0;
    let selectedVariant = exp.variants[0];

    for (const v of exp.variants) {
      const normalizedShare = ((Number(v.weight) || 0) / totalWeight) * 100;
      cumulative += normalizedShare;
      if (bucket < cumulative) {
        selectedVariant = v;
        break;
      }
    }

    return {
      variant: selectedVariant,
      assigned: true,
      bucket,
      reason: 'deterministic_assignment',
      strategyConfig: selectedVariant.strategyConfig || {},
      disclaimer: CIVIC_EXPERIMENTATION_DISCLAIMER
    };
  }

  /**
   * Record privacy-safe aggregate metrics for an experiment variant.
   */
  function recordMetric({
    experimentId,
    variantId,
    relevanceScore = 1.0,
    hasLanguageCoverage = true,
    isError = false
  } = {}) {
    const val = validateRequest({ experimentId, variantId });
    if (!val.valid) return { ok: false, errors: val.errors };

    const now = nowIso();

    try {
      const persisted = runExperimentationTransaction((draft) => {
        const exp = draft.experiments.find((e) => e.id === experimentId);
        if (!exp) throw new Error(`Experiment ${experimentId} not found.`);

        if (!exp.metrics[variantId]) {
          exp.metrics[variantId] = { assignments: 0, relevanceSum: 0, languageCoverageSum: 0, errorCount: 0 };
        }

        const m = exp.metrics[variantId];
        m.assignments += 1;
        m.relevanceSum += Math.max(0, Math.min(1, Number(relevanceScore) || 0));
        m.languageCoverageSum += hasLanguageCoverage ? 1 : 0;
        if (isError) m.errorCount += 1;

        // Evaluate guardrails
        const meanRelevance = m.assignments > 0 ? m.relevanceSum / m.assignments : 1.0;
        const languageCoverageRatio = m.assignments > 0 ? m.languageCoverageSum / m.assignments : 1.0;
        const errorRate = m.assignments > 0 ? m.errorCount / m.assignments : 0.0;

        const breaches = [];
        if (exp.guardrails.minRelevanceScore && meanRelevance < exp.guardrails.minRelevanceScore) {
          breaches.push({
            type: 'min_relevance',
            expected: exp.guardrails.minRelevanceScore,
            actual: meanRelevance,
            variantId
          });
        }
        if (exp.guardrails.minLanguageCoverage && languageCoverageRatio < exp.guardrails.minLanguageCoverage) {
          breaches.push({
            type: 'min_language_coverage',
            expected: exp.guardrails.minLanguageCoverage,
            actual: languageCoverageRatio,
            variantId
          });
        }
        if (exp.guardrails.maxErrorRate && errorRate > exp.guardrails.maxErrorRate) {
          breaches.push({
            type: 'max_error_rate',
            expected: exp.guardrails.maxErrorRate,
            actual: errorRate,
            variantId
          });
        }

        if (breaches.length > 0) {
          const breachEvent = {
            id: `breach-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            experimentId,
            variantId,
            breaches,
            timestamp: now
          };
          exp.guardrailBreaches.push(breachEvent);
          if (exp.guardrailBreaches.length > 200) exp.guardrailBreaches = exp.guardrailBreaches.slice(-200);

          draft.auditLog.unshift({
            id: `audit-breach-${Date.now()}`,
            action: 'guardrail.breached',
            entityType: 'experiment',
            entityId: experimentId,
            actorRole: 'guardrail-monitor',
            actorId: 'system',
            reason: `Guardrail breached on variant ${variantId}: ${breaches.map((b) => b.type).join(', ')}`,
            timestamp: now,
            schemaVersion: CIVIC_EXPERIMENTATION_SCHEMA_VERSION
          });
        }

        draft.metricsLog.push({
          id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          experimentId,
          variantId,
          relevance: Number(relevanceScore) || 0,
          languageCoverage: Boolean(hasLanguageCoverage),
          isError: Boolean(isError),
          timestamp: now
        });
        if (draft.metricsLog.length > 2000) draft.metricsLog = draft.metricsLog.slice(-2000);

        return { breaches, metrics: m };
      }, { loadStore, persistStore });

      return {
        ok: true,
        breaches: persisted.result.breaches,
        metrics: persisted.result.metrics
      };
    } catch (err) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.STORAGE_UNAVAILABLE, message: String(err) } };
    }
  }

  /**
   * Trigger an immediate rollback on an experiment.
   */
  function rollbackExperiment({ experimentId, reason = 'Operator triggered rollback', actorId = 'maintainer' } = {}) {
    if (!isExperimentId(experimentId)) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.INVALID_TYPE, message: 'Invalid experiment ID.' } };
    }

    const now = nowIso();

    try {
      const persisted = runExperimentationTransaction((draft) => {
        const exp = draft.experiments.find((e) => e.id === experimentId);
        if (!exp) throw new Error(`Experiment ${experimentId} not found.`);

        exp.status = EXPERIMENT_STATUS.ROLLED_BACK;
        exp.rollbackReason = reason;
        exp.rolledBackAt = now;
        exp.updatedAt = now;

        draft.auditLog.unshift({
          id: `audit-rollback-${Date.now()}`,
          action: 'experiment.rollback',
          entityType: 'experiment',
          entityId: experimentId,
          actorRole: 'maintainer',
          actorId,
          reason: `Immediate rollback triggered: ${reason}`,
          timestamp: now,
          schemaVersion: CIVIC_EXPERIMENTATION_SCHEMA_VERSION
        });

        return { experiment: exp };
      }, { loadStore, persistStore });

      return { ok: true, experiment: persisted.result.experiment };
    } catch (err) {
      return { ok: false, error: { code: EXPERIMENTATION_ERRORS.STORAGE_UNAVAILABLE, message: String(err) } };
    }
  }

  /**
   * Get comparative performance metrics for an experiment.
   */
  function getExperimentMetrics(experimentId) {
    const exp = getExperiment(experimentId);
    if (!exp) return null;

    const minCohort = exp.guardrails?.minCohortSize || DEFAULT_GUARDRAILS.minCohortSize;
    const variantMetrics = {};

    for (const v of (exp.variants || [])) {
      const m = exp.metrics?.[v.id] || { assignments: 0, relevanceSum: 0, languageCoverageSum: 0, errorCount: 0 };
      const cohortMet = m.assignments >= minCohort;

      variantMetrics[v.id] = {
        assignments: m.assignments,
        cohortSizeMet: cohortMet,
        meanRelevance: m.assignments > 0 ? Number((m.relevanceSum / m.assignments).toFixed(3)) : 0,
        languageCoverageRatio: m.assignments > 0 ? Number((m.languageCoverageSum / m.assignments).toFixed(3)) : 0,
        errorRate: m.assignments > 0 ? Number((m.errorCount / m.assignments).toFixed(3)) : 0
      };
    }

    return {
      experimentId: exp.id,
      status: exp.status,
      minCohortSize: minCohort,
      guardrailBreaches: exp.guardrailBreaches || [],
      variants: variantMetrics
    };
  }

  /**
   * Get the audit log.
   */
  function getAuditLog({ limit = 50 } = {}) {
    const store = loadStore();
    return (store.auditLog || []).slice(0, Math.min(100, Math.max(1, limit)));
  }

  return {
    validateRequest,
    upsertExperiment,
    getExperiment,
    listExperiments,
    assignVariant,
    recordMetric,
    rollbackExperiment,
    getExperimentMetrics,
    getAuditLog
  };
}

export const recommendationExperimentationEngine = createRecommendationExperimentationEngine();
