import { describe, it, expect, beforeEach } from 'vitest';
import {
  listSurveys,
  getSurvey,
  createSurvey,
  transitionSurvey,
  createNewVersion,
  submitResponse,
  withdrawSurveyConsent,
  getDiagnostics,
  reviewDiagnosticRecommendation,
  exportCodebook,
  exportAnonymizedResponses,
} from './surveyService.js';
import { clearSurveyStorage } from './surveyStorage.js';
import { SURVEY_STATUS, QUESTION_TYPES } from '../data/surveyContract.js';

describe('surveyService', () => {
  beforeEach(() => {
    clearSurveyStorage();
  });

  it('lists and filters surveys correctly', () => {
    const all = listSurveys();
    expect(all.length).toBeGreaterThan(0);

    const waterSurveys = listSurveys({ category: 'Water & Sanitation' });
    expect(waterSurveys.length).toBe(1);
    expect(waterSurveys[0].category).toBe('Water & Sanitation');

    const searchResults = listSurveys({ search: 'transit' });
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].id).toBe('srv-urban-mobility-transit-2026');
  });

  it('creates a new survey and logs audit trail', () => {
    const payload = {
      id: 'srv-pds-survey',
      title: 'PDS Fair Price Shop Grain Quality Survey',
      description: 'Assessment of ration card holder satisfaction, grain cleanliness, and weighing accuracy.',
      department: 'Department of Food, Civil Supplies and Consumer Affairs',
      category: 'Food Security',
      jurisdiction: { state: 'Delhi NCT', district: 'East Delhi', ward: 'Ward 4' },
      consentConfig: {
        consentText: 'Voluntary civic response. Feedback assists vigilance committees in fair price distribution.',
        retentionDays: 180,
      },
      questions: [
        {
          id: 'q1',
          variableName: 'grain_quality_rating',
          prompt: 'Rate the quality of fortified wheat and rice received:',
          type: QUESTION_TYPES.NUMERIC_RATING,
          min: 1,
          max: 5,
          required: true,
        },
      ],
    };

    const created = createSurvey(payload, { role: 'department_operator', userId: 'usr_pds_1' });
    expect(created.id).toBe('srv-pds-survey');
    expect(created.status).toBe(SURVEY_STATUS.DRAFT);

    const fetched = getSurvey('srv-pds-survey');
    expect(fetched).not.toBeNull();
  });

  it('enforces state machine and prevents publishing without questions', () => {
    const emptySurvey = createSurvey({
      id: 'srv-empty',
      title: 'Empty Consultation Draft',
      description: 'Consultation with zero registered questions at the moment.',
      department: 'General Administration',
      jurisdiction: { state: 'Karnataka' },
      consentConfig: { consentText: 'Voluntary feedback for departmental review purposes.' },
      questions: [],
    });

    // Attempting invalid transition directly to published
    expect(() =>
      transitionSurvey(emptySurvey.id, SURVEY_STATUS.PUBLISHED, 'Publishing immediately')
    ).toThrow(/Invalid transition/);

    // Transition to under review
    transitionSurvey(emptySurvey.id, SURVEY_STATUS.UNDER_REVIEW);
    expect(getSurvey(emptySurvey.id).status).toBe(SURVEY_STATUS.UNDER_REVIEW);

    // Attempt to publish with 0 questions
    expect(() =>
      transitionSurvey(emptySurvey.id, SURVEY_STATUS.PUBLISHED, 'Attempting publish')
    ).toThrow(/zero registered questions/);
  });

  it('creates new survey version and resets status to draft for review', () => {
    const updated = createNewVersion('srv-water-sanitation-2026', 'Added monsoon leakage questions');
    expect(updated.versions.length).toBe(2);
    expect(updated.activeVersionId).toBe('v2.0.0');
    expect(updated.status).toBe(SURVEY_STATUS.DRAFT);
  });

  it('submits response, verifies anti-duplicate idempotency, and withdraws consent', () => {
    const subResult = submitResponse('srv-water-sanitation-2026', {
      idempotencyKey: 'idemp-resp-101',
      consentGiven: true,
      answers: {
        q_resident_type: 'individual_household',
        q_primary_source: 'piped_municipal',
        q_supply_pressure_rating: 4,
      },
    });

    expect(subResult.success).toBe(true);
    expect(subResult.consentToken).toBeDefined();

    // Withdraw consent
    const withdrew = withdrawSurveyConsent('srv-water-sanitation-2026', subResult.consentToken);
    expect(withdrew).toBe(true);
  });

  it('exports codebook in JSON and CSV formats', () => {
    const jsonCodebook = exportCodebook('srv-water-sanitation-2026', 'json');
    expect(jsonCodebook.length).toBeGreaterThan(0);
    expect(jsonCodebook[0].variableName).toBeDefined();

    const csvCodebook = exportCodebook('srv-water-sanitation-2026', 'csv');
    expect(typeof csvCodebook).toBe('string');
    expect(csvCodebook).toContain('variableName');
    expect(csvCodebook).toContain('resident_type');
  });

  it('generates diagnostics and records human recommendation review decision', () => {
    const report = getDiagnostics('srv-water-sanitation-2026');
    expect(report.metrics).toBeDefined();
    expect(report.recommendations).toBeDefined();

    if (report.recommendations.length > 0) {
      const recId = report.recommendations[0].id;
      const updatedReport = reviewDiagnosticRecommendation(
        'srv-water-sanitation-2026',
        report,
        recId,
        'accepted',
        'Noted by ward engineer'
      );
      expect(updatedReport.recommendations[0].humanDecision).toBe('accepted');
    }
  });
});

