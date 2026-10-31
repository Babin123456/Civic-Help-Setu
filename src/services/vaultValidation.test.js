import { describe, it, expect } from 'vitest';
import {
  validateFile,
  validateDocumentForm,
  isDuplicateDocument,
  isValidVaultRecord,
  formatFileSize,
  getVerificationLabel,
  MAX_FILE_SIZE_BYTES,
} from './vaultValidation';

const file = (name, type, size = 1000) => ({ name, type, size });

describe('validateFile', () => {
  it('accepts PDF, JPG and PNG', () => {
    expect(validateFile(file('a.pdf', 'application/pdf')).valid).toBe(true);
    expect(validateFile(file('a.jpg', 'image/jpeg')).valid).toBe(true);
    expect(validateFile(file('a.JPEG', 'image/jpeg')).valid).toBe(true);
    expect(validateFile(file('a.png', 'image/png')).valid).toBe(true);
  });

  it('rejects a missing file', () => {
    expect(validateFile(null).valid).toBe(false);
  });

  it('rejects empty files', () => {
    expect(validateFile(file('a.pdf', 'application/pdf', 0)).valid).toBe(false);
  });

  it('rejects files over 5 MB but allows exactly 5 MB', () => {
    expect(validateFile(file('a.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES)).valid).toBe(true);
    expect(validateFile(file('a.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES + 1)).valid).toBe(false);
  });

  it('rejects unsupported types', () => {
    expect(validateFile(file('a.exe', 'application/x-msdownload')).valid).toBe(false);
    expect(validateFile(file('a.gif', 'image/gif')).valid).toBe(false);
    expect(validateFile(file('a.pdf', '')).valid).toBe(false);
  });

  it('rejects an extension that does not match the type', () => {
    const res = validateFile(file('scan.png', 'application/pdf'));
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/extension/i);
    expect(validateFile(file('noextension', 'image/png')).valid).toBe(false);
  });

  it('rejects very long file names', () => {
    expect(validateFile(file('a'.repeat(130) + '.pdf', 'application/pdf')).valid).toBe(false);
  });
});

describe('validateDocumentForm', () => {
  const ok = { type: 'Passport', number: 'Z123', issuer: '', notes: '', expiryDate: '' };

  it('passes a minimal valid form (no expiry, no issuer)', () => {
    expect(validateDocumentForm(ok, []).valid).toBe(true);
  });

  it('requires type and number', () => {
    const { valid, errors } = validateDocumentForm({ ...ok, type: '  ', number: '' }, []);
    expect(valid).toBe(false);
    expect(errors.type).toBeTruthy();
    expect(errors.number).toBeTruthy();
  });

  it('limits field lengths', () => {
    expect(validateDocumentForm({ ...ok, type: 'x'.repeat(101) }, []).errors.type).toBeTruthy();
    expect(validateDocumentForm({ ...ok, notes: 'x'.repeat(301) }, []).errors.notes).toBeTruthy();
  });

  it('rejects an invalid expiry date', () => {
    expect(validateDocumentForm({ ...ok, expiryDate: 'not-a-date' }, []).errors.expiryDate).toBeTruthy();
  });

  it('flags duplicates on type plus number, ignoring case and spaces', () => {
    const existing = [{ id: 'd1', type: 'passport', number: 'z 123' }];
    const res = validateDocumentForm(ok, existing);
    expect(res.valid).toBe(false);
    expect(res.errors.number).toMatch(/already/i);
  });
});

describe('isDuplicateDocument', () => {
  it('does not match itself when editing', () => {
    const existing = [{ id: 'd1', type: 'PAN', number: 'ABC' }];
    expect(isDuplicateDocument({ id: 'd1', type: 'PAN', number: 'ABC' }, existing)).toBe(false);
  });
  it('is false for a different number', () => {
    expect(isDuplicateDocument({ type: 'PAN', number: 'XYZ' }, [{ id: 'd1', type: 'PAN', number: 'ABC' }])).toBe(false);
  });
});

describe('isDuplicateDocument with last-4 storage', () => {
  const stored = [{ id: 'a', type: 'Aadhaar', number: 'XXXX 9012', issuer: 'UIDAI', expiryDate: '' }];
  it('allows a different number that shares the last 4 when issuer differs', () => {
    expect(isDuplicateDocument({ type: 'Aadhaar', number: '1111 2222 9012', issuer: 'Other' }, stored)).toBe(false);
  });
  it('allows a different number that shares the last 4 when expiry differs', () => {
    expect(isDuplicateDocument({ type: 'Aadhaar', number: '1111 2222 9012', issuer: 'UIDAI', expiryDate: '2030-01-01' }, stored)).toBe(false);
  });
  it('still flags the same document re-added', () => {
    expect(isDuplicateDocument({ type: 'aadhaar', number: '1234 5678 9012', issuer: ' uidai ' }, stored)).toBe(true);
  });
});

describe('isValidVaultRecord', () => {
  it('accepts a record with id, type and number', () => {
    expect(isValidVaultRecord({ id: 'a', type: 'PAN', number: '1' })).toBe(true);
  });
  it('rejects bad records', () => {
    expect(isValidVaultRecord(null)).toBe(false);
    expect(isValidVaultRecord('x')).toBe(false);
    expect(isValidVaultRecord([])).toBe(false);
    expect(isValidVaultRecord({ id: 'a', type: 'PAN' })).toBe(false);
    expect(isValidVaultRecord({ type: 'PAN', number: '1' })).toBe(false);
  });
});

describe('formatFileSize and labels', () => {
  it('formats KB and MB', () => {
    expect(formatFileSize(500)).toBe('1 KB');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(NaN)).toBe('');
  });
  it('labels verification as self-declared', () => {
    expect(getVerificationLabel({ verified: true })).toBe('Self-declared verified');
    expect(getVerificationLabel({})).toBe('Not verified');
  });
});
