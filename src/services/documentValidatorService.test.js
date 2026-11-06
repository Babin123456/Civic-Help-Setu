import { describe, it, expect } from 'vitest';
import {
  validateVerhoeff,
  validateAadhaar,
  validatePan,
  validatePassport,
  validateVoterId,
  validateDrivingLicense,
  inspectDocumentFile,
  generatePreflightAudit,
  validatePreflightFile,
  STANDARD_PORTAL_LIMITS
} from './documentValidatorService';

describe('documentValidatorService - Verhoeff & Aadhaar Checks', () => {
  it('validates Verhoeff checksum correctly', () => {
    // Known valid Verhoeff test sample
    expect(validateVerhoeff('234567890124')).toBe(true);
    expect(validateVerhoeff('123456789012')).toBe(false);
  });

  it('rejects invalid length and initial digits for Aadhaar', () => {
    expect(validateAadhaar('12345678901').valid).toBe(false);
    expect(validateAadhaar('098765432101').valid).toBe(false);
    expect(validateAadhaar('198765432101').valid).toBe(false);
  });

  it('accepts valid Aadhaar and generates masked preview', () => {
    const res = validateAadhaar('234567890124');
    expect(res.valid).toBe(true);
    expect(res.maskedPreview).toBe('XXXX-XXXX-0124');
  });
});

describe('documentValidatorService - PAN Validation', () => {
  it('validates standard individual PAN format', () => {
    const validRes = validatePan('ABCPE1234F');
    expect(validRes.valid).toBe(true);
    expect(validRes.entityType).toContain('Individual');
  });

  it('detects company and trust PAN codes', () => {
    const compRes = validatePan('ABCCE1234F');
    expect(compRes.valid).toBe(true);
    expect(compRes.entityType).toContain('Company');

    const trustRes = validatePan('ABCTE1234F');
    expect(trustRes.valid).toBe(true);
    expect(trustRes.entityType).toContain('Trust');
  });

  it('rejects malformed PAN numbers', () => {
    expect(validatePan('12345ABCDE').valid).toBe(false);
    expect(validatePan('ABCDE123F').valid).toBe(false);
    expect(validatePan('abcde12345').valid).toBe(false);
  });
});

describe('documentValidatorService - Passport & Voter ID & DL', () => {
  it('validates passport format', () => {
    expect(validatePassport('A1234567').valid).toBe(true);
    expect(validatePassport('Z1234567').valid).toBe(false); // Z not allowed
    expect(validatePassport('A0234567').valid).toBe(false); // First digit cannot be 0
  });

  it('validates voter ID (EPIC) format', () => {
    expect(validateVoterId('ABC1234567').valid).toBe(true);
    expect(validateVoterId('AB1234567').valid).toBe(false);
  });

  it('validates driving license (Sarathi standard format)', () => {
    expect(validateDrivingLicense('DL0120210012345').valid).toBe(true);
    expect(validateDrivingLicense('DL01ABC').valid).toBe(false);
  });
});

describe('documentValidatorService - File Inspection & Audit', () => {
  it('flags files exceeding government 2MB portal limit', () => {
    const oversizedFile = {
      name: 'scan_copy.pdf',
      size: 3 * 1024 * 1024 // 3MB
    };
    const inspect = inspectDocumentFile(oversizedFile);
    expect(inspect.passed).toBe(false);
    expect(inspect.issues[0]).toContain('exceeds government portal maximum limit');
  });

  it('accepts standard compliant files and yields READY status', () => {
    const validFile = {
      name: 'aadhaar_masked.pdf',
      size: 450 * 1024 // 450KB
    };
    const inspect = inspectDocumentFile(validFile);
    expect(inspect.passed).toBe(true);
    expect(inspect.readinessScore).toBe(100);
  });

  it('generates full preflight audit report for expiring document', () => {
    const docData = {
      title: 'Commercial Driving Permit',
      type: 'DRIVING_LICENSE',
      expiryDate: '2020-01-01', // Expired
      file: { name: 'permit.pdf', size: 300 * 1024 }
    };
    const audit = generatePreflightAudit(docData);
    expect(audit.status).toBe('REJECT_RISK');
    expect(audit.recommendations.some(r => r.includes('Renew this document'))).toBe(true);
  });
});

describe('documentValidatorService - Explicit Preflight File Validation', () => {
  const docFile = (name, type, size = 500 * 1024) => ({ name, type, size });

  it('accepts compliant document files within 2 MB', () => {
    expect(validatePreflightFile(docFile('doc.pdf', 'application/pdf')).valid).toBe(true);
    expect(validatePreflightFile(docFile('photo.jpg', 'image/jpeg')).valid).toBe(true);
    expect(validatePreflightFile(docFile('photo.jpeg', 'image/jpeg')).valid).toBe(true);
    expect(validatePreflightFile(docFile('scan.png', 'image/png')).valid).toBe(true);
    expect(validatePreflightFile(docFile('scan.PDF', 'application/pdf')).valid).toBe(true);
  });

  it('rejects missing or empty files', () => {
    expect(validatePreflightFile(null).valid).toBe(false);
    expect(validatePreflightFile(docFile('doc.pdf', 'application/pdf', 0)).valid).toBe(false);
    expect(validatePreflightFile(docFile('doc.pdf', 'application/pdf', 0)).error).toMatch(/empty/i);
  });

  it('rejects files exceeding 2 MB portal limit', () => {
    const limit = STANDARD_PORTAL_LIMITS.MAX_FILE_SIZE_BYTES;
    expect(validatePreflightFile(docFile('doc.pdf', 'application/pdf', limit)).valid).toBe(true);
    expect(validatePreflightFile(docFile('doc.pdf', 'application/pdf', limit + 1)).valid).toBe(false);
    expect(validatePreflightFile(docFile('doc.pdf', 'application/pdf', limit + 1)).error).toMatch(/large/i);
  });

  it('rejects unsupported file formats', () => {
    expect(validatePreflightFile(docFile('script.exe', 'application/x-msdownload')).valid).toBe(false);
    expect(validatePreflightFile(docFile('notes.txt', 'text/plain')).valid).toBe(false);
    expect(validatePreflightFile(docFile('archive.zip', 'application/zip')).valid).toBe(false);
    expect(validatePreflightFile(docFile('doc.html', 'text/html')).valid).toBe(false);
  });

  it('rejects mismatched file extension and MIME type', () => {
    const res1 = validatePreflightFile(docFile('doc.pdf', 'image/png'));
    expect(res1.valid).toBe(false);
    expect(res1.error).toMatch(/extension does not match/i);

    const res2 = validatePreflightFile(docFile('image.png', 'application/pdf'));
    expect(res2.valid).toBe(false);
    expect(res2.error).toMatch(/extension does not match/i);

    const res3 = validatePreflightFile(docFile('doc.pdf', 'application/x-msdownload'));
    expect(res3.valid).toBe(false);
  });
});

describe('documentValidatorService - File Inspection Edge Cases', () => {
  it('flags zero-byte empty files as an issue', () => {
    const emptyFile = { name: 'empty.pdf', size: 0, type: 'application/pdf' };
    const inspect = inspectDocumentFile(emptyFile);
    expect(inspect.passed).toBe(false);
    expect(inspect.issues.some(i => i.includes('empty'))).toBe(true);
  });

  it('flags mismatched MIME type during inspection', () => {
    const mismatched = { name: 'fake.pdf', size: 100 * 1024, type: 'image/png' };
    const inspect = inspectDocumentFile(mismatched);
    expect(inspect.passed).toBe(false);
    expect(inspect.issues.some(i => i.includes('does not match'))).toBe(true);
  });
});
