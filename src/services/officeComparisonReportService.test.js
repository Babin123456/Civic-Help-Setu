import { describe, it, expect, vi } from 'vitest';
import {
  LOCAL_OFFICE_REPORTS_KEY,
  readLocalOfficeReports,
  saveLocalOfficeReport,
  submitOfficeReport,
  validateOfficeReport,
} from './officeComparisonReportService';

const fakeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
};

const validReport = {
  officeId: 'delhi-rto-sarai-kale-khan',
  reason: 'outdated_contact',
  note: 'The listed helpline is no longer in service.',
  sourceUrl: 'https://transport.delhi.gov.in/office-directory',
};

describe('officeComparisonReportService (#824)', () => {
  it('accepts a minimal, non-sensitive report', () => {
    const result = validateOfficeReport(validReport);
    expect(result.valid).toBe(true);
    expect(result.value).toEqual(validReport);
  });

  it('requires a known reason and an office ID', () => {
    expect(validateOfficeReport({}).valid).toBe(false);
    expect(validateOfficeReport({ ...validReport, reason: 'because' }).valid).toBe(false);
    expect(validateOfficeReport({ ...validReport, officeId: '' }).valid).toBe(false);
    expect(validateOfficeReport(null).valid).toBe(false);
  });

  it('rejects identity numbers, phone numbers, emails, OTPs and passwords', () => {
    expect(validateOfficeReport({ ...validReport, note: 'Aadhaar 1234 5678 9012' }).errors.join(' ')).toMatch(
      /Aadhaar/
    );
    expect(validateOfficeReport({ ...validReport, note: 'PAN ABCDE1234F' }).errors.join(' ')).toMatch(/PAN/);
    expect(validateOfficeReport({ ...validReport, note: 'Call 9876543210' }).errors.join(' ')).toMatch(/phone/);
    expect(validateOfficeReport({ ...validReport, note: 'Email me at test@example.com' }).errors.join(' ')).toMatch(
      /email/
    );
    expect(validateOfficeReport({ ...validReport, note: 'my password is hunter2' }).valid).toBe(false);
    expect(validateOfficeReport({ ...validReport, note: 'OTP 483920' }).valid).toBe(false);
  });

  it('accepts only official HTTPS source links', () => {
    expect(validateOfficeReport({ ...validReport, sourceUrl: 'http://transport.delhi.gov.in' }).valid).toBe(false);
    expect(validateOfficeReport({ ...validReport, sourceUrl: 'javascript:alert(1)' }).valid).toBe(false);
    expect(validateOfficeReport({ ...validReport, sourceUrl: 'https://transport.delhi.gov.in' }).valid).toBe(true);
  });

  it('rejects oversized notes', () => {
    const result = validateOfficeReport({ ...validReport, note: 'x'.repeat(501) });
    expect(result.valid).toBe(false);
  });

  it('saves a local report with a pending review status and no personal fields', () => {
    const storage = fakeStorage();
    const saved = saveLocalOfficeReport(validReport, storage);
    expect(saved.ok).toBe(true);
    expect(saved.report.status).toBe('pending_review');
    expect(saved.report.delivery).toBe('local');
    expect(saved.report.id).toMatch(/^local-report-/);
    expect(saved.report).not.toHaveProperty('email');

    const stored = JSON.parse(storage.getItem(LOCAL_OFFICE_REPORTS_KEY));
    expect(stored).toHaveLength(1);
    expect(readLocalOfficeReports(storage)).toHaveLength(1);
  });

  it('does not store an invalid report', () => {
    const storage = fakeStorage();
    const saved = saveLocalOfficeReport({ ...validReport, reason: 'bad' }, storage);
    expect(saved.ok).toBe(false);
    expect(storage.getItem(LOCAL_OFFICE_REPORTS_KEY)).toBeNull();
  });

  it('uses the server when it accepts the report', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reportId: 'office_report_1', status: 'pending_review' }),
    });
    const result = await submitOfficeReport(validReport, { fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('server');
    expect(result.report.reportId).toBe('office_report_1');
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/office-comparison',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('falls back to a local, on-device report when the server is unavailable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await submitOfficeReport(validReport, { fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('local');
    expect(result.message).toMatch(/saved on this device/);
  });

  it('returns validation errors without sending anything', async () => {
    const fetchImpl = vi.fn();
    const result = await submitOfficeReport({ ...validReport, note: 'OTP 123456' }, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
