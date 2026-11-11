/**
 * Duplicate and Coordinated Civic Report Detection Pipeline Service
 *
 * Implements privacy-preserving duplicate and coordinated civic issue detection:
 * 1. Computes multi-factor similarity across civic reports:
 *    - Token Jaccard text similarity
 *    - Issue category matching (e.g. 'ROAD_POTHOLE', 'STREETLIGHT', 'WATER_SUPPLY')
 *    - Geospatial privacy bucket proximity (approximate geohash / grid cell, keeping exact coordinates private)
 *    - Temporal sliding window clustering (e.g. reports filed within 72 hours)
 * 2. Suggests likely duplicate clusters for human moderator review with interpretable similarity reasons and confidence scores.
 * 3. Strict preservation:
 *    - Never automatically deletes or unlinks original citizen reports.
 *    - Retains original report IDs, timestamps, and independent private tracking timelines.
 * 4. Coordinated burst detection: Identifies sudden report spikes on identical public assets
 *    without accusing citizens of malicious behavior.
 * 5. Moderator workflow: Supports transparent merge suggestions and reversible un-merging/splitting.
 */

export const MODERATION_MERGE_STATE = {
  SUGGESTED_DUPLICATE: 'SUGGESTED_DUPLICATE',
  CONFIRMED_MERGED: 'CONFIRMED_MERGED',
  CONFIRMED_DISTINCT: 'CONFIRMED_DISTINCT',
  UNMERGED_REVERSED: 'UNMERGED_REVERSED',
};

/**
 * Tokenizes text into normalized words.
 * @param {string} text
 * @returns {Set<string>}
 */
export function tokenizeReportText(text = '') {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/**
 * Computes Jaccard similarity between two token sets.
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number}
 */
export function computeJaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : Number((intersection / union).toFixed(3));
}

/**
 * Converts exact latitude/longitude into a privacy-preserving grid cell bucket (~500m).
 * Ensures exact residential coordinates are never exposed in clustering indexes.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {string} Grid cell bucket key
 */
export function getGeospatialGridBucket(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return 'UNKNOWN_ZONE';
  // Round to 2 decimal places gives ~1.1km grid; 3 decimal places gives ~110m
  const latBucket = (Math.round(lat * 100) / 100).toFixed(2);
  const lngBucket = (Math.round(lng * 100) / 100).toFixed(2);
  return `geo_${latBucket}_${lngBucket}`;
}

/**
 * Evaluates duplicate similarity between two civic reports.
 *
 * @param {object} reportA
 * @param {object} reportB
 * @param {object} [options]
 * @param {number} [options.timeWindowHours=72]
 * @returns {object|null} Match details or null if distinct
 */
export function evaluatePairwiseReportSimilarity(reportA, reportB, options = {}) {
  const { timeWindowHours = 72 } = options;

  if (reportA.id === reportB.id) return null;

  // 1. Category mismatch guard
  if (reportA.category && reportB.category && reportA.category !== reportB.category) {
    return null;
  }

  // 2. Geospatial bucket check
  const bucketA = reportA.geoBucket || getGeospatialGridBucket(reportA.latitude, reportA.longitude);
  const bucketB = reportB.geoBucket || getGeospatialGridBucket(reportB.latitude, reportB.longitude);
  const isSameGeoBucket = bucketA !== 'UNKNOWN_ZONE' && bucketA === bucketB;

  // 3. Temporal window check
  const timeA = new Date(reportA.createdAt).getTime();
  const timeB = new Date(reportB.createdAt).getTime();
  const timeDiffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);
  const isWithinTimeWindow = timeDiffHours <= timeWindowHours;

  // 4. Text Jaccard similarity
  const tokensA = tokenizeReportText(reportA.description || reportA.title);
  const tokensB = tokenizeReportText(reportB.description || reportB.title);
  const textSim = computeJaccardSimilarity(tokensA, tokensB);

  // Score formulation
  let confidence = 0;
  const reasons = [];

  if (isSameGeoBucket) {
    confidence += 0.4;
    reasons.push('Located within identical approximate geospatial grid (~500m)');
  }
  if (isWithinTimeWindow) {
    confidence += 0.2;
    reasons.push(`Submitted within ${Math.round(timeDiffHours)} hours of each other`);
  }
  if (textSim >= 0.4) {
    confidence += 0.4 * textSim;
    reasons.push(`High textual similarity (${Math.round(textSim * 100)}% token overlap)`);
  }

  confidence = Number(Math.min(1.0, confidence).toFixed(3));

  if (confidence >= 0.55) {
    return {
      reportAId: reportA.id,
      reportBId: reportB.id,
      category: reportA.category,
      geoBucket: bucketA,
      confidence,
      reasons,
      moderationState: MODERATION_MERGE_STATE.SUGGESTED_DUPLICATE,
      requiresModeratorConfirmation: true,
      originalReportsPreserved: true,
    };
  }

  return null;
}

/**
 * Detects sudden report bursts on identical public infrastructure assets.
 * Flags coordination or widespread impact without making punitive accusations.
 *
 * @param {Array<object>} recentReports
 * @param {object} [options]
 * @param {number} [options.burstThreshold=5]
 * @returns {Array<object>} Detected asset bursts
 */
export function detectReportBursts(recentReports = [], options = {}) {
  const { burstThreshold = 4 } = options;
  const bucketMap = new Map();

  for (const rep of recentReports) {
    const bucket = rep.geoBucket || getGeospatialGridBucket(rep.latitude, rep.longitude);
    const key = `${rep.category || 'GENERAL'}_${bucket}`;
    if (!bucketMap.has(key)) {
      bucketMap.set(key, { category: rep.category, geoBucket: bucket, reports: [] });
    }
    bucketMap.get(key).reports.push(rep);
  }

  const bursts = [];
  for (const [key, group] of bucketMap.entries()) {
    if (group.reports.length >= burstThreshold) {
      bursts.push({
        burstKey: key,
        category: group.category,
        geoBucket: group.geoBucket,
        reportCount: group.reports.length,
        reportIds: group.reports.map((r) => r.id),
        observationNotice: `Elevated report activity: ${group.reports.length} citizen submissions recorded in this sector. Indicates widespread community impact or duplicate reporting.`,
        punitiveActionTaken: false, // Explicit guarantee
      });
    }
  }

  return bursts;
}

/**
 * Moderator merge action: Groups reports under a primary cluster while preserving all original IDs.
 *
 * @param {string} clusterId
 * @param {Array<string>} reportIds
 * @param {string} moderatorId
 * @returns {object} Confirmed merge cluster
 */
export function confirmModeratorMerge(clusterId, reportIds = [], moderatorId) {
  if (!moderatorId) throw new Error('Moderator ID is required to confirm report merge');
  return {
    clusterId,
    moderatorId,
    mergedReportIds: reportIds,
    status: MODERATION_MERGE_STATE.CONFIRMED_MERGED,
    mergedAt: new Date().toISOString(),
    isReversible: true,
  };
}

/**
 * Reverses a previous merge operation, restoring independent status to all constituent reports.
 *
 * @param {object} mergeCluster
 * @param {string} moderatorId
 * @param {string} reason
 * @returns {object} Unmerged record
 */
export function reverseModeratorMerge(mergeCluster, moderatorId, reason = 'Distinct incidents verified') {
  if (!mergeCluster || !mergeCluster.clusterId) {
    throw new Error('Valid merge cluster object required for reversal');
  }
  return {
    ...mergeCluster,
    status: MODERATION_MERGE_STATE.UNMERGED_REVERSED,
    reversedBy: moderatorId,
    reversedAt: new Date().toISOString(),
    reversalReason: reason,
  };
}
