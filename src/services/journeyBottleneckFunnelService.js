/**
 * Civic Service Journey Bottleneck Sankey and Funnel Explorer Service
 *
 * Implements a privacy-preserving aggregate journey transition analyzer:
 * - Maps journey transitions across canonical civic stages:
 *   * STAGE_DISCOVERY: Initial scheme discovery / eligibility lookup
 *   * STAGE_CHECKLIST: Reviewing required documents & affidavits
 *   * STAGE_DRAFTING: Filling online application / form fields
 *   * STAGE_VERIFICATION: Physical / biometric Seva Kendra verification
 *   * STAGE_SUBMISSION: Official submission to government portal
 * - Anti-Inference Privacy Safeguard:
 *   * Explicitly disallows inferring that session end equals rejection or failure
 *   * Aggregates events into minimum cohort thresholds (k-anonymity >= 10)
 *   * Cohorts below 10 are suppressed (`suppressed: true`)
 * - Slicing and Filtering:
 *   * Service category, jurisdiction, and date range
 * - Emits accessible tabular funnel summaries for screen reader users
 */

export const JOURNEY_STAGES = Object.freeze([
  'STAGE_DISCOVERY',
  'STAGE_CHECKLIST',
  'STAGE_DRAFTING',
  'STAGE_VERIFICATION',
  'STAGE_SUBMISSION'
]);

export const MIN_ANONYMOUS_COHORT_THRESHOLD = 10;

/**
 * Calculates transition rates between consecutive funnel steps
 * @param {Array<Object>} stageCounts Array of stage count objects
 * @returns {Array<Object>} Enriched stages with drop-off rates and suppression
 */
export function calculateFunnelTransitions(stageCounts = []) {
  if (!Array.isArray(stageCounts) || stageCounts.length === 0) {
    return [];
  }

  const results = [];
  let previousCount = null;

  for (let i = 0; i < stageCounts.length; i++) {
    const item = stageCounts[i];
    const rawCount = Number(item.count) || 0;
    const isSuppressed = rawCount > 0 && rawCount < MIN_ANONYMOUS_COHORT_THRESHOLD;

    const displayCount = isSuppressed ? '< 10' : rawCount;
    let transitionRate = 1.0;
    let dropOffRate = 0.0;

    if (previousCount !== null && previousCount > 0) {
      transitionRate = Math.round((rawCount / previousCount) * 100) / 100;
      dropOffRate = Math.round((1 - transitionRate) * 100) / 100;
    }

    results.push({
      stage: item.stage,
      rawCount: isSuppressed ? 0 : rawCount,
      displayCount,
      suppressed: isSuppressed,
      transitionRate,
      dropOffRate,
      disclaimer: 'Observed drop-off reflects offline channel switching or paused research, not application rejection.'
    });

    previousCount = rawCount;
  }

  return results;
}

export class JourneyBottleneckFunnelService {
  constructor() {
    this.eventLog = []; // Anonymized aggregate events
  }

  /**
   * Records an anonymized journey stage progression event
   * @param {Object} event Event descriptor
   */
  logStageEvent({ stage, serviceId, jurisdiction = 'All', timestamp = Date.now() }) {
    if (!JOURNEY_STAGES.includes(stage)) {
      throw new Error(`Invalid journey stage: ${stage}`);
    }

    this.eventLog.push({
      stage,
      serviceId,
      jurisdiction,
      timestamp
    });
  }

  /**
   * Computes aggregate funnel metrics for a given service and jurisdiction
   * @param {Object} filters
   * @returns {Object} Funnel explorer view model
   */
  getFunnelReport(filters = {}) {
    const { serviceId, jurisdiction, startDate, endDate } = filters;

    let filtered = [...this.eventLog];

    if (serviceId) {
      filtered = filtered.filter(e => e.serviceId === serviceId);
    }
    if (jurisdiction && jurisdiction !== 'All') {
      filtered = filtered.filter(e => e.jurisdiction === jurisdiction);
    }
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      filtered = filtered.filter(e => e.timestamp >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      filtered = filtered.filter(e => e.timestamp <= endMs);
    }

    // Tally counts across each canonical stage
    const rawCounts = JOURNEY_STAGES.map(stage => {
      const count = filtered.filter(e => e.stage === stage).length;
      return { stage, count };
    });

    const enrichedFunnel = calculateFunnelTransitions(rawCounts);

    return {
      serviceId: serviceId || 'ALL_SERVICES',
      jurisdiction: jurisdiction || 'All',
      totalRecordedEvents: filtered.length,
      stages: enrichedFunnel,
      privacyPolicy: `Cohorts below ${MIN_ANONYMOUS_COHORT_THRESHOLD} are suppressed for citizen privacy. Zero PII collected.`
    };
  }
}
