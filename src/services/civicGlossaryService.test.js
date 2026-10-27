import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGlossaryEntries,
  getGlossaryEntryById,
  searchCivicGlossary,
  explainFormField,
  submitGlossarySuggestion,
  getGlossarySuggestions,
  clearGlossarySuggestions,
  GLOSSARY_SUGGESTIONS_STORAGE_KEY,
} from './civicGlossaryService.js';
import { CIVIC_GLOSSARY } from '../data/civicGlossary.js';

const createMockStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
};

describe('civicGlossaryService (#142)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  describe('Retrieval & Abbreviations Search', () => {
    it('returns published glossary entries', () => {
      const entries = getGlossaryEntries();
      expect(entries.length).toBeGreaterThanOrEqual(10);
      expect(entries[0]).toHaveProperty('term');
      expect(entries[0]).toHaveProperty('simpleMeaning');
    });

    it('resolves an entry by exact ID, term, or abbreviation', () => {
      // By ID
      const byId = getGlossaryEntryById('affidavit');
      expect(byId).not.toBeNull();
      expect(byId.term).toBe('Affidavit');

      // By Term
      const byTerm = getGlossaryEntryById('Encumbrance Certificate (EC)');
      expect(byTerm).not.toBeNull();
      expect(byTerm.id).toBe('encumbrance');

      // By Abbreviation
      const byAbbr = getGlossaryEntryById('NOC');
      expect(byAbbr).not.toBeNull();
      expect(byAbbr.id).toBe('noc');

      const byIfsc = getGlossaryEntryById('IFSC');
      expect(byIfsc).not.toBeNull();
      expect(byIfsc.id).toBe('ifsc');
    });

    it('searches by common abbreviations and administrative acronyms', () => {
      const resultsEws = searchCivicGlossary('EWS');
      expect(resultsEws.length).toBeGreaterThan(0);
      expect(resultsEws[0].id).toBe('ews');

      const resultsEc = searchCivicGlossary('EC');
      expect(resultsEc.some((i) => i.id === 'encumbrance')).toBe(true);

      const resultsMicr = searchCivicGlossary('MICR');
      expect(resultsMicr.length).toBeGreaterThan(0);
      expect(resultsMicr[0].id).toBe('micr');
    });

    it('includes reviewed official source citations in entries', () => {
      const entries = getGlossaryEntries();
      for (const entry of entries) {
        expect(entry).toHaveProperty('reviewedSource');
        expect(entry.reviewedSource).toHaveProperty('name');
        expect(entry.reviewedSource).toHaveProperty('url');
        expect(entry.reviewedSource.url).toMatch(/^https?:\/\//);
      }
    });
  });

  describe('explainFormField - Acceptance Criteria & Safe Fallback', () => {
    it('returns plain-language explanation and context for known field terms', () => {
      const result = explainFormField('Affidavit');
      expect(result.found).toBe(true);
      expect(result.entry.term).toBe('Affidavit');
      expect(result.entry.simpleMeaning).toBeDefined();
      expect(result.entry.context).toBeDefined();
    });

    it('produces a safe fallback rather than an AI-invented legal definition for unknown terms', () => {
      const unknownTerm = 'XYZ_Arbitrary_Nonexistent_Municipal_Tax_Form_99';
      const result = explainFormField(unknownTerm);

      expect(result.found).toBe(false);
      expect(result.safeFallback).toBeDefined();
      expect(result.safeFallback.definition).toContain('No verified official definition found');
      // Verifies no invented legal advice
      expect(result.safeFallback.disclaimer).toContain('strictly refuses to generate unverified');
      expect(result.safeFallback.disclaimer).toContain('AI-invented legal definitions');
      expect(result.safeFallback.canSuggest).toBe(true);
    });

    it('safely handles null or blank input', () => {
      const emptyResult = explainFormField('');
      expect(emptyResult.found).toBe(false);
      expect(emptyResult.safeFallback.title).toBe('Unknown Field');
    });
  });

  describe('User Suggestion Submission - Separation of Concerns', () => {
    it('validates required fields on suggestions', () => {
      // Empty term
      const noTerm = submitGlossarySuggestion({}, mockStorage);
      expect(noTerm.ok).toBe(false);
      expect(noTerm.error).toContain('Term or field name is required');

      // Short definition
      const shortDef = submitGlossarySuggestion({ term: 'Test Term', suggestedDefinition: 'too short' }, mockStorage);
      expect(shortDef.ok).toBe(false);
      expect(shortDef.error).toContain('at least 10 characters');

      // Missing rationale
      const noRationale = submitGlossarySuggestion(
        {
          term: 'Test Term',
          suggestedDefinition: 'A comprehensive valid explanation that is long enough.',
          rationale: 'abc', // under 5 chars
        },
        mockStorage
      );
      expect(noRationale.ok).toBe(false);
      expect(noRationale.error).toContain('reason or source reference');
    });

    it('successfully records suggestion in storage queue and does NOT mutate published definitions', () => {
      const originalAffidavitMeaning = CIVIC_GLOSSARY.find((g) => g.id === 'affidavit').simpleMeaning;

      const submission = submitGlossarySuggestion(
        {
          term: 'Affidavit',
          termId: 'affidavit',
          suggestedDefinition: 'Proposed user definition that should be reviewed by moderators.',
          rationale: 'Official government circular dated 2026.',
          userContact: 'citizen@example.gov',
        },
        mockStorage
      );

      expect(submission.ok).toBe(true);
      expect(submission.suggestionId).toBeDefined();

      // Verify stored in queue
      const saved = getGlossarySuggestions(mockStorage);
      expect(saved.length).toBe(1);
      expect(saved[0].term).toBe('Affidavit');
      expect(saved[0].status).toBe('pending_editorial_review');

      // Crucial acceptance check: Published definition in CIVIC_GLOSSARY must remain intact!
      const currentAffidavit = CIVIC_GLOSSARY.find((g) => g.id === 'affidavit');
      expect(currentAffidavit.simpleMeaning).toBe(originalAffidavitMeaning);
    });

    it('clears suggestions correctly', () => {
      submitGlossarySuggestion(
        {
          term: 'Test Term',
          suggestedDefinition: 'Valid explanation meeting length requirements.',
          rationale: 'Valid official source reference.',
        },
        mockStorage
      );

      expect(getGlossarySuggestions(mockStorage).length).toBe(1);
      clearGlossarySuggestions(mockStorage);
      expect(getGlossarySuggestions(mockStorage).length).toBe(0);
    });
  });
});
