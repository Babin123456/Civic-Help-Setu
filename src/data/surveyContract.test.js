import { describe, it, expect } from 'vitest';
import {
  SURVEY_STATUS,
  QUESTION_TYPES,
  canTransitionSurveyState,
  validateSurveyProject,
  validateSurveyQuestion,
  evaluateBranching,
  validateSurveyResponse,
  generateCodebook,
  maskSmallDemographicSubgroups,
  migrateSurveyData,
  rollbackSurveyData,
} from './surveyContract.js';

describe('surveyContract domain & validation', () => {
  it('validates state transitions accurately', () => {
    expect(canTransitionSurveyState(SURVEY_STATUS.DRAFT, SURVEY_STATUS.UNDER_REVIEW)).toBe(true);
    expect(canTransitionSurveyState(SURVEY_STATUS.UNDER_REVIEW, SURVEY_STATUS.PUBLISHED)).toBe(true);
    expect(canTransitionSurveyState(SURVEY_STATUS.PUBLISHED, SURVEY_STATUS.PAUSED)).toBe(true);
    expect(canTransitionSurveyState(SURVEY_STATUS.PAUSED, SURVEY_STATUS.CLOSED)).toBe(true);
    expect(canTransitionSurveyState(SURVEY_STATUS.CLOSED, SURVEY_STATUS.ARCHIVED)).toBe(true);

    // Invalid transitions
    expect(canTransitionSurveyState(SURVEY_STATUS.DRAFT, SURVEY_STATUS.PUBLISHED)).toBe(false);
    expect(canTransitionSurveyState(SURVEY_STATUS.ARCHIVED, SURVEY_STATUS.PUBLISHED)).toBe(false);
  });

  it('validates survey project payloads', () => {
    const invalidProject = { title: 'Hi' };
    const resInvalid = validateSurveyProject(invalidProject);
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.errors.length).toBeGreaterThan(0);

    const validProject = {
      title: 'Ward 12 Municipal Water Supply & Sanitation Survey',
      description: 'Structured public consultation on supply frequency, pipeline pressure, and tanker deliveries.',
      department: 'Department of Public Works & Water Supply',
      jurisdiction: { state: 'Karnataka', district: 'Bengaluru Urban', ward: 'Ward 12' },
      consentConfig: {
        consentText: 'Voluntary civic response. Responses are anonymized and retained for 365 days.',
        retentionDays: 365,
      },
      status: SURVEY_STATUS.DRAFT,
      collectionWindow: {
        startDate: '2026-11-01',
        endDate: '2026-12-01',
      },
    };
    const resValid = validateSurveyProject(validProject);
    expect(resValid.valid).toBe(true);
    expect(resValid.errors).toEqual([]);
  });

  it('validates question definitions', () => {
    const badQuestion = {
      id: 'q1',
      variableName: '123_invalid',
      prompt: 'Q',
      type: 'invalid_type',
    };
    const res = validateSurveyQuestion(badQuestion);
    expect(res.valid).toBe(false);

    const goodChoiceQuestion = {
      id: 'q_water_source',
      variableName: 'water_source_primary',
      prompt: 'What is your primary domestic water supply source?',
      type: QUESTION_TYPES.SINGLE_CHOICE,
      options: [
        { value: 'piped_municipal', label: 'Municipal Piped Connection' },
        { value: 'borewell', label: 'Private/Shared Borewell' },
        { value: 'tanker', label: 'Commercial Water Tanker' },
      ],
    };
    const resChoice = validateSurveyQuestion(goodChoiceQuestion);
    expect(resChoice.valid).toBe(true);
  });

  it('evaluates dynamic branching rules correctly', () => {
    const rules = [
      {
        sourceQuestionId: 'q_water_source',
        condition: 'equals',
        targetValue: 'tanker',
        action: 'jump_to',
        nextQuestionId: 'q_tanker_delivery_cost',
      },
      {
        sourceQuestionId: 'q_residence_type',
        condition: 'equals',
        targetValue: 'commercial',
        action: 'terminate',
      },
    ];

    const answers1 = { q_water_source: 'tanker' };
    const branch1 = evaluateBranching(rules, answers1, 'q_water_source');
    expect(branch1).toEqual({
      action: 'jump_to',
      nextQuestionId: 'q_tanker_delivery_cost',
      terminate: false,
    });

    const answers2 = { q_residence_type: 'commercial' };
    const branch2 = evaluateBranching(rules, answers2, 'q_residence_type');
    expect(branch2).toEqual({
      action: 'terminate',
      nextQuestionId: null,
      terminate: true,
    });

    const answers3 = { q_water_source: 'borewell' };
    const branch3 = evaluateBranching(rules, answers3, 'q_water_source');
    expect(branch3).toBeNull();
  });

  it('validates survey responses against active version schemas and consent requirements', () => {
    const version = {
      questions: [
        {
          id: 'q_rating',
          prompt: 'Overall satisfaction with municipal grievance resolution',
          type: QUESTION_TYPES.NUMERIC_RATING,
          min: 1,
          max: 5,
          required: true,
        },
        {
          id: 'q_feedback',
          prompt: 'Specific suggestions for improvement',
          type: QUESTION_TYPES.TEXT_SHORT,
          maxCharLength: 50,
          required: false,
        },
      ],
    };

    // Missing consent
    const respNoConsent = {
      idempotencyKey: 'idemp-1',
      consentGiven: false,
      answers: { q_rating: 4 },
    };
    expect(validateSurveyResponse(respNoConsent, version).valid).toBe(false);

    // Missing required field
    const respMissingReq = {
      idempotencyKey: 'idemp-2',
      consentGiven: true,
      answers: {},
    };
    expect(validateSurveyResponse(respMissingReq, version).valid).toBe(false);

    // Out of bounds rating
    const respBadRating = {
      idempotencyKey: 'idemp-3',
      consentGiven: true,
      answers: { q_rating: 10 },
    };
    expect(validateSurveyResponse(respBadRating, version).valid).toBe(false);

    // Valid response
    const validResp = {
      idempotencyKey: 'idemp-4',
      consentGiven: true,
      answers: { q_rating: 5, q_feedback: 'Timely tanker delivery' },
    };
    expect(validateSurveyResponse(validResp, version).valid).toBe(true);
  });

  it('generates an exportable codebook', () => {
    const survey = { id: 'srv-1', title: 'Survey 1' };
    const version = {
      questions: [
        {
          id: 'q1',
          variableName: 'var_age',
          prompt: 'Age bracket',
          type: QUESTION_TYPES.SINGLE_CHOICE,
          options: [{ value: '18_25', label: '18-25' }, { value: '26_40', label: '26-40' }],
          required: true,
          isSensitive: true,
        },
      ],
    };
    const codebook = generateCodebook(survey, version);
    expect(codebook).toHaveLength(1);
    expect(codebook[0].variableName).toBe('var_age');
    expect(codebook[0].isSensitiveDemographic).toBe(true);
    expect(codebook[0].storageDataType).toBe('TEXT');
  });

  it('applies k-anonymity suppression to small demographic subgroups', () => {
    const distribution = {
      Ward_1: 45,
      Ward_2: 30,
      Ward_3: 3, // < 5
      Ward_4: 2, // < 5
    };
    const masked = maskSmallDemographicSubgroups(distribution, 5);
    expect(masked['Ward_1']).toBe(45);
    expect(masked['Ward_2']).toBe(30);
    expect(masked['Ward_3']).toBeUndefined();
    expect(masked['Ward_4']).toBeUndefined();
    expect(masked['Suppressed (Small Group < 5)']).toBe(5);
  });

  it('runs migrations and rollbacks safely', () => {
    const v0Data = { title: 'Legacy Survey' };
    const v1Data = migrateSurveyData(v0Data, 0, 1);
    expect(v1Data.schemaVersion).toBe(1);
    expect(v1Data.anonymousMode).toBe(true);
    expect(v1Data.consentConfig.retentionDays).toBe(365);

    const rolledBack = rollbackSurveyData(v1Data, 1, 0);
    expect(rolledBack.schemaVersion).toBeUndefined();
  });
});

