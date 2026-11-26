/**
 * Critical Citizen Features & Standard SLO Targets
 */
export const CRITICAL_FEATURE = Object.freeze({
  CIVIC_SEARCH: 'CIVIC_SEARCH',
  SERVICE_DISCOVERY: 'SERVICE_DISCOVERY',
  BENEFIT_ELIGIBILITY: 'BENEFIT_ELIGIBILITY',
  DOCUMENT_PREPARATION: 'DOCUMENT_PREPARATION',
  GRIEVANCE_SUBMISSION: 'GRIEVANCE_SUBMISSION'
});

export const SLO_TIER = Object.freeze({
  TIER_1_CRITICAL: { targetAvailabilityPercent: 99.9, targetP95LatencyMs: 300 },
  TIER_2_STANDARD: { targetAvailabilityPercent: 99.5, targetP95LatencyMs: 600 }
});

/**
 * Feature-Level Availability SLO Dashboard Service
 */
export class FeatureAvailabilitySloService {
  constructor() {
    this.telemetryRecords = [];
    this.featureTiers = new Map([
      [CRITICAL_FEATURE.CIVIC_SEARCH, SLO_TIER.TIER_1_CRITICAL],
      [CRITICAL_FEATURE.SERVICE_DISCOVERY, SLO_TIER.TIER_1_CRITICAL],
      [CRITICAL_FEATURE.BENEFIT_ELIGIBILITY, SLO_TIER.TIER_1_CRITICAL],
      [CRITICAL_FEATURE.DOCUMENT_PREPARATION, SLO_TIER.TIER_2_STANDARD],
      [CRITICAL_FEATURE.GRIEVANCE_SUBMISSION, SLO_TIER.TIER_1_CRITICAL]
    ]);
  }

  recordEvent(feature, isSuccessful, latencyMs) {
    this.telemetryRecords.push({
      feature,
      isSuccessful: Boolean(isSuccessful),
      latencyMs: Number(latencyMs) || 0,
      timestamp: Date.now()
    });
  }

  computeFeatureSloMetrics(feature, windowMinutes = 60) {
    const cutoff = Date.now() - (windowMinutes * 60 * 1000);
    const events = this.telemetryRecords.filter(r => r.feature === feature && r.timestamp >= cutoff);

    if (events.length === 0) {
      return {
        feature,
        totalEvents: 0,
        availabilityPercent: 100.0,
        p95LatencyMs: 0,
        meetsAvailabilitySlo: true,
        meetsLatencySlo: true,
        errorBudgetRemainingPercent: 100.0
      };
    }

    const successfulEvents = events.filter(e => e.isSuccessful);
    const availabilityPercent = (successfulEvents.length / events.length) * 100;

    const latencies = events.map(e => e.latencyMs).sort((a, b) => a - b);
    const p95Idx = Math.floor(events.length * 0.95);
    const p95LatencyMs = latencies[p95Idx] ?? latencies[latencies.length - 1];

    const targets = this.featureTiers.get(feature) || SLO_TIER.TIER_2_STANDARD;
    const allowedErrorBudgetPercent = 100 - targets.targetAvailabilityPercent;
    const observedErrorPercent = 100 - availabilityPercent;
    const errorBudgetBurnedRatio = observedErrorPercent / (allowedErrorBudgetPercent || 0.001);
    const errorBudgetRemainingPercent = Math.max(0, (1 - errorBudgetBurnedRatio) * 100);

    return {
      feature,
      totalEvents: events.length,
      availabilityPercent: Number(availabilityPercent.toFixed(3)),
      p95LatencyMs,
      targetAvailabilityPercent: targets.targetAvailabilityPercent,
      targetP95LatencyMs: targets.targetP95LatencyMs,
      meetsAvailabilitySlo: availabilityPercent >= targets.targetAvailabilityPercent,
      meetsLatencySlo: p95LatencyMs <= targets.targetP95LatencyMs,
      errorBudgetRemainingPercent: Number(errorBudgetRemainingPercent.toFixed(2))
    };
  }

  generateDashboardSummary(windowMinutes = 60) {
    const features = Object.values(CRITICAL_FEATURE);
    const summaries = features.map(f => this.computeFeatureSloMetrics(f, windowMinutes));
    
    return {
      generatedAt: new Date().toISOString(),
      windowMinutes,
      allFeaturesCompliant: summaries.every(s => s.meetsAvailabilitySlo && s.meetsLatencySlo),
      features: summaries
    };
  }
}
