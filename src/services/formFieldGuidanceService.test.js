import { describe, it, expect } from 'vitest';
import {
  normalizeFieldLabel,
  matchFieldToRegistry,
  getFormFieldGuidance,
  extractCandidateFieldsFromService,
  STANDARD_FIELD_REGISTRY,
} from './formFieldGuidanceService';

describe('formFieldGuidanceService (#403)', () => {
  const mockService = {
    id: 'pm-kisan-portal',
    title: 'PM Kisan Samman Nidhi',
    documents: [
      'Aadhaar card of applicant',
      'Bank passbook copy',
      'Land ownership Khasra Khatauni document',
      'Domicile certificate of state',
    ],
  };

  describe('label normalization and matching', () => {
    it('normalizes field labels and matches standard registry entries', () => {
      expect(normalizeFieldLabel('  Aadhaar Number (UID) ')).toBe('aadhaar number uid');
      const match = matchFieldToRegistry('Bank IFSC Code');
      expect(match).toBeDefined();
      expect(match.id).toBe('bank_ifsc');
      expect(match.formatRule).toContain('11 characters');
    });

    it('returns null for empty or unrecognized labels in matcher', () => {
      expect(matchFieldToRegistry('')).toBeNull();
      expect(matchFieldToRegistry('unrelated_non_civic_key_1234')).toBeNull();
    });
  });

  describe('getFormFieldGuidance', () => {
    it('returns structured educational guidance for recognized fields', () => {
      const guidance = getFormFieldGuidance('Aadhaar Number', mockService);

      expect(guidance.isRecognized).toBe(true);
      expect(guidance.fieldLabel).toBe('Aadhaar Number');
      expect(guidance.meaning).toContain('Unique Identification Number');
      expect(guidance.formatRule).toContain('12 numeric digits');
      expect(guidance.whereToFind).toContain('Aadhaar card');
      expect(guidance.officialNotice).toContain('Civic Help Setu provides explanatory guidance');
    });

    it('flags complex revenue and caste fields for official confirmation', () => {
      const khasraGuidance = getFormFieldGuidance('Khasra / Khatauni Number', mockService);
      expect(khasraGuidance.isRecognized).toBe(true);
      expect(khasraGuidance.requiresOfficialConfirmation).toBe(true);

      const casteGuidance = getFormFieldGuidance('Caste Certificate No', mockService);
      expect(casteGuidance.requiresOfficialConfirmation).toBe(true);
      expect(casteGuidance.pitfalls).toContain('Central OBC format');
    });

    it('generates a safe fallback for unknown or ambiguous fields', () => {
      const unknownGuidance = getFormFieldGuidance('Custom Municipal Ward Tax Clearance Token', mockService);

      expect(unknownGuidance.isRecognized).toBe(false);
      expect(unknownGuidance.standardId).toBe('custom_field');
      expect(unknownGuidance.meaning).toContain('specific to this department');
      expect(unknownGuidance.requiresOfficialConfirmation).toBe(true);
      expect(unknownGuidance.whereToFind).toContain('PM Kisan Samman Nidhi');
    });

    it('handles empty input gracefully', () => {
      const fallback = getFormFieldGuidance('');
      expect(fallback.isRecognized).toBe(false);
      expect(fallback.fieldLabel).toBe('Unknown Field');
    });
  });

  describe('extractCandidateFieldsFromService', () => {
    it('extracts candidate fields based on service requirements and process steps', () => {
      const candidates = extractCandidateFieldsFromService(mockService);

      expect(candidates).toContain('Aadhaar Number');
      expect(candidates).toContain('Bank Account Number');
      expect(candidates).toContain('Bank IFSC Code');
      expect(candidates).toContain('Khasra / Khatauni Survey Number');
      expect(candidates).toContain('Domicile Certificate Number');
      expect(candidates).toContain('Pincode & Address');
    });

    it('returns minimal universal fields when service has no listed documents', () => {
      const candidates = extractCandidateFieldsFromService({});
      expect(candidates).toEqual(['Pincode & Address']);
    });
  });
});
