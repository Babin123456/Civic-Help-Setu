import { describe, it, expect } from 'vitest';
import {
  RULESET_VERSION,
  STATISTICAL_DISCLAIMER,
  calculateQualityMetrics,
  generateRecommendations,
  generateFullQualityReport,
  updateRecommendationDecision,
} from './surveyDiagnosticsService.js';
import { QUESTION_TYPES } from '../data/surveyContract.js';

describe('surveyDiagnosticsService', () => {
  const mockSurvey = {
    id: 'srv-test',
    samplingTarget: {
      totalTarget: 100,
      minimumSubgroupThreshold: 5,
      strata: [
        { stratumKey: 'resident_type', label: 'Household', targetPercent: 60, minCount: 60 },
        { stratumKey: 'resident_type', label: 'Commercial', targetPercent: 40, minCount: 40 },
      ],
    },
    activeVersionId: 'v1',
    versions: [
      {
        id: 'v1',
        questions: [
          { id: 'q1', variableName: 'q_residence', prompt: 'Residence Type', type: QUESTION_TYPES.SINGLE_CHOICE, required: true },
          { id: 'q2', variableName: 'q_feedback', prompt: 'Detailed Feedback', type: QUESTION_TYPES.TEXT_SHORT, required: false },
        ],
      },
    ],
  };

  it('calculates completion rate, missingness, and stratum coverage accurately', () => {
    const mockResponses = [
      { id: 'r1', answers: { q1: 'Household', q2: 'Great service' } },
      { id: 'r2', answers: { q1: 'Household', q2: '' } }, // q2 skipped
      { id: 'r3', answers: { q1: 'Household' } }, // q2 missing
      { id: 'r4', answers: { q1: 'Commercial', q2: 'Needs improvement' } },
    ];

    const metrics = calculateQualityMetrics(mockSurvey, mockResponses);
    expect(metrics.totalResponses).toBe(4);
    expect(metrics.targetQuota).toBe(100);
    expect(metrics.targetProgressPct).toBe(4);
    expect(metrics.completionRatePct).toBe(100); // q1 is only required field and all answered

    // Missingness on q2
    const q2Missingness = metrics.missingness.find((m) => m.questionId === 'q2');
    expect(q2Missingness.missingCount).toBe(2);
    expect(q2Missingness.missingPct).toBe(50);

    // Stratum coverage
    const householdStratum = metrics.stratumCoverage.find((s) => s.label === 'Household');
    expect(householdStratum.actualCount).toBe(3);
    expect(householdStratum.actualPercent).toBe(75);
    expect(householdStratum.deviation).toBe(15);
  });

  it('generates explainable recommendations with influencing fields and versioning', () => {
    // 50% missing on q2 and low sample size
    const mockResponses = [
      { id: 'r1', answers: { q1: 'Household' } },
      { id: 'r2', answers: { q1: 'Household', q2: 'Note' } },
    ];

    const metrics = calculateQualityMetrics(mockSurvey, mockResponses);
    const recs = generateRecommendations(metrics, mockSurvey);

    expect(recs.length).toBeGreaterThan(0);
    const dropRec = recs.find((r) => r.type === 'QUESTION_OPTIMIZATION');
    expect(dropRec).toBeDefined();
    expect(dropRec.rulesetVersion).toBe(RULESET_VERSION);
    expect(dropRec.influencingFields.length).toBeGreaterThan(0);
    expect(dropRec.humanDecision).toBe('pending');
  });

  it('builds full quality report containing metrics and legal/statistical disclaimer', () => {
    const report = generateFullQualityReport(mockSurvey, []);
    expect(report.surveyId).toBe('srv-test');
    expect(report.rulesetVersion).toBe(RULESET_VERSION);
    expect(report.disclaimer).toBe(STATISTICAL_DISCLAIMER);
    expect(report.metrics).toBeDefined();
    expect(report.recommendations).toBeDefined();
  });

  it('allows an authorized human to accept or reject automated recommendations', () => {
    const report = generateFullQualityReport(mockSurvey, [
      { id: 'r1', answers: { q1: 'Household' } },
    ]);
    const firstRecId = report.recommendations[0].id;

    updateRecommendationDecision(report, firstRecId, 'accepted', 'Agreed to conduct Ward 12 field drive');
    const updated = report.recommendations.find((r) => r.id === firstRecId);
    expect(updated.humanDecision).toBe('accepted');
    expect(updated.reviewNotes).toBe('Agreed to conduct Ward 12 field drive');
    expect(updated.decidedAt).toBeDefined();

    expect(() => updateRecommendationDecision(report, firstRecId, 'invalid_action')).toThrow();
  });
});

