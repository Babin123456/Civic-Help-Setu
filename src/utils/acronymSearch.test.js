import { describe, it, expect } from 'vitest';
import {
  searchAcronyms,
  getAcronymById,
  getAcronymByAcronym,
  resolveRelatedServices,
  validateAcronymData,
  getAllAcronyms,
  getAcronymCategory,
  getAcronymCategoryCounts,
  filterAcronyms,
  formatAcronymCitation,
  ACRONYM_CATEGORIES,
  ACRONYM_CATEGORY_LABELS,
} from './acronymSearch.js';
import { CIVIC_ACRONYMS } from '../data/civicAcronyms.js';

describe('acronymSearch (#263, #430)', () => {
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

    it('returns an empty array for an empty query by default', () => {
      expect(searchAcronyms('')).toEqual([]);
      expect(searchAcronyms('   ')).toEqual([]);
    });

    it('returns all entries when includeAllOnEmpty is true', () => {
      const all = searchAcronyms('', { includeAllOnEmpty: true });
      expect(all.length).toBe(CIVIC_ACRONYMS.length);
    });

    it('returns an empty array for an unmatched query', () => {
      expect(searchAcronyms('zzz_nonexistent_acronym_xyz')).toEqual([]);
    });

    it('returns an empty array for nullish input', () => {
      expect(searchAcronyms(null)).toEqual([]);
      expect(searchAcronyms(undefined)).toEqual([]);
    });
  });

  describe('getAllAcronyms', () => {
    it('returns all acronyms sorted alphabetically by acronym', () => {
      const list = getAllAcronyms('acronym-asc');
      expect(list.length).toBe(CIVIC_ACRONYMS.length);
      expect(list[0].acronym.localeCompare(list[1].acronym)).toBeLessThanOrEqual(0);
    });

    it('supports sorting in descending order', () => {
      const desc = getAllAcronyms('acronym-desc');
      expect(desc.length).toBe(CIVIC_ACRONYMS.length);
      expect(desc[0].acronym.localeCompare(desc[1].acronym)).toBeGreaterThanOrEqual(0);
    });

    it('supports sorting by expanded name', () => {
      const byName = getAllAcronyms('name-asc');
      expect(byName.length).toBe(CIVIC_ACRONYMS.length);
      expect(byName[0].expandedForm.localeCompare(byName[1].expandedForm)).toBeLessThanOrEqual(0);
    });
  });

  describe('Categorization and counts', () => {
    it('classifies known acronyms into their designated category', () => {
      expect(getAcronymCategory('uidai')).toBe(ACRONYM_CATEGORIES.IDENTITY);
      expect(getAcronymCategory('bpl')).toBe(ACRONYM_CATEGORIES.WELFARE);
      expect(getAcronymCategory('epfo')).toBe(ACRONYM_CATEGORIES.FINANCE);
      expect(getAcronymCategory('rti')).toBe(ACRONYM_CATEGORIES.GOVERNANCE);
    });

    it('falls back to governance category for unmapped acronyms', () => {
      expect(getAcronymCategory('unknown-code')).toBe(ACRONYM_CATEGORIES.GOVERNANCE);
    });

    it('counts categories accurately', () => {
      const counts = getAcronymCategoryCounts();
      expect(counts[ACRONYM_CATEGORIES.ALL]).toBe(CIVIC_ACRONYMS.length);
      expect(counts[ACRONYM_CATEGORIES.IDENTITY]).toBeGreaterThan(0);
      expect(counts[ACRONYM_CATEGORIES.WELFARE]).toBeGreaterThan(0);
      expect(counts[ACRONYM_CATEGORIES.FINANCE]).toBeGreaterThan(0);
      expect(counts[ACRONYM_CATEGORIES.GOVERNANCE]).toBeGreaterThan(0);
    });

    it('exposes defined human-readable category labels', () => {
      expect(ACRONYM_CATEGORY_LABELS[ACRONYM_CATEGORIES.IDENTITY]).toBe('Identity & KYC');
      expect(ACRONYM_CATEGORY_LABELS[ACRONYM_CATEGORIES.WELFARE]).toBe('Social Welfare & Benefits');
    });
  });

  describe('filterAcronyms', () => {
    it('filters by category correctly', () => {
      const welfareOnly = filterAcronyms({ category: ACRONYM_CATEGORIES.WELFARE });
      expect(welfareOnly.length).toBeGreaterThan(0);
      welfareOnly.forEach((entry) => {
        expect(getAcronymCategory(entry.id)).toBe(ACRONYM_CATEGORIES.WELFARE);
      });
    });

    it('filters by first letter correctly', () => {
      const bLetter = filterAcronyms({ letter: 'B' });
      expect(bLetter.length).toBeGreaterThan(0);
      bLetter.forEach((entry) => {
        expect(entry.acronym.toUpperCase().startsWith('B')).toBe(true);
      });
    });

    it('combines query, category, and letter filtering', () => {
      const results = filterAcronyms({
        query: 'Poverty',
        category: ACRONYM_CATEGORIES.WELFARE,
        letter: 'b',
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('bpl');
    });

    it('returns empty array when no entries match combined criteria', () => {
      const results = filterAcronyms({
        query: 'passport',
        category: ACRONYM_CATEGORIES.FINANCE,
      });
      expect(results).toEqual([]);
    });
  });

  describe('formatAcronymCitation', () => {
    it('formats citation text with acronym, expanded form and plain language definition', () => {
      const entry = getAcronymById('bpl');
      const citation = formatAcronymCitation(entry);
      expect(citation).toContain('BPL — Below Poverty Line');
      expect(citation).toContain('Definition:');
      expect(citation).toContain('Source: Civic Help Setu Verified Acronym Directory');
    });

    it('handles empty or null entry gracefully', () => {
      expect(formatAcronymCitation(null)).toBe('');
      expect(formatAcronymCitation({})).toBe('');
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
