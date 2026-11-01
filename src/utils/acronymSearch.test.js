import { describe, it, expect } from 'vitest';
import {
  searchAcronyms,
  getAcronymById,
  getAcronymByAcronym,
  resolveRelatedServices,
  validateAcronymData,
} from './acronymSearch.js';
import { CIVIC_ACRONYMS } from '../data/civicAcronyms.js';

describe('acronymSearch (#263)', () => {
  describe('searchAcronyms - case-insensitive & whitespace tolerant', () => {
    it('finds an acronym by exact uppercase acronym', () => {
      const results = searchAcronyms('NOC');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'noc')).toBe(true);
    });

    it('finds an acronym by lowercase acronym', () => {
      const results = searchAcronyms('noc');
      expect(results.some((r) => r.id === 'noc')).toBe(true);
    });

    it('finds an acronym by mixed case', () => {
      const results = searchAcronyms('NoC');
      expect(results.some((r) => r.id === 'noc')).toBe(true);
    });

    it('handles extra whitespace around the query', () => {
      const tight = searchAcronyms('EPFO');
      const spaced = searchAcronyms('  epfo  ');
      expect(spaced).toEqual(tight);
    });

    it('collapses internal whitespace', () => {
      const results = searchAcronyms('provident  fund');
      expect(results.some((r) => r.id === 'epfo')).toBe(true);
    });

    it('finds by expanded form phrase', () => {
      const results = searchAcronyms('below poverty line');
      expect(results.some((r) => r.id === 'bpl')).toBe(true);
    });

    it('finds by plain-language explanation keyword', () => {
      const results = searchAcronyms('reservation');
      expect(results.some((r) => r.id === 'ews')).toBe(true);
    });

    it('returns an empty array for an empty query', () => {
      expect(searchAcronyms('')).toEqual([]);
      expect(searchAcronyms('   ')).toEqual([]);
    });

    it('returns an empty array for an unmatched query', () => {
      expect(searchAcronyms('zzz_nonexistent_acronym_xyz')).toEqual([]);
    });

    it('returns an empty array for nullish input', () => {
      expect(searchAcronyms(null)).toEqual([]);
      expect(searchAcronyms(undefined)).toEqual([]);
    });
  });

  describe('getAcronymById', () => {
    it('resolves an entry by stable id', () => {
      const entry = getAcronymById('bpl');
      expect(entry).not.toBeNull();
      expect(entry.acronym).toBe('BPL');
    });

    it('returns null for unknown id', () => {
      expect(getAcronymById('nope')).toBeNull();
      expect(getAcronymById('')).toBeNull();
    });
  });

  describe('getAcronymByAcronym', () => {
    it('resolves an entry by exact acronym match case-insensitively', () => {
      const entry = getAcronymByAcronym('ifsc');
      expect(entry).not.toBeNull();
      expect(entry.id).toBe('ifsc');
    });

    it('does not substring-match on acronym lookup', () => {
      expect(getAcronymByAcronym('PO')).toBeNull();
    });

    it('returns null for unknown acronym', () => {
      expect(getAcronymByAcronym('XYZ')).toBeNull();
    });
  });

  describe('resolveRelatedServices', () => {
    it('resolves related service ids to valid catalogue records', () => {
      const entry = CIVIC_ACRONYMS.find((e) => e.id === 'bpl');
      const services = resolveRelatedServices(entry);
      expect(services.length).toBe(entry.relatedServiceIds.length);
      expect(services.map((s) => s.id)).toEqual(expect.arrayContaining(['ration-card', 'income-certificate']));
      services.forEach((s) => expect(s).toHaveProperty('name'));
    });

    it('skips service references that no longer exist', () => {
      const entry = {
        id: 'stale',
        acronym: 'STALE',
        expandedForm: 'Stale Example',
        plainLanguageExplanation: 'A stale entry.',
        relatedServiceIds: ['ration-card', 'does-not-exist-service'],
      };
      const services = resolveRelatedServices(entry);
      expect(services.length).toBe(1);
      expect(services[0].id).toBe('ration-card');
    });

    it('returns an empty array when there are no related services', () => {
      expect(resolveRelatedServices({ relatedServiceIds: [] })).toEqual([]);
      expect(resolveRelatedServices(null)).toEqual([]);
    });
  });

  describe('validateAcronymData - data integrity', () => {
    it('reports the curated dataset as valid', () => {
      const result = validateAcronymData();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects duplicate acronyms (case-insensitive)', () => {
      const entries = [
        ...CIVIC_ACRONYMS.slice(0, 2),
        { id: 'dup-1', acronym: 'NOC', expandedForm: 'No Objection Certificate', plainLanguageExplanation: 'A duplicate.', relatedServiceIds: ['passport'] },
      ];
      const result = validateAcronymData(entries);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'acronym' && e.reason.includes('Duplicate'))).toBe(true);
    });

    it('detects missing plain-language definitions', () => {
      const entries = [
        { id: 'no-def', acronym: 'XYZ', expandedForm: 'X Y Z', plainLanguageExplanation: '', relatedServiceIds: [] },
      ];
      const result = validateAcronymData(entries);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'plainLanguageExplanation')).toBe(true);
    });

    it('detects invalid service references', () => {
      const entries = [
        { id: 'bad-ref', acronym: 'BR', expandedForm: 'Bad Ref', plainLanguageExplanation: 'Explains it.', relatedServiceIds: ['ration-card', 'not-a-real-service'] },
      ];
      const result = validateAcronymData(entries);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'relatedServiceIds' && e.reason.includes('not-a-real-service'))).toBe(true);
    });
  });
});
