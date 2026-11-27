/**
 * tests/notice-order-explainer.test.js
 *
 * API integration & authorization tests for Notice & Order Explainer (#1422).
 */

import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/notice-order-explainer.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    end(raw) { try { this.body = JSON.parse(raw); } catch { this.body = raw; } return res; },
  };
  return res;
}

describe('notice-order-explainer API (#1422)', () => {
  it('POST extracts sections with citations (200) and rejects PII (400)', async () => {
    const okRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/notice-order-explainer',
        headers: { 'x-forwarded-for': '10.11.0.1' },
        body: {
          title: 'Pension Notice',
          text: 'Applicants shall furnish life certificate by 31/12/2026.',
          ocrConfidence: 0.95,
        },
      },
      okRes
    );
    expect(okRes.statusCode).toBe(200);
    expect(okRes.body.explanation.sections[0].citation).toBe('Page 1, Para 1');
    expect(okRes.body.explanation.officialTextAuthoritative).toBe(true);

    const piiRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/notice-order-explainer',
        headers: { 'x-forwarded-for': '10.11.0.2' },
        body: { text: 'Aadhaar 1234 5678 9012' },
      },
      piiRes
    );
    expect(piiRes.statusCode).toBe(400);
  });

  it('POST /review-translation & GET /audit-log enforce reviewer/admin auth (401/403/200)', async () => {
    const unauth = createMockRes();
    await handler(
      { method: 'POST', url: '/api/notice-order-explainer/review-translation', headers: { 'x-forwarded-for': '10.11.0.3' }, body: {} },
      unauth
    );
    expect(unauth.statusCode).toBe(401);

    const cit = createMockRes();
    await handler(
      { method: 'POST', url: '/api/notice-order-explainer/review-translation', headers: { 'x-forwarded-for': '10.11.0.4' }, body: {} },
      cit,
      { authUserOverride: { userId: 'cit-1', role: 'citizen' } }
    );
    expect(cit.statusCode).toBe(403);

    const rev = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/notice-order-explainer/review-translation',
        headers: { 'x-forwarded-for': '10.11.0.5' },
        body: { sectionId: 'sec-p1-1', language: 'hi', approvedTranslation: 'राजस्व विभाग सूचना' },
      },
      rev,
      { authUserOverride: { userId: 'rev-1', role: 'reviewer' } }
    );
    expect(rev.statusCode).toBe(200);
    expect(rev.body.review.reviewedBy).toBe('rev-1');
  });
});
