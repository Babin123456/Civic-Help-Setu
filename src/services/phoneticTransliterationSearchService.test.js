import { describe, it, expect } from 'vitest';
import {
  normalizeIndicPhonetic,
  computeIndicSoundex,
  resolveIndicCivicQuery,
  calculatePhoneticMatchScore,
  explainPhoneticMatch,
  INDIC_CIVIC_COLLOQUIAL_LEXICON,
} from './phoneticTransliterationSearchService.js';

describe('phoneticTransliterationSearchService (#435)', () => {
  describe('normalizeIndicPhonetic', () => {
    it('collapses double vowels like aa, ee, oo', () => {
      expect(normalizeIndicPhonetic('aadhaar')).toBe('adar');
      expect(normalizeIndicPhonetic('adhar')).toBe('adar');
      expect(normalizeIndicPhonetic('pariksha')).toBe('pariksa');
    });

    it('harmonizes aspirated consonants like kh, gh, th, dh, ph', () => {
      expect(normalizeIndicPhonetic('khatoni')).toBe('katoni');
      expect(normalizeIndicPhonetic('dakhil')).toBe('dakil');
      expect(normalizeIndicPhonetic('parivahan')).toBe('parivahan');
    });

    it('harmonizes sibilants like sh to s', () => {
      expect(normalizeIndicPhonetic('rashan')).toBe('rasan');
      expect(normalizeIndicPhonetic('ration')).toBe('ration');
    });
  });

  describe('computeIndicSoundex', () => {
    it('produces 5-character soundex codes', () => {
      const code = computeIndicSoundex('aadhaar');
      expect(code.length).toBe(5);
      expect(code.startsWith('A')).toBe(true);
    });

    it('produces matching soundex for phonetically identical terms', () => {
      const c1 = computeIndicSoundex('khatoni');
      const c2 = computeIndicSoundex('katoni');
      expect(c1).toBe(c2);
    });
  });

  describe('resolveIndicCivicQuery', () => {
    it('resolves "dakhil kharij" to property mutation keywords', () => {
      const res = resolveIndicCivicQuery('dakhil kharij process');
      expect(res.hasIndicMatch).toBe(true);
      expect(res.expandedKeywords).toContain('property');
      expect(res.expandedKeywords).toContain('mutation');
    });

    it('resolves "aay praman patra" to income certificate keywords', () => {
      const res = resolveIndicCivicQuery('aay praman patra online');
      expect(res.hasIndicMatch).toBe(true);
      expect(res.expandedKeywords).toContain('income');
      expect(res.expandedKeywords).toContain('certificate');
    });

    it('resolves "vriddha pension" to senior citizen keywords', () => {
      const res = resolveIndicCivicQuery('vriddha pension eligibility');
      expect(res.hasIndicMatch).toBe(true);
      expect(res.expandedKeywords).toContain('senior');
      expect(res.expandedKeywords).toContain('pension');
    });

    it('handles standard English queries with no Indic match', () => {
      const res = resolveIndicCivicQuery('driving license renew');
      expect(res.hasIndicMatch).toBe(false);
      expect(res.expandedKeywords).toEqual([]);
    });
  });

  describe('calculatePhoneticMatchScore', () => {
    it('awards high score for exact phonetic equivalent', () => {
      const score = calculatePhoneticMatchScore('adhar', 'Aadhaar Card Service');
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('awards 0 for completely unrelated words', () => {
      const score = calculatePhoneticMatchScore('passport', 'Electricity Utility Bill');
      expect(score).toBe(0);
    });
  });

  describe('explainPhoneticMatch', () => {
    it('explains match when an Indic colloquialism matches a service', () => {
      const service = {
        name: 'Property Tax & Mutation',
        category: 'Revenue',
        description: 'Apply for land records mutation.',
      };
      const explanation = explainPhoneticMatch('dakhil kharij', service);
      expect(explanation).not.toBeNull();
      expect(explanation).toContain('dakhil kharij');
      expect(explanation).toContain('Hindi term for property mutation');
    });

    it('returns null when no Indic colloquial match exists', () => {
      const service = { name: 'Passport Re-issue' };
      expect(explainPhoneticMatch('passport', service)).toBeNull();
    });
  });
});
