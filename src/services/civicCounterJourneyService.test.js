import { describe, it, expect } from 'vitest';
import {
  validateJourneyRequest,
  evaluateCounterJourney,
  buildJourneyChecklistText,
  buildAICounterExplanation,
  detectQueueClaim,
  isCheckpointApplicable,
  COUNTER_JOURNEY_DATA_VERSION,
  COUNTER_JOURNEY_OFFICES,
  COUNTER_JOURNEY_DISCLAIMER,
  JOURNEY_PROGRESS_KEY,
  CHECKPOINT_REQUIREMENT,
  COUNTER_STATUS,
  COUNTER_JOURNEY_REVIEW_DATE,
} from './civicCounterJourneyService.js';

const SERVICE_ID = 'income-certificate-delhi-south';
const JOURNEY_ID = 'income-certificate-delhi-south';

describe('validateJourneyRequest', () => {
  it('accepts a valid request with journeyId, availableDocumentIds and context', () => {
    const { valid, errors } = validateJourneyRequest({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['aadhaar', 'address-proof'],
      context: { householdDetailsRequired: true },
    });
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('rejects missing journeyId', () => {
    const { valid, errors } = validateJourneyRequest({
      availableDocumentIds: ['aadhaar'],
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.code === 'INVALID_JOURNEY_ID')).toBe(true);
  });

  it('rejects unknown document ids', () => {
    const { valid, errors } = validateJourneyRequest({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['nonexistent-doc'],
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.code === 'UNKNOWN_DOCUMENT')).toBe(true);
  });

  it('rejects sensitive keys (aadhaar number pattern)', () => {
    const { valid, errors } = validateJourneyRequest({
      journeyId: JOURNEY_ID,
      context: { aadhaarNumber: '1234 5678 9012' },
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.code === 'SENSITIVE_FIELD')).toBe(true);
  });

  it('accepts conditional checkpoints with conditionKey in context', () => {
    const { valid } = validateJourneyRequest({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['aadhaar', 'address-proof', 'income-proof'],
      context: { householdDetailsRequired: true, onlineReferenceRequired: true },
    });
    expect(valid).toBe(true);
  });

  it('rejects too many document ids', () => {
    const many = Array(101).fill('aadhaar');
    const { valid, errors } = validateJourneyRequest({
      journeyId: JOURNEY_ID,
      availableDocumentIds: many,
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.code === 'TOO_MANY_DOCUMENTS')).toBe(true);
  });
});

describe('evaluateCounterJourney', () => {
  it('evaluates a journey with all required docs marked available', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['aadhaar', 'address-proof', 'income-proof'],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    expect(result.journey.serviceName).toBe('Income Certificate');
    expect(result.progress.clearedCounters).toBeGreaterThan(0);
    expect(result.progress.percent).toBeGreaterThan(0);
  });

  it('evaluates a journey with missing required docs', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['aadhaar'],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    expect(result.journey.serviceName).toBe('Income Certificate');
    expect(result.journey.isIllustrative).toBe(true);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.comparison.isComplete).toBe(false);
  });

  it('handles empty availableDocumentIds', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: [],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    expect(result.journey.title).toContain('Income Certificate');
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('includes AI suggestions with source refs', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['aadhaar', 'address-proof'],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.aiSuggestions)).toBe(true);
    result.aiSuggestions.forEach((s) => {
      expect(s).toHaveProperty('label', 'SUGGESTION');
      expect(s).toHaveProperty('counterId');
      expect(s).toHaveProperty('requiresReview');
      expect(s).toHaveProperty('sourceRefs');
      expect(s).toHaveProperty('dataVersion', COUNTER_JOURNEY_DATA_VERSION);
      expect(s).toHaveProperty('requiresConfirmation');
    });
  });

  it('detects queue claims in AI text', () => {
    expect(detectQueueClaim('The queue is 20 minutes long')).toBe(true);
    expect(detectQueueClaim('This does not show waiting time')).toBe(false);
    expect(detectQueueClaim('Live token waiting status')).toBe(true);
    expect(detectQueueClaim('No waiting time is shown')).toBe(false);
  });

  it('builds comparison between complete and incomplete visit', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['aadhaar'],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    expect(result.comparison).toHaveProperty('completeVisit');
    expect(result.comparison).toHaveProperty('incompleteVisit');
    expect(result.comparison).toHaveProperty('delta');
    expect(result.comparison.isComplete).toBe(false);
    expect(result.comparison.incompleteVisit.missingDocuments).toBeGreaterThan(0);
  });

  it('builds linear checklist', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['aadhaar', 'address-proof'],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.linearChecklist)).toBe(true);
    result.linearChecklist.forEach((item) => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('order');
    });
  });

  it('builds journey checklist text', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: ['aadhaar', 'address-proof'],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    const text = buildJourneyChecklistText(result);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    // No fabricated wait-time claims should survive; detectQueueClaim on text should be false
    expect(detectQueueClaim(text)).toBe(false);
  });

  it('includes dataQuality stale check', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: [],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    expect(result.dataQuality).toHaveProperty('dataVersion', COUNTER_JOURNEY_DATA_VERSION);
    expect(result.dataQuality).toHaveProperty('reviewDate', COUNTER_JOURNEY_REVIEW_DATE);
    // Review date 2026-11-18 vs today same => not stale
    expect(result.dataQuality.isStale).toBe(false);
  });

  it('includes officialStatus distinction', () => {
    const result = evaluateCounterJourney({
      journeyId: JOURNEY_ID,
      availableDocumentIds: [],
      context: {},
      today: new Date('2026-11-18'),
    });
    expect(result.ok).toBe(true);
    expect(result.officialStatus).toHaveProperty('isOfficial', false);
    expect(result.officialStatus).toHaveProperty('label', 'Private preparation progress');
    expect(result.officialStatus).toHaveProperty('message');
  });
});

describe('buildAICounterExplanation', () => {
  it('produces a SUGGESTION label with source refs when guidance and sources exist', () => {
    const explanation = buildAICounterExplanation({
      id: 'help-desk',
      title: 'Help desk and form issuance',
      guidance:
        'Reviewed guidance asks applicants to submit the application with identity and address proof.',
      sourceIds: ['delhi-edistrict-revenue'],
    });
    expect(explanation).toHaveProperty('label', 'SUGGESTION');
    expect(explanation).toHaveProperty('counterId', 'help-desk');
    expect(explanation).toHaveProperty('sourceRefs');
    expect(explanation).toHaveProperty('requiresConfirmation', true);
    expect(explanation).toHaveProperty('dataVersion', COUNTER_JOURNEY_DATA_VERSION);
    expect(explanation.containsQueueClaim).toBe(false);
  });

  it('routes to review when guidance missing', () => {
    const explanation = buildAICounterExplanation({
      id: 'unknown',
      title: 'Unknown counter',
    });
    expect(explanation.requiresReview).toBe(true);
    expect(explanation.reviewReason).toContain('No approved guidance');
  });

  it('detects queue claim in suggestion text', () => {
    const explanation = buildAICounterExplanation({
      id: 'test',
      title: 'Test',
      guidance: 'The queue is 20 minutes long',
    });
    expect(explanation.containsQueueClaim).toBe(true);
    expect(explanation.requiresReview).toBe(true);
  });

  it('includes confidence and requiresConfirmation', () => {
    const explanation = buildAICounterExplanation({
      id: 'test',
      title: 'Test',
      guidance: 'Some approved guidance text.',
      sourceIds: ['some-source'],
    });
    expect(explanation.confidence).toBeGreaterThan(0);
    expect(explanation.requiresConfirmation).toBe(true);
  });
});

describe('orderCountersDeterministically', () => {
  it('orders counters when dependencies are valid', () => {
    const { ordered, errors } = orderCountersDeterministically([
      { id: 'c1', title: 'Counter 1', order: 1, dependsOn: [] },
      { id: 'c2', title: 'Counter 2', order: 2, dependsOn: ['c1'] },
    ]);
expect(errors).toHaveLength(0);
    expect(ordered.map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('isCheckpointApplicable', () => {
  it('returns true for REQUIRED checkpoints', () => {
    const result = isCheckpointApplicable(
      { requirement: 'REQUIRED', documentId: 'aadhaar' },
      {}
    );
    expect(result).toBe(true);
  });

  it('returns true for CONDITIONAL when conditionKey matches context', () => {
    const result = isCheckpointApplicable(
      {
        requirement: 'CONDITIONAL',
        documentId: 'income-proof',
        conditionKey: 'householdDetailsRequired',
      },
      { householdDetailsRequired: true }
    );
    expect(result).toBe(true);
  });

  it('returns false for CONDITIONAL when conditionKey does not match', () => {
    const result = isCheckpointApplicable(
      {
        requirement: 'CONDITIONAL',
        documentId: 'income-proof',
        conditionKey: 'householdDetailsRequired',
      },
      { otherFlag: true }
    );
    expect(result).toBe(false);
  });

  it('returns false for OPTIONAL', () => {
    const result = isCheckpointApplicable(
      { requirement: 'OPTIONAL', documentId: 'passport-photo' },
      {}
    );
    expect(result).toBe(false);
  });
});