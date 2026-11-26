/**
 * Deterministic needs clustering and demand forecasting (#747).
 *
 * Design constraints:
 *  - The ruleset is local and deterministic: no external model is required, so
 *    the feature keeps working during an outage. `buildDeterministicFallback`
 *    is available when a caller explicitly needs the conservative path.
 *  - Every recommendation records the ruleset version, feature window,
 *    execution time, source fields, evidence and freshness.
 *  - Recommendations are advisory. `requiresHumanApproval` is always true.
 *  - Medicine demand is a supply quantity only. The engine never diagnoses,
 *    triages or ranks patients, and never uses inferred sensitive attributes.
 */

import {
  RELIEF_CATEGORIES,
  RELIEF_CATEGORY_LABELS,
  MEDICAL_REVIEW_CATEGORIES,
  URGENCY_LEVELS,
  PRIORITY_TIERS,
  CONFIDENCE_LEVELS,
  RELIEF_FORECAST_MODEL_VERSION,
  RELIEF_FORECAST_RULESET,
  RELIEF_LIMITS,
} from './reliefOperationsConstants';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const FORECAST_INPUT_FIELDS = Object.freeze([
  'category',
  'quantity',
  'fulfilledQuantity',
  'peopleAffected',
  'urgency',
  'status',
  'locality',
  'coordinates',
  'createdAt',
  'updatedAt',
  'verifiedAt',
]);

const CATEGORY_WEIGHT = Object.freeze({
  [RELIEF_CATEGORIES.WATER]: 1.0,
  [RELIEF_CATEGORIES.MEDICINE]: 0.95,
  [RELIEF_CATEGORIES.SHELTER]: 0.9,
  [RELIEF_CATEGORIES.FOOD]: 0.85,
  [RELIEF_CATEGORIES.TRANSPORT]: 0.6,
  [RELIEF_CATEGORIES.SANITATION]: 0.55,
  [RELIEF_CATEGORIES.POWER]: 0.4,
});

const URGENCY_WEIGHT = Object.freeze({
  [URGENCY_LEVELS.IMMEDIATE]: 1.15,
  [URGENCY_LEVELS.HIGH]: 1.05,
  [URGENCY_LEVELS.MODERATE]: 1.0,
  [URGENCY_LEVELS.LOW]: 0.9,
});

const URGENCY_SCORE = Object.freeze({
  [URGENCY_LEVELS.IMMEDIATE]: 25,
  [URGENCY_LEVELS.HIGH]: 18,
  [URGENCY_LEVELS.MODERATE]: 10,
  [URGENCY_LEVELS.LOW]: 4,
});

const OPEN_STATUSES = Object.freeze(['submitted', 'verified', 'triaged']);

/** FNV-1a hash used for stable, non-reversible recommendation identifiers. */
const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const haversineDistanceMeters = (a, b) => {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * earthRadius * Math.asin(Math.sqrt(h)));
};

export const isOpenNeed = (need) => OPEN_STATUSES.includes(need?.status);

export const remainingQuantity = (need) =>
  Math.max(0, Number(need?.quantity || 0) - Number(need?.fulfilledQuantity || 0));

/**
 * A need is stale when it has not been updated inside the freshness window.
 * Stale needs stay in the forecast but lower its confidence and are flagged in
 * the UI, so an operator never sees an unqualified number.
 */
export const isNeedStale = (need, now = Date.now(), freshnessHours = RELIEF_FORECAST_RULESET.freshnessHours) => {
  const updated = Date.parse(need?.updatedAt || need?.createdAt || 0);
  if (Number.isNaN(updated)) return true;
  return now - updated > freshnessHours * HOUR_MS;
};

const pickWeightedUrgency = (needs) => {
  const rank = {
    [URGENCY_LEVELS.IMMEDIATE]: 4,
    [URGENCY_LEVELS.HIGH]: 3,
    [URGENCY_LEVELS.MODERATE]: 2,
    [URGENCY_LEVELS.LOW]: 1,
  };
  return needs.reduce(
    (highest, need) => (rank[need.urgency] > rank[highest] ? need.urgency : highest),
    URGENCY_LEVELS.LOW
  );
};

const priorityTierFor = (score) => {
  if (score >= 80) return PRIORITY_TIERS.CRITICAL;
  if (score >= 60) return PRIORITY_TIERS.HIGH;
  if (score >= 40) return PRIORITY_TIERS.MEDIUM;
  return PRIORITY_TIERS.LOW;
};

const confidenceFor = ({ verifiedCount, reportCount, newestAgeHours, staleCount }) => {
  if (reportCount === 0) return CONFIDENCE_LEVELS.LOW;
  const verificationRatio = verifiedCount / reportCount;
  const fresh = newestAgeHours <= RELIEF_FORECAST_RULESET.freshnessHours && staleCount === 0;
  if (
    fresh &&
    reportCount >= RELIEF_FORECAST_RULESET.minReportsForHighConfidence &&
    verificationRatio >= 0.75
  ) {
    return CONFIDENCE_LEVELS.HIGH;
  }
  if (
    newestAgeHours <= RELIEF_FORECAST_RULESET.freshnessHours * 2 &&
    reportCount >= RELIEF_FORECAST_RULESET.minReportsForMediumConfidence &&
    verificationRatio >= 0.5
  ) {
    return CONFIDENCE_LEVELS.MEDIUM;
  }
  return CONFIDENCE_LEVELS.LOW;
};

/**
 * Groups open needs by jurisdiction + locality + category. Coordinates are
 * averaged into a centroid for display only; the public API never returns
 * individual report coordinates.
 */
export const clusterNeeds = (needs = [], { now = Date.now(), windowDays = RELIEF_FORECAST_RULESET.windowDays } = {}) => {
  const from = now - windowDays * DAY_MS;
  const eligible = needs.filter((need) => {
    if (!isOpenNeed(need) || need.archived) return false;
    const created = Date.parse(need.createdAt || 0);
    const updated = Date.parse(need.updatedAt || need.createdAt || 0);
    return (!Number.isNaN(created) && created >= from) || (!Number.isNaN(updated) && updated >= from);
  });

  const groups = new Map();
  eligible.forEach((need) => {
    const key = [
      (need.jurisdictionId || 'UNKNOWN').toUpperCase(),
      (need.locality || 'Unknown locality').trim(),
      need.category,
    ].join('::');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(need);
  });

  return [...groups.entries()].map(([key, groupedNeeds]) => {
    const [jurisdictionId, locality, category] = key.split('::');
    const withCoords = groupedNeeds.filter((need) => need.coordinates);
    const centroid = withCoords.length
      ? {
          lat: Number(
            (withCoords.reduce((sum, need) => sum + need.coordinates.lat, 0) / withCoords.length).toFixed(6)
          ),
          lng: Number(
            (withCoords.reduce((sum, need) => sum + need.coordinates.lng, 0) / withCoords.length).toFixed(6)
          ),
        }
      : null;
    const spreadMeters = centroid
      ? Math.max(0, ...withCoords.map((need) => haversineDistanceMeters(centroid, need.coordinates)))
      : 0;

    return {
      key,
      jurisdictionId,
      locality,
      category,
      needs: groupedNeeds,
      centroid,
      spreadMeters,
    };
  });
};

const buildRecommendation = (cluster, { now, windowDays, fallbackMode = false }) => {
  const { needs } = cluster;
  const reportCount = needs.length;
  const verifiedNeeds = needs.filter((need) => need.status !== 'submitted');
  const verifiedCount = verifiedNeeds.length;
  const duplicateCount = needs.reduce((sum, need) => sum + (need.duplicateCount || 0), 0);
  const totalPeopleAffected = needs.reduce((sum, need) => sum + Number(need.peopleAffected || 0), 0);
  const totalRemaining = needs.reduce((sum, need) => sum + remainingQuantity(need), 0);
  const urgency = pickWeightedUrgency(needs);

  const ages = needs.map((need) => {
    const updated = Date.parse(need.updatedAt || need.createdAt || 0);
    return Number.isNaN(updated) ? windowDays * 24 : Math.max(0, (now - updated) / HOUR_MS);
  });
  const newestAgeHours = Math.min(...ages, windowDays * 24);
  const staleCount = needs.filter((need) => isNeedStale(need, now)).length;

  const recencyFactors = needs.map((need) => {
    const updated = Date.parse(need.updatedAt || need.createdAt || 0);
    if (Number.isNaN(updated)) return 0.5;
    const ageDays = Math.max(0, (now - updated) / DAY_MS);
    return Math.max(0.5, 1 - ageDays / (windowDays * 2));
  });
  const weightedRemaining = needs.reduce(
    (sum, need, index) =>
      sum +
      remainingQuantity(need) *
        recencyFactors[index] *
        (fallbackMode ? 1 : URGENCY_WEIGHT[need.urgency] || 1),
    0
  );
  const recommendedQuantity = Math.max(
    1,
    Math.min(RELIEF_LIMITS.maxNeedQuantity, Math.ceil(weightedRemaining))
  );

  const verificationRatio = reportCount ? verifiedCount / reportCount : 0;
  const peopleScore = Math.min(20, Math.round(Math.log10(totalPeopleAffected + 1) * 8));
  const recencyScore = newestAgeHours <= 6 ? 10 : newestAgeHours <= 24 ? 6 : newestAgeHours <= 72 ? 3 : 0;
  const rawScore =
    (fallbackMode ? 35 : 30) +
    URGENCY_SCORE[urgency] +
    peopleScore +
    Math.round(verificationRatio * 15) +
    recencyScore +
    (fallbackMode ? 0 : Math.round((CATEGORY_WEIGHT[cluster.category] || 0.5) * 8));
  const priorityScore = Math.max(0, Math.min(100, rawScore));
  const priorityTier = priorityTierFor(priorityScore);
  const confidence = fallbackMode
    ? CONFIDENCE_LEVELS.LOW
    : confidenceFor({ verifiedCount, reportCount, newestAgeHours, staleCount });

  const recommendationId = `REC-${fnv1a(
    [cluster.jurisdictionId, cluster.locality, cluster.category, RELIEF_FORECAST_MODEL_VERSION].join('|')
  ).toUpperCase()}`;

  const requiresMedicalReview = MEDICAL_REVIEW_CATEGORIES.includes(cluster.category);

  return {
    recommendationId,
    clusterKey: cluster.key,
    jurisdictionId: cluster.jurisdictionId,
    locality: cluster.locality,
    category: cluster.category,
    categoryLabel: RELIEF_CATEGORY_LABELS[cluster.category] || cluster.category,
    recommendedQuantity,
    requestedRemainingQuantity: totalRemaining,
    peopleAffected: totalPeopleAffected,
    priorityScore,
    priorityTier,
    urgency,
    confidence,
    confidenceReason:
      confidence === CONFIDENCE_LEVELS.HIGH
        ? 'Multiple recent verified reports with consistent locality and category.'
        : confidence === CONFIDENCE_LEVELS.MEDIUM
          ? 'At least two recent reports, but verification or freshness is incomplete.'
          : 'Few, unverified, or stale reports; treat as an indicative estimate only.',
    evidence: {
      reportCount,
      verifiedCount,
      submittedCount: reportCount - verifiedCount,
      duplicateReportsMerged: duplicateCount,
      reportIds: needs.map((need) => need.id),
      sourceFields: FORECAST_INPUT_FIELDS,
      newestReportAt: new Date(now - newestAgeHours * HOUR_MS).toISOString(),
      centroid: cluster.centroid,
      spreadMeters: cluster.spreadMeters,
    },
    freshness: {
      evaluatedAt: new Date(now).toISOString(),
      newestReportAgeHours: Math.round(newestAgeHours * 10) / 10,
      staleReportCount: staleCount,
      isStale: staleCount === reportCount || newestAgeHours > RELIEF_FORECAST_RULESET.freshnessHours,
      freshnessLimitHours: RELIEF_FORECAST_RULESET.freshnessHours,
    },
    modelVersion: RELIEF_FORECAST_MODEL_VERSION,
    rulesetVersion: RELIEF_FORECAST_MODEL_VERSION,
    featureWindow: {
      from: new Date(now - windowDays * DAY_MS).toISOString(),
      to: new Date(now).toISOString(),
      days: windowDays,
    },
    executedAt: new Date(now).toISOString(),
    requiresHumanApproval: true,
    requiresMedicalReview,
    triageDecisionMade: false,
    medicalReviewNotice: requiresMedicalReview
      ? 'This is a supply quantity recommendation only. A qualified medical reviewer must decide what care to provide; this system does not triage patients.'
      : null,
    fallbackMode,
    explanation: [
      `${reportCount} open report${reportCount === 1 ? '' : 's'} in ${cluster.locality} for ${RELIEF_CATEGORY_LABELS[cluster.category] || cluster.category}.`,
      `${verifiedCount} report${verifiedCount === 1 ? '' : 's'} verified; ${duplicateCount} duplicate report${duplicateCount === 1 ? '' : 's'} merged.`,
      `Highest reported urgency is ${urgency}.`,
      `${totalPeopleAffected} people reported affected; ${totalRemaining} units remain unfulfilled.`,
      `Quantity applies a recency factor to unfulfilled demand; priority blends urgency, people affected and verification.`,
      `Confidence is ${confidence}: ${'evidence count, verification ratio and freshness are shown above.'}`,
    ],
  };
};

/**
 * Deterministic fallback used when the normal forecast cannot run or a caller
 * explicitly requests the conservative path. It uses simple sums, marks every
 * result low-confidence, and still requires human approval.
 */
export const buildDeterministicFallback = (needs = [], options = {}) => {
  const now = options.now || Date.now();
  const windowDays = options.windowDays || RELIEF_FORECAST_RULESET.windowDays;
  const clusters = clusterNeeds(needs, { now, windowDays });
  return {
    runId: `FRUN-FALLBACK-${fnv1a(`${now}:${needs.length}:${windowDays}`).toUpperCase()}`,
    modelVersion: RELIEF_FORECAST_MODEL_VERSION,
    rulesetVersion: `${RELIEF_FORECAST_MODEL_VERSION}+deterministic-fallback`,
    executedAt: new Date(now).toISOString(),
    featureWindow: {
      from: new Date(now - windowDays * DAY_MS).toISOString(),
      to: new Date(now).toISOString(),
      days: windowDays,
    },
    fallbackMode: true,
    engineAvailable: false,
    recommendations: clusters.map((cluster) =>
      buildRecommendation(cluster, { now, windowDays, fallbackMode: true })
    ),
    limitations: [
      'Fallback mode uses unweighted remaining quantities and marks every recommendation low confidence.',
      'All allocations still require human review and approval.',
      'No medical triage is performed in any mode.',
    ],
  };
};

/**
 * Runs the forecast. Passing `{ fallback: true }` or `{ engineAvailable: false }`
 * takes the deterministic fallback path; no network call is ever made.
 */
export const runNeedsForecast = (needs = [], options = {}) => {
  const now = options.now || Date.now();
  const windowDays = options.windowDays || RELIEF_FORECAST_RULESET.windowDays;
  if (options.fallback || options.engineAvailable === false) {
    return buildDeterministicFallback(needs, { now, windowDays });
  }

  const clusters = clusterNeeds(needs, { now, windowDays });
  const recommendations = clusters.map((cluster) =>
    buildRecommendation(cluster, { now, windowDays })
  );
  recommendations.sort(
    (a, b) =>
      b.priorityScore - a.priorityScore ||
      b.peopleAffected - a.peopleAffected ||
      a.recommendationId.localeCompare(b.recommendationId)
  );

  const newestReportAt = recommendations.reduce((newest, rec) => {
    const time = Date.parse(rec.evidence.newestReportAt);
    return Number.isNaN(time) ? newest : Math.max(newest, time);
  }, 0);

  return {
    runId: `FRUN-${fnv1a(`${now}:${windowDays}:${recommendations.length}`).toUpperCase()}`,
    modelVersion: RELIEF_FORECAST_MODEL_VERSION,
    rulesetVersion: RELIEF_FORECAST_MODEL_VERSION,
    executedAt: new Date(now).toISOString(),
    featureWindow: {
      from: new Date(now - windowDays * DAY_MS).toISOString(),
      to: new Date(now).toISOString(),
      days: windowDays,
    },
    fallbackMode: false,
    engineAvailable: true,
    recommendations,
    dataFreshness: {
      newestReportAt: newestReportAt ? new Date(newestReportAt).toISOString() : null,
      isStale: recommendations.length > 0 && recommendations.every((rec) => rec.freshness.isStale),
      freshnessLimitHours: RELIEF_FORECAST_RULESET.freshnessHours,
    },
    limitations: [
      'The ruleset estimates quantities and priority from reported needs; it does not predict disaster severity.',
      'It is advisory only and cannot approve, reserve or dispatch stock.',
      'Medicine recommendations are quantities, not medical triage or diagnosis.',
      'Sparse or stale reports produce low-confidence results; verify with a field assessment.',
    ],
  };
};

/**
 * Aggregate unmet needs by category and locality for the operator dashboard.
 * Public callers receive a reduced projection from the service layer.
 */
export const summarizeUnmetNeeds = (needs = [], { now = Date.now() } = {}) => {
  const open = needs.filter((need) => isOpenNeed(need) && !need.archived);
  const byCategoryMap = new Map();
  const byLocalityMap = new Map();

  open.forEach((need) => {
    const remaining = remainingQuantity(need);
    const cat = byCategoryMap.get(need.category) || {
      category: need.category,
      categoryLabel: RELIEF_CATEGORY_LABELS[need.category] || need.category,
      reportCount: 0,
      remainingQuantity: 0,
      peopleAffected: 0,
      staleCount: 0,
    };
    cat.reportCount += 1;
    cat.remainingQuantity += remaining;
    cat.peopleAffected += Number(need.peopleAffected || 0);
    if (isNeedStale(need, now)) cat.staleCount += 1;
    byCategoryMap.set(need.category, cat);

    const localityKey = `${(need.jurisdictionId || '').toUpperCase()}::${need.locality}`;
    const loc = byLocalityMap.get(localityKey) || {
      jurisdictionId: need.jurisdictionId,
      locality: need.locality,
      reportCount: 0,
      remainingQuantity: 0,
      peopleAffected: 0,
      categories: {},
      staleCount: 0,
      lastUpdatedAt: null,
    };
    loc.reportCount += 1;
    loc.remainingQuantity += remaining;
    loc.peopleAffected += Number(need.peopleAffected || 0);
    loc.categories[need.category] = (loc.categories[need.category] || 0) + remaining;
    if (isNeedStale(need, now)) loc.staleCount += 1;
    const updated = need.updatedAt || need.createdAt;
    if (updated && (!loc.lastUpdatedAt || Date.parse(updated) > Date.parse(loc.lastUpdatedAt))) {
      loc.lastUpdatedAt = updated;
    }
    byLocalityMap.set(localityKey, loc);
  });

  return {
    totalOpenReports: open.length,
    totalRemainingQuantity: open.reduce((sum, need) => sum + remainingQuantity(need), 0),
    totalPeopleAffected: open.reduce((sum, need) => sum + Number(need.peopleAffected || 0), 0),
    byCategory: [...byCategoryMap.values()].sort((a, b) => b.remainingQuantity - a.remainingQuantity),
    byLocality: [...byLocalityMap.values()].sort(
      (a, b) => b.peopleAffected - a.peopleAffected
    ),
    evaluatedAt: new Date(now).toISOString(),
  };
};
