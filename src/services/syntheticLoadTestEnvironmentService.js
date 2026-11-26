import crypto from 'node:crypto';

/**
 * Synthetic Load Profile Types
 */
export const LOAD_PROFILE = Object.freeze({
  BASELINE: 'BASELINE',
  SPIKE: 'SPIKE',
  SOAK: 'SOAK',
  STRESS: 'STRESS'
});

/**
 * Continuous Load-Test Environment and Synthetic Data Generation Service
 */
export class SyntheticLoadTestEnvironmentService {
  constructor(config = {}) {
    this.jurisdictions = config.jurisdictions || ['DL', 'MH', 'KA', 'UP', 'TN'];
    this.serviceTypes = config.serviceTypes || ['RATION_CARD', 'BIRTH_CERTIFICATE', 'INCOME_CERTIFICATE', 'PENSION'];
    this.hotKeyDistribution = config.hotKeyDistribution || 0.7; // 70% traffic to top 20% records
  }

  generateSyntheticCitizenRecord(index = 0) {
    const salt = crypto.randomBytes(4).toString('hex');
    const jurisdiction = this.jurisdictions[index % this.jurisdictions.length];
    const serviceType = this.serviceTypes[index % this.serviceTypes.length];
    
    // Privacy-preserving pseudonymized attributes
    const syntheticId = `SYN-CIT-${crypto.createHash('sha256').update(`${index}-${salt}`).digest('hex').substring(0, 12)}`;
    
    return {
      syntheticId,
      jurisdiction,
      serviceType,
      incomeTier: (index % 5) + 1,
      applicationStatus: index % 2 === 0 ? 'SUBMITTED' : 'IN_REVIEW',
      payloadSizeKb: Math.floor(Math.random() * 50) + 10,
      createdAt: new Date().toISOString()
    };
  }

  generateSyntheticDataset(count = 100) {
    const records = [];
    for (let i = 0; i < count; i++) {
      records.push(this.generateSyntheticCitizenRecord(i));
    }
    return records;
  }

  createLoadScenario(profile = LOAD_PROFILE.BASELINE, durationSeconds = 60) {
    let targetRps = 50;
    let errorBudgetMultiplier = 1.0;

    switch (profile) {
      case LOAD_PROFILE.SPIKE:
        targetRps = 350;
        errorBudgetMultiplier = 1.5;
        break;
      case LOAD_PROFILE.SOAK:
        targetRps = 100;
        durationSeconds = Math.max(durationSeconds, 300);
        break;
      case LOAD_PROFILE.STRESS:
        targetRps = 500;
        break;
      default:
        targetRps = 50;
    }

    return {
      scenarioId: `SCN-${crypto.randomBytes(4).toString('hex')}`,
      profile,
      durationSeconds,
      targetRps,
      totalRequestsEstimate: targetRps * durationSeconds,
      hotKeyRatio: this.hotKeyDistribution,
      tolerableP99LatencyMs: profile === LOAD_PROFILE.SPIKE ? 800 : 400,
      maxAllowedErrorRatePercent: 0.5 * errorBudgetMultiplier
    };
  }

  simulateRun(scenario, sampleResults = []) {
    const totalSamples = sampleResults.length || 100;
    const latencies = sampleResults.map(s => s.latencyMs || Math.floor(Math.random() * 200) + 50).sort((a, b) => a - b);
    const p95Index = Math.floor(totalSamples * 0.95);
    const p99Index = Math.floor(totalSamples * 0.99);

    const p95Latency = latencies[p95Index] || 150;
    const p99Latency = latencies[p99Index] || 250;
    const failedCount = sampleResults.filter(s => s.error).length;
    const errorRatePercent = (failedCount / totalSamples) * 100;

    const meetsSlo = p99Latency <= scenario.tolerableP99LatencyMs && errorRatePercent <= scenario.maxAllowedErrorRatePercent;

    return {
      scenarioId: scenario.scenarioId,
      profile: scenario.profile,
      totalRequests: totalSamples,
      p95LatencyMs: p95Latency,
      p99LatencyMs: p99Latency,
      errorRatePercent,
      meetsSlo,
      status: meetsSlo ? 'PASSED' : 'SLO_VIOLATION'
    };
  }
}
