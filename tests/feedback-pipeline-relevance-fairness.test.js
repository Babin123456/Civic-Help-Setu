import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PrivacySafeFeedbackPipeline,
  MIN_FEEDBACK_SAMPLE_THRESHOLD,
} from '../src/services/feedbackRankingPipelineService.js';
import {
  rankCivicServices,
  normalizeUserPreferences,
  evaluateServiceRecommendation,
  DEFAULT_WEIGHTS,
} from '../src/services/recommendationEngine.js';

vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
});

describe('PrivacySafeFeedbackPipeline - Recommendation Feedback', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new PrivacySafeFeedbackPipeline();
    // Reset in-memory records
    pipeline.inMemoryRecords = [];
    pipeline.recommendationFeedback = [];
  });

  describe('recordRecommendationFeedback', () => {
    it('records useful feedback with consent', () => {
      const result = pipeline.recordRecommendationFeedback({
        queryText: 'travel abroad',
        retrievedChunkIds: ['passport'],
        selectedChunkId: 'passport',
        rating: 1,
        hasConsent: true,
        feedbackNote: 'Helpful for my trip',
      });

      expect(result.recorded).toBe(true);
      expect(result.recordId).toBeDefined();
      expect(pipeline.recommendationFeedback.length).toBe(1);
      expect(pipeline.recommendationFeedback[0].rating).toBe(1);
    });

    it('records not useful feedback', () => {
      const result = pipeline.recordRecommendationFeedback({
        queryText: 'voter id',
        retrievedChunkIds: ['voter-id'],
        selectedChunkId: 'voter-id',
        rating: -1,
        hasConsent: true,
      });

      expect(result.recorded).toBe(true);
      expect(pipeline.recommendationFeedback[0].rating).toBe(-1);
    });

    it('blocks feedback without consent', () => {
      const result = pipeline.recordRecommendationFeedback({
        queryText: 'test',
        retrievedChunkIds: ['service'],
        selectedChunkId: 'service',
        rating: 1,
        hasConsent: false,
      });

      expect(result.recorded).toBe(false);
      expect(result.reason).toContain('consent');
    });

    it('rejects invalid rating', () => {
      const result = pipeline.recordRecommendationFeedback({
        queryText: 'test',
        retrievedChunkIds: ['service'],
        selectedChunkId: 'service',
        rating: 0,
        hasConsent: true,
      });

      expect(result.recorded).toBe(false);
      expect(result.reason).toContain('Rating must be');
    });

    it('rejects empty query', () => {
      const result = pipeline.recordRecommendationFeedback({
        queryText: '',
        retrievedChunkIds: ['service'],
        selectedChunkId: 'service',
        rating: 1,
        hasConsent: true,
      });

      expect(result.recorded).toBe(false);
    });
  });

  describe('getFeedbackStatistics', () => {
    it('returns zero stats when no feedback', () => {
      const stats = pipeline.getFeedbackStatistics();

      expect(stats.totalRecords).toBe(0);
      expect(stats.usefulCount).toBe(0);
      expect(stats.notUsefulCount).toBe(0);
      expect(stats.usefulnessRatio).toBe(0);
      expect(stats.thresholdMet).toBe(false);
      expect(stats.sampleCountNeeded).toBe(50);
    });

    it('returns stats after recording feedback', () => {
      pipeline.recordRecommendationFeedback({
        queryText: 'test 1',
        retrievedChunkIds: ['s1'],
        selectedChunkId: 's1',
        rating: 1,
        hasConsent: true,
      });
      pipeline.recordRecommendationFeedback({
        queryText: 'test 2',
        retrievedChunkIds: ['s2'],
        selectedChunkId: 's2',
        rating: 1,
        hasConsent: true,
      });
      pipeline.recordRecommendationFeedback({
        queryText: 'test 3',
        retrievedChunkIds: ['s3'],
        selectedChunkId: 's3',
        rating: -1,
        hasConsent: true,
      });

      const stats = pipeline.getFeedbackStatistics();

      expect(stats.totalRecords).toBe(3);
      expect(stats.usefulCount).toBe(2);
      expect(stats.notUsefulCount).toBe(1);
      expect(stats.usefulnessRatio).toBe(2 / 3);
      expect(stats.thresholdMet).toBe(false);
      expect(stats.sampleCountNeeded).toBe(47);
    });

    it('enforces minimum sample threshold', () => {
      // Record 49 feedback records (below threshold of 50)
      for (let i = 0; i < 49; i++) {
        pipeline.recordRecommendationFeedback({
          queryText: `test ${i}`,
          retrievedChunkIds: [`s${i}`],
          selectedChunkId: `s${i}`,
          rating: i % 2 === 0 ? 1 : -1,
          hasConsent: true,
        });
      }

      const stats = pipeline.getFeedbackStatistics();

      expect(stats.totalRecords).toBe(49);
      expect(stats.thresholdMet).toBe(false);
      expect(stats.sampleCountNeeded).toBe(1);
    });

    it('allows model evaluation when threshold met', () => {
      // Record 51 feedback records (above threshold of 50)
      for (let i = 0; i < 51; i++) {
        pipeline.recordRecommendationFeedback({
          queryText: `test ${i}`,
          retrievedChunkIds: [`s${i}`],
          selectedChunkId: `s${i}`,
          rating: 1,
          hasConsent: true,
        });
      }

      const result = pipeline.evaluateModelFromRecommendationFeedback({
        candidateVersion: '2.0.0',
        candidateMetrics: { mrr: 0.75, ndcg: 0.80 },
        baselineMetrics: { mrr: 0.70, ndcg: 0.73 },
      });

      // When threshold is met, it should proceed to normal model evaluation
      // The candidate needs +0.02 improvement, which it has (0.75 - 0.70 = 0.05, 0.80 - 0.73 = 0.07)
      expect(result.promoted).toBe(true);
      expect(result.newActiveVersion).toBe('2.0.0');
    });

    it('blocks model evaluation when threshold not met', () => {
      // Record only 10 feedback records (below threshold)
      for (let i = 0; i < 10; i++) {
        pipeline.recordRecommendationFeedback({
          queryText: `test ${i}`,
          retrievedChunkIds: [`s${i}`],
          selectedChunkId: `s${i}`,
          rating: 1,
          hasConsent: true,
        });
      }

      const result = pipeline.evaluateModelFromRecommendationFeedback({
        candidateVersion: '2.0.0',
        candidateMetrics: { mrr: 0.99, ndcg: 0.99 },
        baselineMetrics: { mrr: 0, ndcg: 0 },
      });

      // Should block because threshold not met
      expect(result.promoted).toBe(false);
      expect(result.reason).toContain('Insufficient feedback samples');
    });
  });

  describe('clearAllRecommendationFeedback', () => {
    it('clears all recommendation feedback', () => {
      // Record some feedback
      for (let i = 0; i < 5; i++) {
        pipeline.recordRecommendationFeedback({
          queryText: `test ${i}`,
          retrievedChunkIds: [`s${i}`],
          selectedChunkId: `s${i}`,
          rating: 1,
          hasConsent: true,
        });
      }

      expect(pipeline.recommendationFeedback.length).toBe(5);

      pipeline.clearAllRecommendationFeedback();

      expect(pipeline.recommendationFeedback.length).toBe(0);
    });
  });
});

describe('recommendationEngine - Relevance Tests', () => {
  beforeEach(() => {
    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });
  });

  describe('rankCivicServices', () => {
    it('ranks services with useful feedback signals', () => {
      const services = [
        { id: 'passport', name: 'Passport', category: 'Identity', department: 'Passport Office', fees: 'Paid', processingTime: '30 days', popularityScore: 80 },
        { id: 'voter-id', name: 'Voter ID', category: 'Voting', department: 'Election Commission', fees: 'Free', processingTime: '14 days', popularityScore: 70 },
      ];

      const preferences = normalizeUserPreferences({
        intents: ['travel_abroad'],
        citizenship: 'indian',
      });

      const ranked = rankCivicServices(services, preferences, DEFAULT_WEIGHTS);

      expect(ranked[0].serviceId).toBe('passport');
      expect(ranked[0].matchPercentage).toBeGreaterThan(0);
    });

    it('uses deterministic tie-breaking by serviceId', () => {
      const services = [
        { id: 'service-b', name: 'Service B', category: 'B', department: 'Dept', fees: 'Free', processingTime: '30 days', popularityScore: 50 },
        { id: 'service-a', name: 'Service A', category: 'A', department: 'Dept', fees: 'Free', processingTime: '30 days', popularityScore: 50 },
        { id: 'service-c', name: 'Service C', category: 'C', department: 'Dept', fees: 'Free', processingTime: '30 days', popularityScore: 50 },
      ];

      const preferences = normalizeUserPreferences({});

      const ranked = rankCivicServices(services, preferences, DEFAULT_WEIGHTS);

      // Alphabetical ascending tie-breaker
      expect(ranked[0].serviceId).toBe('service-a');
      expect(ranked[1].serviceId).toBe('service-b');
      expect(ranked[2].serviceId).toBe('service-c');
    });
  });

  describe('evaluateServiceRecommendation', () => {
    it('evaluates service recommendation with all criteria', () => {
      const service = {
        id: 'ration-card',
        name: 'Ration Card',
        category: 'Food',
        department: 'Food Supply',
        fees: 'Free',
        processingTime: '21 days',
        documents: ['ration-card'],
        eligibility: [],
        speedDays: 21,
        warnings: [],
      };

      const preferences = normalizeUserPreferences({
        intents: [],
        category: null,
        heldDocuments: [],
      });

      const result = evaluateServiceRecommendation(service, preferences, DEFAULT_WEIGHTS);

      expect(result.matchPercentage).toBeDefined();
      // No intents, no category, no documents -> neutral scores
      expect(result.scores.intent).toBe(0.5);
      // documents: 0 of 1 required -> 0.0 ratio
      expect(result.scores.documents).toBe(0);
      // eligibility: no eligibility criteria -> 0.7 default
      expect(result.scores.eligibility).toBe(0.7);
      expect(result.matchedCriteria).toBeDefined();
      expect(result.unmetRequirements).toBeDefined();
      expect(result.unknownCriteria).toBeDefined();
      // needsOfficialVerification: missing documents and unknown eligibility
      expect(result.needsOfficialVerification).toBe(true);
    });
    it('handles missing preferences gracefully', () => {
      const service = {
        id: 'ration-card',
        name: 'Ration Card',
        category: 'Food',
        department: 'Food Supply',
        fees: 'Free',
        processingTime: '21 days',
        documents: ['ration-card'],
        eligibility: [],
        speedDays: 21,
        warnings: [],
      };

      const preferences = normalizeUserPreferences({});

      const result = evaluateServiceRecommendation(service, preferences, DEFAULT_WEIGHTS);

      expect(result.matchPercentage).toBeDefined();
      expect(result.needsOfficialVerification).toBe(true);
    });
  });

  describe('Fairness Tests', () => {
    it('does not discriminate based on missing optional fields', () => {
      const services = [
        { id: 'service-a', name: 'Service A', category: 'General', department: 'Dept A', fees: 'Free', processingTime: '30 days', popularityScore: 50 },
        { id: 'service-b', name: 'Service B', category: 'General', department: 'Dept B', fees: 'Free', processingTime: '30 days', popularityScore: 50 },
      ];

      // User with no preferences should get balanced results
      const preferences = normalizeUserPreferences({});

      const ranked = rankCivicServices(services, preferences, DEFAULT_WEIGHTS);

      // Both services should be ranked and neither should be excluded solely due to missing preferences
      expect(ranked.length).toBe(2);
      expect(ranked[0].serviceId).toBeDefined();
      expect(ranked[1].serviceId).toBeDefined();
    });

    it('provides transparent explanations for all services', () => {
      const service = {
        id: 'service-x',
        name: 'Service X',
        category: 'General',
        department: 'Dept X',
        fees: 'Free',
        processingTime: '30 days',
        documents: ['aadhaar-card'],
        eligibility: ['citizenship'],
        speedDays: 30,
        warnings: [],
      };

      const preferences = normalizeUserPreferences({
        intents: [],
        category: null,
        heldDocuments: ['aadhaar-card'],
      });

      const result = evaluateServiceRecommendation(service, preferences, DEFAULT_WEIGHTS);

      // Should always provide some explanation even with provided preferences
      expect(
        result.matchedCriteria.length + result.unmetRequirements.length + result.unknownCriteria.length
      ).toBeGreaterThan(0);
    });

    it('maintains deterministic ranking across runs', () => {
      const services = [
        { id: 'service-1', name: 'Service 1', category: 'A', department: 'Dept', fees: 'Free', processingTime: '30 days', popularityScore: 50 },
        { id: 'service-2', name: 'Service 2', category: 'B', department: 'Dept', fees: 'Free', processingTime: '30 days', popularityScore: 50 },
        { id: 'service-3', name: 'Service 3', category: 'C', department: 'Dept', fees: 'Free', processingTime: '30 days', popularityScore: 50 },
      ];

      const preferences = normalizeUserPreferences({ intents: [], heldDocuments: [] });

      const ranked1 = rankCivicServices(services, preferences, DEFAULT_WEIGHTS);
      const ranked2 = rankCivicServices(services, preferences, DEFAULT_WEIGHTS);

      // Same inputs should produce same output (deterministic)
      expect(ranked1[0].serviceId).toBe(ranked2[0].serviceId);
      expect(ranked1[1].serviceId).toBe(ranked2[1].serviceId);
      expect(ranked1[2].serviceId).toBe(ranked2[2].serviceId);
    });
  });
});