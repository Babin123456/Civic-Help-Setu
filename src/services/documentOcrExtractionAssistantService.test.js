import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_DOC_TYPES,
  maskSensitiveField,
  classifyDocumentType,
  extractDocumentFields,
  checkServiceRequirements,
  processDocumentLocally,
  LEGAL_DISCLAIMER,
} from './documentOcrExtractionAssistantService.js';

describe('Privacy-Preserving Document OCR Extraction Assistant', () => {
  it('masks Aadhaar and PAN numbers correctly to prevent PII leakage', () => {
    const maskedAadhaar = maskSensitiveField('5432 1234 9876', SUPPORTED_DOC_TYPES.AADHAAR);
    expect(maskedAadhaar).toBe('XXXX-XXXX-9876');

    const maskedPan = maskSensitiveField('ABCDE1234F', SUPPORTED_DOC_TYPES.PAN);
    expect(maskedPan).toBe('ABXXXXXX4F');
  });

  it('classifies Aadhaar card text', () => {
    const ocrText = `
    GOVERNMENT OF INDIA
    Unique Identification Authority of India (UIDAI)
    Name: Ramesh Sharma
    DOB: 12/05/1985
    5432 1234 9876
    `;

    const classification = classifyDocumentType(ocrText);
    expect(classification.docType).toBe(SUPPORTED_DOC_TYPES.AADHAAR);
    expect(classification.confidence).toBeGreaterThan(0.8);
  });

  it('classifies PAN card text', () => {
    const ocrText = `
    INCOME TAX DEPARTMENT
    GOVT OF INDIA PAN
    Permanent Account Number
    Name: Ananya Roy
    DOB: 24/09/1992
    BKZPR4821M
    `;

    const classification = classifyDocumentType(ocrText);
    expect(classification.docType).toBe(SUPPORTED_DOC_TYPES.PAN);
  });

  it('extracts structured fields with bounding boxes and masked values', () => {
    const ocrText = `
    GOVERNMENT OF INDIA
    Unique Identification Authority of India
    Name: Ramesh Sharma
    DOB: 12/05/1985
    5432 1234 9876
    Valid Till: 31/12/2030
    `;

    const fields = extractDocumentFields(ocrText, SUPPORTED_DOC_TYPES.AADHAAR);
    expect(fields.length).toBeGreaterThanOrEqual(3);

    const nameField = fields.find((f) => f.fieldKey === 'fullName');
    expect(nameField.rawValue).toBe('Ramesh Sharma');
    expect(nameField.boundingBox).toBeDefined();

    const aadhaarField = fields.find((f) => f.fieldKey === 'aadhaarNumber');
    expect(aadhaarField.maskedValue).toBe('XXXX-XXXX-9876');
  });

  it('evaluates service checklist requirements without deciding legal eligibility', () => {
    const extractedFields = [
      { fieldKey: 'fullName', maskedValue: 'Ramesh Sharma', confidence: 0.9 },
      { fieldKey: 'dateOfBirth', maskedValue: '12/05/1985', confidence: 0.92 },
    ];

    const requirements = [
      { key: 'fullName', label: 'Applicant Name', required: true },
      { key: 'dateOfBirth', label: 'Date of Birth Proof', required: true },
      { key: 'validUntil', label: 'Document Expiry Date', required: true },
    ];

    const result = checkServiceRequirements(extractedFields, requirements);
    expect(result.satisfied).toBe(false);
    expect(result.missingRequirements.length).toBe(1);
    expect(result.missingRequirements[0].key).toBe('validUntil');
    expect(result.disclaimer).toBe(LEGAL_DISCLAIMER);
  });

  it('processes document end-to-end with zero-retention guarantee', () => {
    const ocrText = `
    INCOME TAX DEPARTMENT
    GOVT OF INDIA PAN
    Name: Anita Rao
    DOB: 14/08/1988
    ABCDE1234F
    `;

    const result = processDocumentLocally(ocrText, [
      { key: 'fullName', label: 'Full Name', required: true },
    ]);

    expect(result.docType).toBe(SUPPORTED_DOC_TYPES.PAN);
    expect(result.retentionPolicy).toBe('ZERO_RETENTION_CLIENT_ONLY');
    expect(result.disclaimer).toContain('does not declare legal eligibility');
    expect(result.checklist.satisfied).toBe(true);
  });
});
