import { describe, it, expect } from 'vitest';

import route, { sanitizeAndRedactText } from '../api/fire-compliance-feedback.js';

import route, { sanitizeAndRedactText } from '../api/_lib/handlers/fire-compliance-feedback.js';


describe('api/fire-compliance-feedback endpoint', () => {
  it('redacts Aadhaar, PAN, phone numbers and emails from submitted notes', () => {
    const raw = 'Officer contacted at 9876543210 and email test@gov.in. Aadhaar is 2345 6789 0123 with PAN ABCDE1234F.';
    const sanitized = sanitizeAndRedactText(raw);
    expect(sanitized).not.toContain('9876543210');
    expect(sanitized).not.toContain('test@gov.in');
    expect(sanitized).not.toContain('2345 6789 0123');
    expect(sanitized).not.toContain('ABCDE1234F');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('rejects non-POST requests with 405 Method Not Allowed (except GET log)', async () => {
    const res = { setHeader: () => {} };
    const result = await route({ method: 'PUT' }, res);
    expect(result.status).toBe(405);
    expect(result.body.error).toBe('method_not_allowed');
  });

  it('rejects payloads missing mandatory jurisdiction or source URL', async () => {
    const res = { setHeader: () => {} };
    const missingJurisdiction = await route({
      method: 'POST',
      body: { officialGazetteOrSourceUrl: 'https://dfs.delhigovt.nic.in' }
    }, res);
    expect(missingJurisdiction.status).toBe(400);
    expect(missingJurisdiction.body.error).toBe('missing_jurisdiction');

    const missingSource = await route({
      method: 'POST',
      body: { jurisdictionKey: 'DELHI_NCT' }
    }, res);
    expect(missingSource.status).toBe(400);
    expect(missingSource.body.error).toBe('missing_source_url');
  });

  it('rejects malformed or non-http source URLs', async () => {
    const res = { setHeader: () => {} };
    const malformed = await route({
      method: 'POST',
      body: { jurisdictionKey: 'DELHI_NCT', officialGazetteOrSourceUrl: 'ftp://invalidscheme.com' }
    }, res);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toBe('invalid_source_protocol');
  });

  it('accepts valid community correction proposals with 201 Created and redacted text', async () => {
    const res = { setHeader: () => {} };
    const valid = await route({
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '127.0.0.1' },
      body: {
        jurisdictionKey: 'DELHI_NCT',
        officialGazetteOrSourceUrl: 'https://dfs.delhigovt.nic.in/order-2026',
        submissionNotes: 'Call me at 9876543210 to clarify rule 35.'
      }
    }, res);

    expect(valid.status).toBe(201);
    expect(valid.body.success).toBe(true);
    expect(valid.body.submissionId).toMatch(/^fire_fb_/);

    // Verify GET log contains redacted text
    const getRes = await route({ method: 'GET' }, res);
    expect(getRes.status).toBe(200);
    const stored = getRes.body.recentSubmissions.find((s) => s.id === valid.body.submissionId);
    expect(stored).toBeDefined();
    expect(stored.submissionNotes).toContain('[REDACTED]');
    expect(stored.submissionNotes).not.toContain('9876543210');
  });
});

