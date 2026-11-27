import { describe, it, expect, beforeEach } from 'vitest';
import { CivicFormEvidenceBindingService } from './civicFormEvidenceBindingService.js';

describe('CivicFormEvidenceBindingService', () => {
  let service;

  beforeEach(() => {
    service = new CivicFormEvidenceBindingService();
  });

  const sampleSchema = {
    id: 'form_voter_id_ka_06',
    title: 'Form 6: Application for Inclusion of Name in Electoral Roll',
    fields: [
      { id: 'applicant_name', label: 'Full Legal Name', type: 'text' },
      { id: 'dob', label: 'Date of Birth', type: 'date' },
      { id: 'residential_address', label: 'Present Ordinary Residence Address', type: 'text' },
      { id: 'pincode', label: 'Postal PIN Code', type: 'text' },
      { id: 'disability_category', label: 'Optional Disability Benchmark', type: 'text' }
    ]
  };

  const sampleRecords = [
    {
      id: 'doc_aadhaar_01',
      title: 'Aadhaar e-KYC Card',
      content: 'Name: Rajesh Kumar Sharma\nDOB: 14/08/1992\nAddress: Flat 402, Green Glen Layout, Bellandur, Bengaluru 560103\nGender: Male'
    }
  ];

  it('binds form fields with high confidence and excerpt citations', () => {
    const result = service.bindFormFieldsToEvidence(sampleSchema, sampleRecords);

    expect(result.totalFields).toBe(5);
    expect(result.autoBoundCount).toBe(4);
    expect(result.unresolvedCount).toBe(1);
    expect(result.canAutoSubmit).toBe(false);

    const nameField = result.fields.find(f => f.fieldId === 'applicant_name');
    expect(nameField.proposedValue).toBe('Rajesh Kumar Sharma');
    expect(nameField.evidenceBinding.documentTitle).toBe('Aadhaar e-KYC Card');
    expect(nameField.confidence).toBeGreaterThan(0.9);

    const unresolvedField = result.fields.find(f => f.fieldId === 'disability_category');
    expect(unresolvedField.status).toBe('UNRESOLVED_MANUAL_INPUT_REQUIRED');
  });

  it('permits citizen to confirm and update proposed values', () => {
    const result = service.bindFormFieldsToEvidence(sampleSchema, sampleRecords);
    const updated = service.confirmFieldValue(result, 'applicant_name', 'Rajesh K Sharma');

    const confirmedField = updated.fields.find(f => f.fieldId === 'applicant_name');
    expect(confirmedField.proposedValue).toBe('Rajesh K Sharma');
    expect(confirmedField.isUserVerified).toBe(true);
    expect(confirmedField.status).toBe('CITIZEN_CONFIRMED');
  });
});
