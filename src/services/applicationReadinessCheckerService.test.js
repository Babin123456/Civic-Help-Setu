import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildReadinessQuestionnaire,
  evaluateApplicationReadiness,
  getOfficialDisclaimer,
} from './applicationReadinessCheckerService.js';

describe('applicationReadinessCheckerService', () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => mockStore[key] ?? null,
      setItem: (key, val) => {
        mockStore[key] = String(val);
      },
      removeItem: (key) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
      get length() {
        return Object.keys(mockStore).length;
      },
    });
  });

  const mockService = {
    id: 'ration-card-001',
    name: 'National Food Security Scheme (Ration Card)',
    officialWebsite: 'https://nfsa.gov.in',
    eligibility: [
      'Must be a permanent resident of the state',
      'Annual household income must be below Rs. 1,00,000 for BPL card',
      'No family member should own a four-wheeler',
    ],
    documents: [
      'Aadhaar Card of all family members',
      'Proof of Residence (Electricity bill or Rent agreement)',
      'Income Certificate issued by Tehsildar',
    ],
  };

  it('builds a questionnaire with citations linked to the catalogue', () => {
    const questionnaire = buildReadinessQuestionnaire(mockService);
    expect(questionnaire.isValid).toBe(true);
    expect(questionnaire.questions.length).toBe(6); // 3 eligibility + 3 documents

    const firstEligibility = questionnaire.questions.find((q) => q.type === 'eligibility');
    expect(firstEligibility.citation.officialWebsite).toBe('https://nfsa.gov.in');
    expect(firstEligibility.citation.serviceName).toBe('National Food Security Scheme (Ration Card)');
    expect(firstEligibility.isMandatory).toBe(true);

    const firstDoc = questionnaire.questions.find((q) => q.type === 'document');
    expect(firstDoc.citation.sourceField).toBe('documents');
  });

  it('handles positive scenario: all conditions met and documents ready', () => {
    const answers = {
      eligibility_0: 'yes',
      eligibility_1: 'yes',
      eligibility_2: 'yes',
      doc_0: 'yes',
      doc_1: 'yes',
      doc_2: 'yes',
    };

    const evaluation = evaluateApplicationReadiness(mockService, answers);
    expect(evaluation.status).toBe('READY');
    expect(evaluation.isReady).toBe(true);
    expect(evaluation.score).toBe(100);
    expect(evaluation.missingDocuments.length).toBe(0);
    expect(evaluation.unmetConditions.length).toBe(0);
    expect(evaluation.uncertainRules.length).toBe(0);
    expect(evaluation.unansweredCount).toBe(0);
    expect(evaluation.disclaimer).toContain('nfsa.gov.in');
    // Ensure zero silent writes to localStorage
    expect(localStorage.length).toBe(0);
  });

  it('handles negative scenario: mandatory condition not met', () => {
    const answers = {
      eligibility_0: 'yes',
      eligibility_1: 'no', // Income exceeds limit
      eligibility_2: 'yes',
      doc_0: 'yes',
      doc_1: 'yes',
      doc_2: 'yes',
    };

    const evaluation = evaluateApplicationReadiness(mockService, answers);
    expect(evaluation.status).toBe('NOT_READY_UNMET_CRITERIA');
    expect(evaluation.isReady).toBe(false);
    expect(evaluation.unmetConditions.length).toBe(1);
    expect(evaluation.unmetConditions[0].label).toContain('below Rs. 1,00,000');
    expect(evaluation.unmetConditions[0].remediation).toContain('nfsa.gov.in');
    expect(localStorage.length).toBe(0);
  });

  it('handles conditional scenario: missing mandatory documents', () => {
    const answers = {
      eligibility_0: 'yes',
      eligibility_1: 'yes',
      eligibility_2: 'yes',
      doc_0: 'yes',
      doc_1: 'missing',
      doc_2: 'yes',
    };

    const evaluation = evaluateApplicationReadiness(mockService, answers);
    expect(evaluation.status).toBe('NEEDS_DOCUMENTS');
    expect(evaluation.isReady).toBe(false);
    expect(evaluation.missingDocuments.length).toBe(1);
    expect(evaluation.missingDocuments[0].label).toContain('Proof of Residence');
  });

  it('handles ambiguous / uncertain condition: user is unsure or document is in progress', () => {
    const answers = {
      eligibility_0: 'yes',
      eligibility_1: 'unsure',
      eligibility_2: 'yes',
      doc_0: 'yes',
      doc_1: 'yes',
      doc_2: 'in_progress',
    };

    const evaluation = evaluateApplicationReadiness(mockService, answers);
    expect(evaluation.status).toBe('CONDITIONAL_UNCERTAIN');
    expect(evaluation.isReady).toBe(false);
    expect(evaluation.uncertainRules.length).toBe(2);
  });

  it('abstains when catalogue contains contradictory requirements', () => {
    const contradictoryService = {
      id: 'conflict-01',
      name: 'Universal Pension Grant',
      description: 'Open to all citizens and zero documentation required.',
      eligibility: ['Annual household income below poverty line'],
      documents: ['Birth certificate', 'Income certificate'],
    };

    const questionnaire = buildReadinessQuestionnaire(contradictoryService);
    expect(questionnaire.hasContradictions).toBe(true);

    const evaluation = evaluateApplicationReadiness(contradictoryService, {});
    expect(evaluation.status).toBe('ABSTAINED_CONTRADICTORY_CATALOGUE');
    expect(evaluation.isReady).toBe(false);
    expect(evaluation.abstainReason).toContain('contradictory');
    expect(evaluation.contradictions.length).toBeGreaterThan(0);
  });

  it('abstains when catalogue has missing criteria or empty record', () => {
    const emptyService = { id: 'empty-01', name: 'Barebones Service' };
    const questionnaire = buildReadinessQuestionnaire(emptyService);
    expect(questionnaire.isValid).toBe(false);

    const evaluation = evaluateApplicationReadiness(emptyService, {});
    expect(evaluation.status).toBe('ABSTAINED_NO_CRITERIA');
    expect(evaluation.isReady).toBe(false);
    expect(evaluation.abstainReason).toContain('does not provide structured eligibility');
  });

  it('reports unanswered items for incomplete questionnaire', () => {
    const answers = {
      eligibility_0: 'yes',
    };

    const evaluation = evaluateApplicationReadiness(mockService, answers);
    expect(evaluation.status).toBe('INCOMPLETE_QUESTIONNAIRE');
    expect(evaluation.answeredCount).toBe(1);
    expect(evaluation.unansweredCount).toBe(5);
  });

  it('provides a grounded official disclaimer', () => {
    const disclaimer = getOfficialDisclaimer(mockService);
    expect(disclaimer).toContain('nfsa.gov.in');
    expect(disclaimer).toContain('does not submit an application');
  });
});
