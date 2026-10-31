import { describe, it, expect } from 'vitest';
import {
  DOCUMENT_CATEGORIES,
  getDocumentTypeGuidance,
  getServiceDocumentGuidance,
} from './documentTypeGuidanceService';

describe('documentTypeGuidanceService (#405)', () => {
  it('defines standard civil document categories with rules and examples', () => {
    expect(DOCUMENT_CATEGORIES.IDENTITY_PROOF).toBeDefined();
    expect(DOCUMENT_CATEGORIES.ADDRESS_PROOF).toBeDefined();
    expect(DOCUMENT_CATEGORIES.INCOME_PROOF).toBeDefined();
    expect(DOCUMENT_CATEGORIES.LAND_PROPERTY_PROOF).toBeDefined();
    expect(DOCUMENT_CATEGORIES.IDENTITY_PROOF.commonExamples.length).toBeGreaterThan(2);
    expect(DOCUMENT_CATEGORIES.IDENTITY_PROOF.generalRule).toBeTruthy();
  });

  it('maps identity proof requirements accurately', () => {
    const guidance = getDocumentTypeGuidance('Aadhaar Card (UIDAI)');
    expect(guidance.isAmbiguous).toBe(false);
    expect(guidance.category).toBe('identity_proof');
    expect(guidance.categoryName).toContain('Proof of Identity');
    expect(guidance.acceptableExamples).toContain('Aadhaar Card (UIDAI / masked e-Aadhaar)');
    expect(guidance.officialRule).toContain('Must contain full official legal name');
  });

  it('maps address proof requirements and provides distinct rules vs examples', () => {
    const guidance = getDocumentTypeGuidance('Recent Electricity Bill (under 3 months)');
    expect(guidance.isAmbiguous).toBe(false);
    expect(guidance.category).toBe('address_proof');
    expect(guidance.officialRule).toMatch(/address on the document must exactly match/i);
    expect(guidance.acceptableExamples.length).toBeGreaterThan(0);
    expect(guidance.unacceptableExamples.length).toBeGreaterThan(0);
  });

  it('maps income, age, land records, and disability proofs correctly', () => {
    const incomeGuidance = getDocumentTypeGuidance('Income Certificate from Tehsildar');
    expect(incomeGuidance.category).toBe('income_proof');

    const landGuidance = getDocumentTypeGuidance('Khasra and Khatauni Land Record');
    expect(landGuidance.category).toBe('land_property_proof');

    const disabilityGuidance = getDocumentTypeGuidance('UDID Disability Card');
    expect(disabilityGuidance.category).toBe('disability_medical_proof');

    const casteGuidance = getDocumentTypeGuidance('OBC Caste Certificate');
    expect(casteGuidance.category).toBe('caste_community_proof');
  });

  it('flags ambiguous or unrecognized requirement and prompts department confirmation', () => {
    const guidance = getDocumentTypeGuidance('Special Environmental NOC Form 14A');
    expect(guidance.isAmbiguous).toBe(true);
    expect(guidance.category).toBe('custom_or_ambiguous');
    expect(guidance.categoryName).toContain('Department-Specific or Ambiguous');
    expect(guidance.confirmationNotice).toMatch(/Ambiguity Alert/i);
    expect(guidance.confirmationNotice).toMatch(/confirm accepted document types directly with the department/i);
  });

  it('handles empty or whitespace-only requirement names safely', () => {
    const emptyGuidance = getDocumentTypeGuidance('');
    expect(emptyGuidance.isAmbiguous).toBe(true);
    expect(emptyGuidance.confirmationNotice).toMatch(/verify with the issuing office/i);
  });

  it('analyzes full service requirements and summarizes ambiguous vs standard counts', () => {
    const mockService = {
      id: 'SRV-TEST-405',
      name: 'Agricultural Solar Pump Subsidy',
      documents: [
        'Aadhaar Card',
        'Electricity Bill',
        'Khasra Khatauni Copy',
        'Custom Regional Canal NOC Code 9',
      ],
    };

    const result = getServiceDocumentGuidance(mockService);
    expect(result.serviceId).toBe('SRV-TEST-405');
    expect(result.totalCount).toBe(4);
    expect(result.standardCount).toBe(3);
    expect(result.ambiguousCount).toBe(1);
    expect(result.hasAmbiguousRequirements).toBe(true);
    expect(result.privacyNotice).toMatch(/Zero Document Ingestion/i);
    expect(result.items[3].isAmbiguous).toBe(true);
  });
});
