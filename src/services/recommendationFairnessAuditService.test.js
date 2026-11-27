import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUDIT_POLICY,
  evaluateProvenanceVerification,
  migrateAuditStoreState,
  validateNoSensitiveTraitOrPii,
  validateOfflineEvalDataset,
} from './recommendationFairnessAuditContract.js';
import {
  computeMeanConfidenceInterval,
  computeWilsonConfidenceInterval,
  getBuiltInOfflineEvaluationDatasets,
  runFairnessAndCoverageAudit,
} from './recommendationFairnessAuditService.js';

describe('Recommendation Fairness & Coverage Audit Suite (#1449)', () => {
  it('computes bounded Wilson 95% confidence intervals for proportions', () => {
    const ci = computeWilsonConfidenceInterval(8, 10);
    expect(ci.estimate).toBe(0.8);
    expect(ci.lower).toBeGreaterThan(0.45);
    expect(ci.upper).toBeLessThanOrEqual(1);
    expect(ci.method).toBe('wilson');

    const zero = computeWilsonConfidenceInterval(0, 0);
    expect(zero.estimate).toBe(0);
    expect(zero.lower).toBe(0);
    expect(zero.upper).toBe(0);
  });

  it('computes bounded 95% confidence intervals for continuous metrics', () => {
    const ci = computeMeanConfidenceInterval([0.8, 0.9, 0.7, 1.0, 0.85]);
    expect(ci.estimate).toBe(0.85);
    expect(ci.lower).toBeGreaterThan(0.6);
    expect(ci.upper).toBeLessThanOrEqual(1);
  });

  it('enforces small-group suppression for cohorts below minCohortSize', () => {
    const [dataset] = getBuiltInOfflineEvaluationDatasets();
    const audit = runFairnessAndCoverageAudit({
      dataset,
      cohortAxis: 'language',
      policy: { ...DEFAULT_AUDIT_POLICY, minCohortSize: 10 },
    });

    const tamilCohort = audit.cohorts.find((c) => c.cohort === 'ta');
    expect(tamilCohort).toBeDefined();
    expect(tamilCohort.sampleCount).toBe(6);
    expect(tamilCohort.suppressed).toBe(true);
    expect(tamilCohort.metrics).toBeNull();
    expect(audit.summary.suppressedCohortCount).toBe(1);
    expect(audit.summary.suppressedSampleCount).toBe(6);

    const hindiCohort = audit.cohorts.find((c) => c.cohort === 'hi');
    expect(hindiCohort.suppressed).toBe(false);
    expect(hindiCohort.metrics.retrievalRate.n).toBe(24);
    expect(hindiCohort.metrics.completionRate.lower).toBeLessThanOrEqual(
      hindiCohort.metrics.completionRate.estimate
    );
  });

  it('rejects sensitive-trait inference, protected attributes, and PII', () => {
    const withCaste = validateNoSensitiveTraitOrPii({
      cohorts: { language: 'hi', inferred_caste: 'general' },
    });
    expect(withCaste.valid).toBe(false);

    const withAadhaar = validateNoSensitiveTraitOrPii({
      note: 'Citizen Aadhaar 2345 6789 0123',
    });
    expect(withAadhaar.valid).toBe(false);

    const clean = validateNoSensitiveTraitOrPii({
      cohorts: { language: 'hi', district: 'sitapur-rural', deviceType: 'budget-android', connectivityTier: '2g-intermittent' },
    });
    expect(clean.valid).toBe(true);
  });

  it('marks incomplete official provenance as unverified', () => {
    const incomplete = evaluateProvenanceVerification({ source: 'Local draft' });
    expect(incomplete.verified).toBe(false);
    expect(incomplete.status).toBe('unverified');
    expect(incomplete.missingFields).toContain('jurisdiction');
    expect(incomplete.missingFields).toContain('effectiveDate');

    const complete = evaluateProvenanceVerification(DEFAULT_AUDIT_POLICY.provenance);
    expect(complete.verified).toBe(true);
    expect(complete.status).toBe('verified');
  });

  it('validates offline evaluation dataset consent and provenance', () => {
    const bad = validateOfflineEvalDataset({
      id: 'bad-ds',
      name: 'Bad Dataset',
      consentMode: 'user_consented_offline_eval',
      records: [
        {
          query: { intents: ['travel_abroad'] },
          cohorts: { language: 'en' },
          relevantServiceIds: ['passport'],
          consented: false,
        },
      ],
    });
    expect(bad.valid).toBe(false);
  });

  it('blocks release when parity or baseline regression gate fails', () => {
    const [dataset] = getBuiltInOfflineEvaluationDatasets();
    const baseline = runFairnessAndCoverageAudit({
      dataset,
      cohortAxis: 'connectivityTier',
    });

    const failingRanker = (query) => {
      // Simulate severe regression on offline/2g-like queries or empty results
      if (query?.intents?.includes('food_subsidy') || query?.intents?.includes('birth_registration')) {
        return [];
      }
      return [{ id: 'passport', score: 0.9 }];
    };

    const candidate = runFairnessAndCoverageAudit({
      dataset,
      cohortAxis: 'connectivityTier',
      rankerFn: failingRanker,
      baselineRun: baseline,
    });

    expect(candidate.gate.status).toBe('BLOCK');
    expect(candidate.gate.passed).toBe(false);
    expect(candidate.gate.action).toBe('BLOCK_RELEASE_AND_ROLLBACK');
    expect(candidate.gate.violations.length).toBeGreaterThan(0);
  });

  it('migrates legacy audit store payloads safely with backward-compatible defaults', () => {
    const migrated = migrateAuditStoreState({ runs: [{ runId: 'legacy-1' }] });
    expect(migrated.schemaVersion).toBe('1.0.0');
    expect(migrated.runs).toHaveLength(1);
    expect(migrated.policy.minCohortSize).toBe(10);
    expect(migrated.datasets).toEqual([]);
  });
});

