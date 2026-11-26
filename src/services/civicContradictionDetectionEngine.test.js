import { describe, it, expect } from 'vitest';
import {
  parseAndNormalizeDate,
  normalizeName,
  indicPhoneticKey,
  isInitialsExpansion,
  computeLevenshteinDistance,
  isSuspectOcrConfusion,
  compareBirthDates,
  compareNames,
  compareReferenceNumbers,
  compareChronology,
  detectAllContradictions,
} from './civicContradictionDetectionEngine';
import {
  FACT_TYPES,
  CONFLICT_TYPES,
  CONFLICT_SEVERITIES,
} from './civicEvidenceGraphSchemas';
import {
  SYNTHETIC_NAME_VARIATION_PAIRS,
  SYNTHETIC_OCR_CONFUSION_PAIRS,
} from '../../tests/fixtures/syntheticEvidenceFixtures';

describe('civicContradictionDetectionEngine', () => {
  describe('Date normalization and parsing', () => {
    it('parses Indian DD/MM/YYYY dates', () => {
      const res = parseAndNormalizeDate('15/08/1988');
      expect(res).not.toBeNull();
      expect(res.isoDate).toBe('1988-08-15');
      expect(res.day).toBe(15);
      expect(res.month).toBe(8);
      expect(res.year).toBe(1988);
    });

    it('parses hyphenated and dotted dates', () => {
      expect(parseAndNormalizeDate('01-07-1995')?.isoDate).toBe('1995-07-01');
      expect(parseAndNormalizeDate('31.12.2000')?.isoDate).toBe('2000-12-31');
    });

    it('handles ISO format YYYY-MM-DD', () => {
      expect(parseAndNormalizeDate('1990-05-24')?.isoDate).toBe('1990-05-24');
    });

    it('returns null on invalid or non-date strings', () => {
      expect(parseAndNormalizeDate('')).toBeNull();
      expect(parseAndNormalizeDate('NotADate')).toBeNull();
      expect(parseAndNormalizeDate('45/15/2020')).toBeNull();
    });
  });

  describe('Name normalization, transliteration & initials', () => {
    it('strips honorifics and extra whitespace', () => {
      expect(normalizeName('Shri Ramesh Kumar')).toBe('ramesh kumar');
      expect(normalizeName('Smt. Lakshmi Devi')).toBe('lakshmi devi');
      expect(normalizeName('Dr. A. P. J. Kalam')).toBe('a p j kalam');
    });

    it('recognizes Indic phonetic transliteration pairs', () => {
      expect(indicPhoneticKey('Lakshmi')).toBe(indicPhoneticKey('Laxmi'));
      expect(indicPhoneticKey('Choudhary')).toBe(indicPhoneticKey('Chowdhury'));
      expect(indicPhoneticKey('Vijay')).toBe(indicPhoneticKey('Wijay'));
      expect(indicPhoneticKey('Mukherjee')).toBe(indicPhoneticKey('Mookherjee'));
    });

    it('detects initials expansions accurately', () => {
      expect(isInitialsExpansion('K. Suresh', 'Kumar Suresh')).toBe(true);
      expect(isInitialsExpansion('Ramesh K', 'Ramesh Kumar')).toBe(true);
      expect(isInitialsExpansion('Amit Shah', 'Deepak Sharma')).toBe(false);
    });

    it('processes synthetic name variation pairs', () => {
      for (const pair of SYNTHETIC_NAME_VARIATION_PAIRS) {
        const factA = {
          id: 'fa',
          factType: FACT_TYPES.FULL_NAME,
          rawValue: pair.nameA,
          provenance: { documentType: 'DOC_A' },
        };
        const factB = {
          id: 'fb',
          factType: FACT_TYPES.FULL_NAME,
          rawValue: pair.nameB,
          provenance: { documentType: 'DOC_B' },
        };
        const conflict = compareNames(factA, factB);
        if (pair.expectedMatch === 'EXACT_VALUE_MISMATCH') {
          expect(conflict?.conflictType).toBe(CONFLICT_TYPES.EXACT_VALUE_MISMATCH);
        } else {
          expect([
            CONFLICT_TYPES.PHONETIC_NEAR_MATCH,
            CONFLICT_TYPES.INITIALS_EXPANSION_VARIATION,
          ]).toContain(conflict?.conflictType);
          expect(conflict?.isFalseContradiction).toBe(true);
        }
      }
    });
  });

  describe('OCR glyph confusion detection', () => {
    it('identifies character confusions like O/0, I/1, S/5', () => {
      for (const pair of SYNTHETIC_OCR_CONFUSION_PAIRS) {
        const res = isSuspectOcrConfusion(pair.refA, pair.refB);
        expect(res).toBe(pair.isOcrConfusion);
      }
    });

    it('flags OCR confusion with WARNING instead of CRITICAL', () => {
      const factA = {
        id: 'fa',
        factType: FACT_TYPES.APPLICATION_ACK_NUMBER,
        rawValue: 'MH/2024/0981',
        provenance: { documentType: 'RECEIPT' },
      };
      const factB = {
        id: 'fb',
        factType: FACT_TYPES.APPLICATION_ACK_NUMBER,
        rawValue: 'MH/2024/O981',
        provenance: { documentType: 'NOTICE' },
      };
      const res = compareReferenceNumbers(factA, factB);
      expect(res?.conflictType).toBe(CONFLICT_TYPES.SUSPECT_OCR_CONFUSION);
      expect(res?.severity).toBe(CONFLICT_SEVERITIES.WARNING);
      expect(res?.isFalseContradiction).toBe(true);
    });
  });

  describe('Birth date contradictions', () => {
    it('detects critical DOB mismatch', () => {
      const factA = {
        id: 'fa',
        factType: FACT_TYPES.DATE_OF_BIRTH,
        rawValue: '15/08/1988',
        provenance: { documentType: 'AADHAAR' },
      };
      const factB = {
        id: 'fb',
        factType: FACT_TYPES.DATE_OF_BIRTH,
        rawValue: '15/08/1989',
        provenance: { documentType: 'CERTIFICATE' },
      };
      const res = compareBirthDates(factA, factB);
      expect(res?.conflictType).toBe(CONFLICT_TYPES.EXACT_VALUE_MISMATCH);
      expect(res?.severity).toBe(CONFLICT_SEVERITIES.CRITICAL);
      expect(res?.isFalseContradiction).toBe(false);
    });

    it('detects day/month transposition with low OCR confidence', () => {
      const factA = {
        id: 'fa',
        factType: FACT_TYPES.DATE_OF_BIRTH,
        rawValue: '06/12/1990',
        provenance: { documentType: 'DOC_1', ocrConfidence: 0.70 },
      };
      const factB = {
        id: 'fb',
        factType: FACT_TYPES.DATE_OF_BIRTH,
        rawValue: '12/06/1990',
        provenance: { documentType: 'DOC_2', ocrConfidence: 0.75 },
      };
      const res = compareBirthDates(factA, factB);
      expect(res?.conflictType).toBe(CONFLICT_TYPES.SUSPECT_OCR_CONFUSION);
      expect(res?.severity).toBe(CONFLICT_SEVERITIES.WARNING);
      expect(res?.isFalseContradiction).toBe(true);
    });
  });

  describe('Chronology violations', () => {
    it('flags certificate expiry date that occurs before issuance date', () => {
      const factIssuance = {
        id: 'f-issue',
        factType: FACT_TYPES.ISSUANCE_DATE,
        rawValue: '2024-01-01',
        provenance: { documentId: 'doc-1' },
      };
      const factExpiry = {
        id: 'f-exp',
        factType: FACT_TYPES.EXPIRY_DATE,
        rawValue: '2022-01-01',
        provenance: { documentId: 'doc-1' },
      };
      const res = compareChronology(factIssuance, factExpiry);
      expect(res?.conflictType).toBe(CONFLICT_TYPES.CHRONOLOGY_VIOLATION);
      expect(res?.severity).toBe(CONFLICT_SEVERITIES.CRITICAL);
    });
  });

  describe('detectAllContradictions on batch facts', () => {
    it('processes multiple facts and generates conflict edges', () => {
      const facts = [
        {
          id: 'f1',
          factType: FACT_TYPES.DATE_OF_BIRTH,
          rawValue: '15/08/1988',
          provenance: { documentId: 'doc-1', documentType: 'AADHAAR' },
        },
        {
          id: 'f2',
          factType: FACT_TYPES.DATE_OF_BIRTH,
          rawValue: '15/08/1989',
          provenance: { documentId: 'doc-2', documentType: 'SCHOOL_CERT' },
        },
        {
          id: 'f3',
          factType: FACT_TYPES.FULL_NAME,
          rawValue: 'Lakshmi Devi',
          provenance: { documentId: 'doc-1', documentType: 'AADHAAR' },
        },
        {
          id: 'f4',
          factType: FACT_TYPES.FULL_NAME,
          rawValue: 'Laxmi Devi',
          provenance: { documentId: 'doc-2', documentType: 'SCHOOL_CERT' },
        },
      ];

      const edges = detectAllContradictions(facts);
      expect(edges).toHaveLength(2);

      const dobEdge = edges.find((e) => e.factType === FACT_TYPES.DATE_OF_BIRTH);
      expect(dobEdge?.conflictType).toBe(CONFLICT_TYPES.EXACT_VALUE_MISMATCH);
      expect(dobEdge?.severity).toBe(CONFLICT_SEVERITIES.CRITICAL);

      const nameEdge = edges.find((e) => e.factType === FACT_TYPES.FULL_NAME);
      expect(nameEdge?.conflictType).toBe(CONFLICT_TYPES.PHONETIC_NEAR_MATCH);
      expect(nameEdge?.severity).toBe(CONFLICT_SEVERITIES.WARNING);
    });

    it('returns empty array when fewer than 2 facts provided', () => {
      expect(detectAllContradictions([])).toEqual([]);
      expect(detectAllContradictions([{ id: 'f1' }])).toEqual([]);
    });
  });
});
