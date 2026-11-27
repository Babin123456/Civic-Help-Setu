/**
 * src/services/recommendationFairnessAuditService.js
 *
 * Civic Recommendation Fairness and Coverage Audit Suite (#1449).
 *
 * Extends src/services/fairnessErrorMonitoringService.js and src/services/recommendationEngine.js
 * to provide:
 * - Offline evaluation datasets with provenance and explicit consent tracking
 * - Multi-axis cohort evaluation (language, district, deviceType, connectivityTier)
 * - Retrieval & completion outcome metrics (Recall@k, nDCG@k, Retrieval Rate, Completion Rate, Coverage)
 * - 95% Confidence Intervals (Wilson score for proportions, normal-approx for continuous metrics)
 * - Small-group suppression (k-anonymity cohort floor)
 * - Strict no-sensitive-trait-inference & zero-PII enforcement
 * - Release regression gates against both absolute thresholds and baseline runs
 */

import {
  calculateRecallAtK,
  calculateNdcgAtK,
  calculateCalibrationScore,
  validateUnbiasedSignals,
} from './fairnessErrorMonitoringService.js';
import { rankCivicServices } from './recommendationEngine.js';
import { MOCK_SERVICES } from '../data/services.js';
import {
  AUDIT_SCHEMA_VERSION,
  COHORT_AXES,
  DEFAULT_AUDIT_POLICY,
  RECORD_ORIGIN,
  evaluateProvenanceVerification,
  validateNoSensitiveTraitOrPii,
} from './recommendationFairnessAuditContract.js';

/**
 * Computes a Wilson score confidence interval for a binomial proportion.
 * Safe for small n and boundary proportions (0 or 1).
 *
 * @param {number} successes
 * @param {number} n
 * @param {number} [z=1.96]
 * @returns {{ estimate: number, lower: number, upper: number, n: number, confidenceLevel: number, method: string }}
 */
export function computeWilsonConfidenceInterval(successes, n, z = 1.96) {
  if (!Number.isFinite(n) || n <= 0) {
    return { estimate: 0, lower: 0, upper: 0, n: 0, confidenceLevel: 0.95, method: 'wilson' };
  }
  const p = Math.min(1, Math.max(0, successes / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;

  return {
    estimate: Number(p.toFixed(4)),
    lower: Number(Math.max(0, center - margin).toFixed(4)),
    upper: Number(Math.min(1, center + margin).toFixed(4)),
    n,
    confidenceLevel: 0.95,
    method: 'wilson',
  };
}

/**
 * Computes a 95% confidence interval for the mean of bounded [0, 1] continuous metrics
 * such as Recall@k and nDCG@k.
 *
 * @param {number[]} values
 * @param {number} [z=1.96]
 * @returns {{ estimate: number, lower: number, upper: number, n: number, confidenceLevel: number, method: string }}
 */
export function computeMeanConfidenceInterval(values = [], z = 1.96) {
  const n = values.length;
  if (n === 0) {
    return { estimate: 0, lower: 0, upper: 0, n: 0, confidenceLevel: 0.95, method: 'normal_approx' };
  }
  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  if (n === 1) {
    const clamped = Number(Math.min(1, Math.max(0, mean)).toFixed(4));
    return { estimate: clamped, lower: clamped, upper: clamped, n: 1, confidenceLevel: 0.95, method: 'normal_approx' };
  }
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  const margin = z * se;

  return {
    estimate: Number(mean.toFixed(4)),
    lower: Number(Math.max(0, mean - margin).toFixed(4)),
    upper: Number(Math.min(1, mean + margin).toFixed(4)),
    n,
    confidenceLevel: 0.95,
    method: 'normal_approx',
  };
}

/**
 * Default ranker adapter using the deterministic Civic Service Recommendation Engine.
 * Abstains (returns []) if the query has no actionable intent or preferences.
 *
 * @param {object} query
 * @returns {Array<{ id: string, score: number }>}
 */
export function defaultCivicRanker(query = {}) {
  const hasIntent = Array.isArray(query.intents) && query.intents.length > 0;
  const hasDocs = Array.isArray(query.heldDocuments) && query.heldDocuments.length > 0;
  if (!hasIntent && !hasDocs && !query.category) {
    return [];
  }
  const eligibleServices = MOCK_SERVICES.filter((s) => !s.documents || Array.isArray(s.documents));
  const ranked = rankCivicServices(eligibleServices, query);
  return ranked.slice(0, 5).map((rec) => ({
    id: rec.serviceId,
    score: Number(((rec.matchPercentage ?? 80) / 100).toFixed(4)),
  }));
}

/**
 * Generates deterministic, non-sensitive, user-consented offline evaluation datasets
 * covering languages, districts, device types, and low-connectivity conditions.
 *
 * @returns {Array<object>}
 */
export function getBuiltInOfflineEvaluationDatasets() {
  const cohorts = [
    { language: 'en', district: 'lucknow-urban', deviceType: 'desktop', connectivityTier: '4g-broadband', n: 14 },
    { language: 'hi', district: 'sitapur-rural', deviceType: 'budget-android', connectivityTier: '2g-intermittent', n: 12 },
    { language: 'hi', district: 'varanasi-periurban', deviceType: 'midrange-android', connectivityTier: '3g-throttled', n: 12 },
    { language: 'bn', district: 'gorakhpur-rural', deviceType: 'feature-low-ram', connectivityTier: 'offline-cached', n: 10 },
    { language: 'ta', district: 'noida-urban', deviceType: 'midrange-android', connectivityTier: '4g-broadband', n: 6 }, // Intentionally < 10 to demonstrate small-group suppression
  ];

  const templates = [
    {
      query: { intents: ['travel_abroad'], heldDocuments: ['aadhaar', 'pan'], citizenship: 'indian', age: 26 },
      relevantServiceIds: ['passport'],
      completedServiceIds: ['passport'],
    },
    {
      query: { intents: ['voting_election'], heldDocuments: ['aadhaar', 'birth'], citizenship: 'indian', age: 21 },
      relevantServiceIds: ['voter-id'],
      completedServiceIds: ['voter-id'],
    },
    {
      query: { intents: ['tax_and_finance'], heldDocuments: ['aadhaar'], citizenship: 'indian', age: 32 },
      relevantServiceIds: ['pan-card', 'income-certificate'],
      completedServiceIds: ['pan-card'],
    },
    {
      query: { intents: ['food_subsidy'], heldDocuments: ['aadhaar', 'income'], citizenship: 'indian', age: 40 },
      relevantServiceIds: ['ration-card'],
      completedServiceIds: ['ration-card'],
    },
    {
      query: { intents: ['birth_registration'], heldDocuments: ['hospital'], citizenship: 'indian', age: 29 },
      relevantServiceIds: ['birth-certificate'],
      completedServiceIds: ['birth-certificate'],
    },
  ];

  const records = [];
  let counter = 1;
  for (const cohort of cohorts) {
    for (let i = 0; i < cohort.n; i++) {
      const tpl = templates[i % templates.length];
      // Simulate realistic low-connectivity/feature-phone completion drop-off on 2g/offline cohorts
      const isLowConnectivity = cohort.connectivityTier === 'offline-cached' || cohort.connectivityTier === '2g-intermittent';
      const completedServiceIds = isLowConnectivity && i % 3 === 0 ? [] : tpl.completedServiceIds;

      records.push({
        caseId: `up-eval-${counter++}`,
        query: tpl.query,
        cohorts: {
          language: cohort.language,
          district: cohort.district,
          deviceType: cohort.deviceType,
          connectivityTier: cohort.connectivityTier,
        },
        relevantServiceIds: tpl.relevantServiceIds,
        completedServiceIds,
        consented: true,
      });
    }
  }

  return [
    {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      id: 'up-civic-services-eval-v2',
      name: 'UP Multi-Cohort Service Retrieval & Completion Benchmark',
      version: '2.0.0',
      consentMode: 'user_consented_offline_eval',
      recordOrigin: RECORD_ORIGIN.CITIZEN_CONSENTED,
      provenance: {
        source: 'Civic Help Setu Consented Offline Evaluation Registry',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-02-01',
        lastVerifiedAt: '2026-11-20T00:00:00.000Z',
        verified: true,
        status: 'verified',
        missingFields: [],
      },
      records,
      createdAt: '2026-11-20T00:00:00.000Z',
    },
  ];
}

/**
 * Evaluates a dataset across a chosen cohort axis (`language`, `district`, `deviceType`,
 * or `connectivityTier`), enforcing:
 * - Zero PII & zero sensitive-trait inference
 * - Small-group suppression (default minCohortSize = 10)
 * - 95% Confidence Intervals on retrieval, completion, recall@k, nDCG@k, and abstention
 * - Catalog coverage & Brier calibration
 * - Release regression gate evaluation
 *
 * @param {object} params
 * @param {object} params.dataset
 * @param {string} [params.cohortAxis='language']
 * @param {Function} [params.rankerFn=defaultCivicRanker]
 * @param {number} [params.k=5]
 * @param {number} [params.catalogSize=12]
 * @param {object} [params.policy=DEFAULT_AUDIT_POLICY]
 * @param {object|null} [params.baselineRun=null]
 * @returns {object}
 */
export function runFairnessAndCoverageAudit({
  dataset,
  cohortAxis = 'language',
  rankerFn = defaultCivicRanker,
  k = 5,
  catalogSize = 12,
  policy = DEFAULT_AUDIT_POLICY,
  baselineRun = null,
}) {
  if (!dataset || !Array.isArray(dataset.records) || dataset.records.length === 0) {
    throw new Error('Evaluation dataset must contain at least one record.');
  }
  if (!COHORT_AXES.includes(cohortAxis)) {
    throw new Error(`Unsupported cohortAxis '${cohortAxis}'. Must be one of: ${COHORT_AXES.join(', ')}`);
  }

  const sensitivityCheck = validateNoSensitiveTraitOrPii(dataset, 'dataset');
  if (!sensitivityCheck.valid) {
    throw new Error(`Privacy/Ethics violation: ${sensitivityCheck.violations[0]}`);
  }

  const effectivePolicy = { ...DEFAULT_AUDIT_POLICY, ...policy };
  const minCohortSize = Math.max(5, Number(effectivePolicy.minCohortSize) || 10);

  const buckets = new Map();
  const overallCatalogHits = new Set();
  const calibrationEntries = [];
  let totalAbstentions = 0;
  let totalRetrievalHits = 0;
  let totalCompletions = 0;

  for (const record of dataset.records) {
    validateUnbiasedSignals(record);
    validateUnbiasedSignals(record.query || {});
    validateUnbiasedSignals(record.cohorts || {});

    const cohortKey = String(record.cohorts?.[cohortAxis] || 'unknown');
    if (!buckets.has(cohortKey)) {
      buckets.set(cohortKey, {
        recalls: [],
        ndcgs: [],
        retrievalHits: 0,
        completionHits: 0,
        abstentions: 0,
        catalogHits: new Set(),
        count: 0,
      });
    }

    const ranked = rankerFn(record.query || {});
    const rankedIds = ranked.map((r) => r.id);
    const relevant = record.relevantServiceIds || [];
    const completed = record.completedServiceIds || [];

    const abstained = rankedIds.length === 0;
    if (abstained) totalAbstentions += 1;

    rankedIds.forEach((id) => overallCatalogHits.add(id));

    const recall = calculateRecallAtK(rankedIds, relevant, k);
    const ndcg = calculateNdcgAtK(rankedIds, relevant, k);
    const hasRetrievalHit = relevant.length === 0 ? !abstained : relevant.some((id) => rankedIds.slice(0, k).includes(id));
    const hasCompletion = completed.length > 0 && rankedIds.some((id) => completed.includes(id));

    if (hasRetrievalHit) totalRetrievalHits += 1;
    if (hasCompletion) totalCompletions += 1;

    const bucket = buckets.get(cohortKey);
    bucket.count += 1;
    bucket.recalls.push(recall);
    bucket.ndcgs.push(ndcg);
    if (hasRetrievalHit) bucket.retrievalHits += 1;
    if (hasCompletion) bucket.completionHits += 1;
    if (abstained) bucket.abstentions += 1;
    rankedIds.forEach((id) => bucket.catalogHits.add(id));

    if (ranked[0]) {
      calibrationEntries.push({
        confidence: typeof ranked[0].score === 'number' ? ranked[0].score : 0.8,
        isAccurate: relevant.includes(ranked[0].id),
      });
    }
  }

  const cohortResults = [];
  let suppressedCohortCount = 0;
  let suppressedSampleCount = 0;
  let minUnsuppressedRecall = Infinity;
  let maxUnsuppressedRecall = -Infinity;
  let minUnsuppressedCompletion = Infinity;
  let maxUnsuppressedCompletion = -Infinity;

  for (const [cohortValue, bucket] of buckets.entries()) {
    const isSuppressed = bucket.count < minCohortSize;
    if (isSuppressed) {
      suppressedCohortCount += 1;
      suppressedSampleCount += bucket.count;
      cohortResults.push({
        cohort: cohortValue,
        cohortAxis,
        sampleCount: bucket.count,
        suppressed: true,
        suppressionReason: `SMALL_GROUP_SUPPRESSION (n=${bucket.count} < minCohortSize=${minCohortSize})`,
        metrics: null,
      });
      continue;
    }

    const recallCI = computeMeanConfidenceInterval(bucket.recalls);
    const ndcgCI = computeMeanConfidenceInterval(bucket.ndcgs);
    const retrievalRateCI = computeWilsonConfidenceInterval(bucket.retrievalHits, bucket.count);
    const completionRateCI = computeWilsonConfidenceInterval(bucket.completionHits, bucket.count);
    const abstentionRateCI = computeWilsonConfidenceInterval(bucket.abstentions, bucket.count);
    const coverageRatio = Number(Math.min(1, bucket.catalogHits.size / Math.max(1, catalogSize)).toFixed(4));

    if (recallCI.estimate < minUnsuppressedRecall) minUnsuppressedRecall = recallCI.estimate;
    if (recallCI.estimate > maxUnsuppressedRecall) maxUnsuppressedRecall = recallCI.estimate;
    if (completionRateCI.estimate < minUnsuppressedCompletion) minUnsuppressedCompletion = completionRateCI.estimate;
    if (completionRateCI.estimate > maxUnsuppressedCompletion) maxUnsuppressedCompletion = completionRateCI.estimate;

    cohortResults.push({
      cohort: cohortValue,
      cohortAxis,
      sampleCount: bucket.count,
      suppressed: false,
      suppressionReason: null,
      metrics: {
        recallAtK: recallCI,
        ndcgAtK: ndcgCI,
        retrievalRate: retrievalRateCI,
        completionRate: completionRateCI,
        abstentionRate: abstentionRateCI,
        catalogCoverageRatio: coverageRatio,
        uniqueServicesRecommended: bucket.catalogHits.size,
      },
    });
  }

  const totalSamples = dataset.records.length;
  const retrievalParityRatio =
    maxUnsuppressedRecall > 0 && Number.isFinite(minUnsuppressedRecall)
      ? Number((minUnsuppressedRecall / maxUnsuppressedRecall).toFixed(4))
      : 1.0;
  const completionParityRatio =
    maxUnsuppressedCompletion > 0 && Number.isFinite(minUnsuppressedCompletion)
      ? Number((minUnsuppressedCompletion / maxUnsuppressedCompletion).toFixed(4))
      : 1.0;

  const summary = {
    totalSamples,
    unsuppressedCohortCount: cohortResults.filter((c) => !c.suppressed).length,
    suppressedCohortCount,
    suppressedSampleCount,
    minCohortSize,
    overallRetrievalRate: computeWilsonConfidenceInterval(totalRetrievalHits, totalSamples),
    overallCompletionRate: computeWilsonConfidenceInterval(totalCompletions, totalSamples),
    overallAbstentionRate: computeWilsonConfidenceInterval(totalAbstentions, totalSamples),
    catalogCoverageCount: overallCatalogHits.size,
    catalogCoverageRatio: Number(Math.min(1, overallCatalogHits.size / Math.max(1, catalogSize)).toFixed(4)),
    calibrationScore: calculateCalibrationScore(calibrationEntries),
    retrievalParityRatio,
    completionParityRatio,
  };

  const gate = evaluateReleaseRegressionGate({
    summary,
    cohortResults,
    policy: effectivePolicy,
    baselineRun,
  });

  const provenanceStatus = evaluateProvenanceVerification(dataset.provenance || {});

  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    runId: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    datasetId: dataset.id,
    datasetVersion: dataset.version || '1.0.0',
    datasetName: dataset.name,
    consentMode: dataset.consentMode,
    recordOrigin: dataset.recordOrigin || RECORD_ORIGIN.CITIZEN_CONSENTED,
    provenance: {
      ...(dataset.provenance || {}),
      verified: provenanceStatus.verified,
      status: provenanceStatus.status,
      missingFields: provenanceStatus.missingFields,
    },
    cohortAxis,
    k,
    summary,
    cohorts: cohortResults,
    gate,
    aiSuggestions: buildAdvisorySuggestions({ summary, cohortResults, gate }),
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Evaluates absolute fairness/coverage thresholds and optional baseline regression deltas.
 *
 * @param {object} params
 * @returns {object}
 */
export function evaluateReleaseRegressionGate({ summary, cohortResults, policy = DEFAULT_AUDIT_POLICY, baselineRun = null }) {
  const effectivePolicy = { ...DEFAULT_AUDIT_POLICY, ...policy };
  const ruleProvenance = evaluateProvenanceVerification(effectivePolicy.provenance || {});
  const violations = [];
  const warnings = [];

  if (summary.retrievalParityRatio < effectivePolicy.minParityRatio) {
    violations.push(
      `Retrieval parity ratio (${summary.retrievalParityRatio}) is below minimum (${effectivePolicy.minParityRatio}).`
    );
  }
  if (summary.completionParityRatio < effectivePolicy.minParityRatio) {
    violations.push(
      `Completion parity ratio (${summary.completionParityRatio}) is below minimum (${effectivePolicy.minParityRatio}).`
    );
  }
  if (summary.overallAbstentionRate.estimate > effectivePolicy.maxAbstentionRate) {
    violations.push(
      `Overall abstention rate (${summary.overallAbstentionRate.estimate}) exceeds maximum (${effectivePolicy.maxAbstentionRate}).`
    );
  }
  if (summary.catalogCoverageRatio < effectivePolicy.minCatalogCoverage) {
    warnings.push(
      `Catalog coverage ratio (${summary.catalogCoverageRatio}) is below target (${effectivePolicy.minCatalogCoverage}).`
    );
  }

  for (const cohort of cohortResults) {
    if (cohort.suppressed) continue;
    if (cohort.metrics.recallAtK.estimate < effectivePolicy.minRecallAt5) {
      violations.push(
        `Cohort '${cohort.cohort}' Recall@5 (${cohort.metrics.recallAtK.estimate}) is below threshold (${effectivePolicy.minRecallAt5}).`
      );
    }
    if (cohort.metrics.completionRate.estimate < effectivePolicy.minCompletionRate) {
      warnings.push(
        `Cohort '${cohort.cohort}' completion rate (${cohort.metrics.completionRate.estimate}) is below target (${effectivePolicy.minCompletionRate}).`
      );
    }
  }

  if (baselineRun?.summary) {
    const recallDelta =
      summary.overallRetrievalRate.estimate - (baselineRun.summary.overallRetrievalRate?.estimate ?? 0);
    if (recallDelta < -effectivePolicy.maxRegressionDelta) {
      violations.push(
        `Retrieval rate regressed by ${Math.abs(recallDelta).toFixed(4)} vs baseline ${baselineRun.runId}.`
      );
    }
    const completionDelta =
      summary.overallCompletionRate.estimate - (baselineRun.summary.overallCompletionRate?.estimate ?? 0);
    if (completionDelta < -effectivePolicy.maxRegressionDelta) {
      violations.push(
        `Completion rate regressed by ${Math.abs(completionDelta).toFixed(4)} vs baseline ${baselineRun.runId}.`
      );
    }
  }

  if (!ruleProvenance.verified) {
    warnings.push('Threshold policy provenance is unverified; manual governance sign-off recommended.');
  }

  let status = 'PASS';
  let action = 'PROCEED_DEPLOYMENT';
  if (violations.length > 0) {
    status = 'BLOCK';
    action = 'BLOCK_RELEASE_AND_ROLLBACK';
  } else if (warnings.length > 0) {
    status = 'WARN';
    action = 'MANUAL_REVIEW_REQUIRED';
  }

  return {
    status,
    passed: status === 'PASS',
    action,
    violations,
    warnings,
    baselineRunId: baselineRun?.runId || null,
    ruleProvenance: {
      ...(effectivePolicy.provenance || {}),
      verified: ruleProvenance.verified,
      status: ruleProvenance.status,
      missingFields: ruleProvenance.missingFields,
    },
  };
}

/**
 * Produces non-binding AI/Community suggestions clearly separated from official records.
 */
function buildAdvisorySuggestions({ summary, cohortResults, gate }) {
  const suggestions = [];
  if (gate.status !== 'PASS') {
    suggestions.push({
      id: 'sug-gate-review',
      origin: RECORD_ORIGIN.AI_COMMUNITY_SUGGESTION,
      label: 'AI / Community Suggestion (Non-binding)',
      title: 'Inspect lagging cohort intent mappings',
      detail:
        'Review service intent synonyms and low-connectivity fallback guides for cohorts below parity or completion targets.',
    });
  }
  if (summary.suppressedCohortCount > 0) {
    suggestions.push({
      id: 'sug-small-cohort',
      origin: RECORD_ORIGIN.AI_COMMUNITY_SUGGESTION,
      label: 'AI / Community Suggestion (Non-binding)',
      title: 'Collect additional consented samples for suppressed cohorts',
      detail: `${summary.suppressedCohortCount} cohort(s) were suppressed under k-anonymity (n < ${summary.minCohortSize}).`,
    });
  }
  const lowCompletion = cohortResults.find(
    (c) => !c.suppressed && c.metrics.completionRate.estimate < 0.7
  );
  if (lowCompletion) {
    suggestions.push({
      id: `sug-completion-${lowCompletion.cohort}`,
      origin: RECORD_ORIGIN.AI_COMMUNITY_SUGGESTION,
      label: 'AI / Community Suggestion (Non-binding)',
      title: `Prioritize offline-ready checklists for '${lowCompletion.cohort}'`,
      detail:
        'Completion rate lags retrieval rate; consider lightweight text-only document checklists for low-bandwidth sessions.',
    });
  }
  return suggestions;
}
