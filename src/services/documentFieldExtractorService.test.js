import { describe, it, expect } from 'vitest';
import {
  extractFieldsFromDocument,
  applyConfirmedAutofill,
} from './documentFieldExtractorService';

describe('documentFieldExtractorService (#478)', () => {
  const sampleAadhaarOcr = `
    GOVERNMENT OF INDIA
    Name: Ananya Roy
    DOB: 15/08/1992
    Gender: Female
    UID: 4567 8901 2345
    Address: Salt Lake, Kolkata, West Bengal PIN: 700091
  `;

  it('extracts candidate fields with confidence scoring from document text', () => {
    const fields = extractFieldsFromDocument(sampleAadhaarOcr);
    expect(fields.length).toBeGreaterThanOrEqual(4);

    const nameField = fields.find((f) => f.key === 'fullName');
    expect(nameField).toBeDefined();
    expect(nameField.extractedValue).toBe('Ananya Roy');
    expect(nameField.confidenceLevel).toBe('HIGH');

    const dobField = fields.find((f) => f.key === 'dob');
    expect(dobField).toBeDefined();
    expect(dobField.extractedValue).toBe('15/08/1992');

    const genderField = fields.find((f) => f.key === 'gender');
    expect(genderField).toBeDefined();
    expect(genderField.extractedValue.toLowerCase()).toBe('female');

    const pinField = fields.find((f) => f.key === 'pincode');
    expect(pinField).toBeDefined();
    expect(pinField.extractedValue).toBe('700091');
  });

  it('filters by requested field keys', () => {
    const fields = extractFieldsFromDocument(sampleAadhaarOcr, ['fullName', 'pincode']);
    expect(fields).toHaveLength(2);
    expect(fields.map((f) => f.key)).toEqual(['fullName', 'pincode']);
  });

  it('strictly applies only citizen-confirmed fields to target form', () => {
    const currentForm = { fullName: '', dob: '', state: '' };
    const extracted = [
      { key: 'fullName', extractedValue: 'Ananya Roy', confirmed: true },
      { key: 'dob', extractedValue: '15/08/1992', confirmed: false }, // not confirmed!
    ];

    const result = applyConfirmedAutofill(currentForm, extracted);
    expect(result.fullName).toBe('Ananya Roy');
    expect(result.dob).toBe(''); // remains empty because confirmed was false
  });

  it('handles empty or non-string input safely', () => {
    expect(extractFieldsFromDocument('')).toEqual([]);
    expect(extractFieldsFromDocument(null)).toEqual([]);
  });
});
