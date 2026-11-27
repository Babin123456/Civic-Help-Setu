import { describe, it, expect, beforeEach } from 'vitest';
import route, { _resetFeedbackStore, sanitizeAndRedactText } from '../api/_lib/handlers/business-licence-feedback.js';

describe('business-licence-feedback API endpoint (#721)', () => {
  beforeEach(() => {
    _resetFeedbackStore();
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const res = await route({ method: 'DELETE' });
    expect(res.status).toBe(405);
    expect(res.body.error).toBe('method_not_allowed');
  });

  it('allows administrator GET requests to inspect submissions', async () => {
    const res = await route({ method: 'GET' });
    expect(res.status).toBe(200);
    expect(res.body.totalSubmissions).toBe(0);
    expect(Array.isArray(res.body.recentSubmissions)).toBe(true);
  });

  it('rejects POST submissions with missing jurisdiction or invalid source URL', async () => {
    const missingJurisdiction = await route({
      method: 'POST',
      body: { officialGazetteOrSourceUrl: 'https://mcdonline.nic.in' }
    });
    expect(missingJurisdiction.status).toBe(400);
    expect(missingJurisdiction.body.error).toBe('missing_jurisdiction');

    const invalidUrl = await route({
      method: 'POST',
      body: {
        jurisdictionKey: 'DELHI_MCD',
        officialGazetteOrSourceUrl: 'not-a-valid-url'
      }
    });
    expect(invalidUrl.status).toBe(400);
    expect(invalidUrl.body.error).toBe('malformed_source_url');

    const ftpUrl = await route({
      method: 'POST',
      body: {
        jurisdictionKey: 'DELHI_MCD',
        officialGazetteOrSourceUrl: 'ftp://gov.in/rules.pdf'
      }
    });
    expect(ftpUrl.status).toBe(400);
    expect(ftpUrl.body.error).toBe('invalid_source_protocol');
  });

  it('accepts valid proposal, redacts PII, and stores for admin review', async () => {
    const res = await route({
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '192.168.1.100' },
      body: {
        jurisdictionKey: 'DELHI_MCD',
        licenceKey: 'municipal_trade_licence',
        stage: 'RENEWAL',
        officialGazetteOrSourceUrl: 'https://mcdonline.nic.in/gazette/2026',
        submissionNotes: 'Shop owner Sharma at 9876543210 reported revised fees. GSTIN: 07AAAAA0000A1Z5.'
      }
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('PENDING_ADMIN_REVIEW');

    const getRes = await route({ method: 'GET' });
    expect(getRes.body.totalSubmissions).toBe(1);
    const saved = getRes.body.recentSubmissions[0];
    expect(saved.submissionNotes).not.toContain('9876543210');
    expect(saved.submissionNotes).not.toContain('07AAAAA0000A1Z5');
    expect(saved.submissionNotes).toContain('[REDACTED]');
  });

  it('redacts PAN, GSTIN, mobile numbers, and emails properly', () => {
    const text = 'PAN ABCDE1234F, Email test@example.com, Phone 9876543210, GSTIN 29AAAAA0000A1Z5';
    const redacted = sanitizeAndRedactText(text);
    expect(redacted).not.toContain('ABCDE1234F');
    expect(redacted).not.toContain('test@example.com');
    expect(redacted).not.toContain('9876543210');
    expect(redacted).not.toContain('29AAAAA0000A1Z5');
  });
});

