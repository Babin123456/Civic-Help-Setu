import { describe, it, expect } from 'vitest';
import {
  translateExplanationText,
  protectEntities,
  restoreEntities,
  doesNotOverwriteRecord,
  INFORMATIONAL_TRANSLATION_NOTICE,
  TRANSLATION_FALLBACK_MESSAGE,
} from './aiExplanationTranslationService';

describe('aiExplanationTranslationService', () => {
  describe('Empty input handling', () => {
    it('returns safe empty result when input is empty string', () => {
      const res = translateExplanationText('', 'hi');
      expect(res.isTranslated).toBe(false);
      expect(res.translatedText).toBe('');
      expect(res.status).toBe('empty');
      expect(res.error).toBeNull();
    });

    it('handles whitespace-only input safely', () => {
      const res = translateExplanationText('    ', 'bn');
      expect(res.isTranslated).toBe(false);
      expect(res.translatedText).toBe('');
      expect(res.status).toBe('empty');
    });

    it('handles null and undefined input gracefully', () => {
      expect(translateExplanationText(null, 'ta').status).toBe('empty');
      expect(translateExplanationText(undefined, 'hi').status).toBe('empty');
    });
  });

  describe('Translation failure handling and fallback', () => {
    it('shows fallback message and keeps original text when translation fails', () => {
      const original = 'Key prerequisite documents for Birth Certificate: Hospital proof.';
      const res = translateExplanationText(original, 'hi', { simulateFailure: true });

      expect(res.isTranslated).toBe(false);
      expect(res.status).toBe('error');
      expect(res.error).toContain('Translation service unavailable');
      expect(res.fallbackMessage).toBe(TRANSLATION_FALLBACK_MESSAGE);
      expect(res.translatedText).toBe(original);
      expect(res.originalText).toBe(original);
    });
  });

  describe('Preservation of critical entities', () => {
    it('preserves official names, dates, amounts, URLs, and document names in translation', () => {
      const text =
        'Official Fees for Birth Certificate: ₹20 - ₹100. Processing takes 14 days. Apply via https://services.india.gov.in with Aadhaar Card and UIDAI record.';

      const res = translateExplanationText(text, 'hi');

      expect(res.isTranslated).toBe(true);
      expect(res.status).toBe('success');

      // Amounts preserved
      expect(res.translatedText).toContain('₹20 - ₹100');

      // Dates and durations preserved
      expect(res.translatedText).toContain('14 days');

      // URLs preserved
      expect(res.translatedText).toContain('https://services.india.gov.in');

      // Document names preserved
      expect(res.translatedText).toContain('Birth Certificate');
      expect(res.translatedText).toContain('Aadhaar Card');

      // Official organization names preserved
      expect(res.translatedText).toContain('UIDAI');

      // Translated narrative phrases present
      expect(res.translatedText).toContain('के लिए आधिकारिक शुल्क:');
    });

    it('protectEntities and restoreEntities round-trip preserves exact tokens', () => {
      const text = 'Fee is ₹107 on https://uidai.gov.in verified on 2023-11-05 for PAN Card.';
      const { maskedText, tokensMap } = protectEntities(text);

      expect(maskedText).not.toContain('https://uidai.gov.in');
      expect(maskedText).not.toContain('₹107');

      const restored = restoreEntities(maskedText, tokensMap);
      expect(restored).toBe(text);
    });
  });

  describe('Informational labeling and keeping original text available', () => {
    it('clearly labels translations as informational and not official government notices', () => {
      const text = 'Estimated processing duration for Driving License: 30 days.';
      const res = translateExplanationText(text, 'ta');

      expect(res.isTranslated).toBe(true);
      expect(res.notice).toBe(INFORMATIONAL_TRANSLATION_NOTICE);
      expect(res.notice).toContain('Informational translation only');
      expect(res.notice).toContain('not an official government notice');
    });

    it('always keeps the original text available in the result', () => {
      const text = 'Most centers accept UPI, Netbanking, or Challan.';
      const res = translateExplanationText(text, 'bn');

      expect(res.originalText).toBe(text);
      expect(res.translatedText).not.toBe(text);
    });
  });

  describe('Official source record protection', () => {
    it('does not silently translate or overwrite official source records', () => {
      const officialServiceRecord = {
        id: 'birth-certificate',
        name: 'Birth Certificate',
        fees: '₹20 - ₹100',
        officialSources: [{ name: 'National Portal', url: 'https://services.india.gov.in' }],
      };

      const originalSnapshot = JSON.stringify(officialServiceRecord);

      const translation = translateExplanationText(
        `Official Fees for ${officialServiceRecord.name}: ${officialServiceRecord.fees}.`,
        'hi'
      );

      // Verify that translation did not mutate official record
      expect(doesNotOverwriteRecord(officialServiceRecord, translation)).toBe(true);
      expect(JSON.stringify(officialServiceRecord)).toBe(originalSnapshot);
    });
  });

  describe('Source language passthrough', () => {
    it('returns unmodified original text when target language is English', () => {
      const text = 'Key prerequisite documents for Aadhaar Card: Identity proof.';
      const res = translateExplanationText(text, 'en');

      expect(res.isTranslated).toBe(false);
      expect(res.status).toBe('source_language');
      expect(res.translatedText).toBe(text);
      expect(res.originalText).toBe(text);
    });
  });
});
