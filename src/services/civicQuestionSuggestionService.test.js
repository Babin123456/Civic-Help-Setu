import { describe, it, expect } from 'vitest';
import {
  GENERIC_FALLBACK_SUGGESTIONS,
  PAGE_CONTEXT_SUGGESTIONS,
  getCivicQuestionSuggestions,
  generateServiceSpecificSuggestions,
  deduplicateSuggestions,
  isSafeCivicSuggestion,
} from './civicQuestionSuggestionService.js';

describe('civicQuestionSuggestionService', () => {
  describe('Generic fallback suggestions', () => {
    it('returns the default fallback set when no context is provided', () => {
      const suggestions = getCivicQuestionSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThanOrEqual(4);
      expect(suggestions).toContain('Which documents are usually needed for this service?');
      expect(suggestions).toContain('Where can I find the official application link?');
    });

    it('returns generic fallback when serviceId is unknown or invalid', () => {
      const suggestions = getCivicQuestionSuggestions({ serviceId: 'non-existent-service-slug' });
      expect(suggestions).toEqual(GENERIC_FALLBACK_SUGGESTIONS);
    });

    it('returns generic fallback when empty options object is passed', () => {
      const suggestions = getCivicQuestionSuggestions({});
      expect(suggestions).toEqual(GENERIC_FALLBACK_SUGGESTIONS);
    });
  });

  describe('Service-specific suggestions', () => {
    const mockService = {
      id: 'driving-license',
      name: 'Driving License',
      department: 'Transport Department',
      steps: [{ title: 'Apply online' }],
      warnings: ['Late fees may apply'],
    };

    it('generates questions tailored to a provided service object', () => {
      const suggestions = getCivicQuestionSuggestions({ service: mockService });

      expect(suggestions).toContain('Which documents are usually needed for Driving License?');
      expect(suggestions).toContain('Where can I find the official application link for Driving License?');
      expect(suggestions).toContain('What are the typical fees and processing time for Driving License?');
      expect(suggestions).toContain('What are the general eligibility requirements for Driving License?');
      expect(suggestions).toContain('What are the step-by-step application instructions for Driving License?');
      expect(suggestions).toContain('Which department is responsible for processing Driving License?');
    });

    it('looks up service by serviceId from the catalogue', () => {
      const suggestions = getCivicQuestionSuggestions({ serviceId: 'birth-certificate' });

      expect(suggestions.some((q) => q.includes('Birth Certificate'))).toBe(true);
      expect(suggestions).toContain('Which documents are usually needed for Birth Certificate?');
      expect(suggestions).toContain('Where can I find the official application link for Birth Certificate?');
    });
  });

  describe('Page-context suggestions', () => {
    it('returns tracking-specific questions when page is track', () => {
      const suggestions = getCivicQuestionSuggestions({ page: 'track' });
      expect(suggestions).toEqual(PAGE_CONTEXT_SUGGESTIONS.track);
      expect(suggestions.some((q) => q.toLowerCase().includes('track'))).toBe(true);
    });

    it('returns eligibility-specific questions when page is eligibility', () => {
      const suggestions = getCivicQuestionSuggestions({ page: 'eligibility' });
      expect(suggestions).toEqual(PAGE_CONTEXT_SUGGESTIONS.eligibility);
      expect(suggestions.some((q) => q.toLowerCase().includes('eligibility'))).toBe(true);
    });

    it('prioritizes service context over generic page context when both are given', () => {
      const suggestions = getCivicQuestionSuggestions({
        serviceId: 'birth-certificate',
        page: 'track',
      });
      expect(suggestions.some((q) => q.includes('Birth Certificate'))).toBe(true);
    });
  });

  describe('Deduplication', () => {
    it('removes duplicate questions in the same list', () => {
      const duplicates = [
        'Which documents are usually needed for this service?',
        'which documents are usually needed for this service? ',
        'Where can I find the official application link?',
        'Where can I find the official application link?',
      ];
      const result = deduplicateSuggestions(duplicates);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        'Which documents are usually needed for this service?',
        'Where can I find the official application link?',
      ]);
    });

    it('does not produce duplicate suggestions when custom questions overlap', () => {
      const suggestions = getCivicQuestionSuggestions({
        customQuestions: [
          'Which documents are usually needed for this service?',
          'What are the typical fees and processing time?',
          'How do I contact the helpline?',
        ],
      });
      const counts = new Map();
      suggestions.forEach((q) => {
        const lower = q.toLowerCase();
        counts.set(lower, (counts.get(lower) || 0) + 1);
      });

      for (const count of counts.values()) {
        expect(count).toBe(1);
      }
      expect(suggestions).toContain('How do I contact the helpline?');
    });
  });

  describe('Safety & Policy: No guaranteed eligibility or approval language', () => {
    it('validates safe exploratory questions', () => {
      expect(isSafeCivicSuggestion('Which documents are usually needed for this service?')).toBe(true);
      expect(isSafeCivicSuggestion('What are the general eligibility requirements for Driving License?')).toBe(true);
      expect(isSafeCivicSuggestion('Where can I find the official application link?')).toBe(true);
    });

    it('rejects suggestions implying an application is approved', () => {
      expect(isSafeCivicSuggestion('Your application has been approved. How to download?')).toBe(false);
      expect(isSafeCivicSuggestion('Download your approved certificate now')).toBe(false);
      expect(isSafeCivicSuggestion('Confirm that your approval is confirmed')).toBe(false);
    });

    it('rejects suggestions implying guaranteed eligibility', () => {
      expect(isSafeCivicSuggestion('How do I claim my guaranteed eligibility?')).toBe(false);
      expect(isSafeCivicSuggestion('Check why eligibility is guaranteed for all residents')).toBe(false);
      expect(isSafeCivicSuggestion('Get guaranteed approval for your loan')).toBe(false);
    });

    it('ensures all generic and service-specific suggestions pass safety validation', () => {
      GENERIC_FALLBACK_SUGGESTIONS.forEach((q) => {
        expect(isSafeCivicSuggestion(q)).toBe(true);
      });

      const serviceSuggestions = generateServiceSpecificSuggestions({ name: 'Ration Card' });
      serviceSuggestions.forEach((q) => {
        expect(isSafeCivicSuggestion(q)).toBe(true);
      });
    });
  });
});

