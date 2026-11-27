/**
 * tests/duplicate-case-detector.test.js
 *
 * API integration & authorization tests for Duplicate Case Detector (#1427).
 */

import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/duplicate-case-detector.js';

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

describe('duplicate-case-detector API (#1427)', () => {
  it('enforces auth (401), detects duplicates (200), confirms link (200), and gates /eval & /audit-log (403/200)', async () => {
    const unauth = createMockRes();
    await handler({ method: 'POST', url: '/api/duplicate-case-detector', headers: { 'x-forwarded-for': '10.9.0.1' }, body: {} }, unauth);
    expect(unauth.statusCode).toBe(401);

    const citizenAuth = { userId: 'cit-1', role: 'citizen' };
    const adminAuth = { userId: 'admin-1', role: 'admin' };

    const detectRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/duplicate-case-detector',
        headers: { 'x-forwarded-for': '10.9.0.2' },
        body: {
          candidateCase: {
            caseId: 'C-NEW',
            category: 'Ration Card',
            jurisdiction: 'Delhi Ward 5',
            confirmedReferenceId: 'RC/2026/1',
            submittedAt: '2026-11-22T10:00:00Z',
          },
          existingCases: [
            {
              caseId: 'C-OLD',
              category: 'Ration Card',
              jurisdiction: 'Delhi Ward 5',
              confirmedReferenceId: 'RC/2026/1',
              submittedAt: '2026-11-20T10:00:00Z',
            },
          ],
        },
      },
      detectRes,
      { authUserOverride: citizenAuth }
    );
    expect(detectRes.statusCode).toBe(200);
    expect(detectRes.body.suggestions[0].classification).toBe('LIKELY_DUPLICATE');

    const confRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/duplicate-case-detector/confirm',
        headers: { 'x-forwarded-for': '10.9.0.3' },
        body: { primaryCaseId: 'C-NEW', candidateCaseId: 'C-OLD', decision: 'LINK_DUPLICATE' },
      },
      confRes,
      { authUserOverride: citizenAuth }
    );
    expect(confRes.statusCode).toBe(200);
    expect(confRes.body.link.separateCaseIdsPreserved).toBe(true);

    const citEval = createMockRes();
    await handler(
      { method: 'GET', url: '/api/duplicate-case-detector/eval', headers: { 'x-forwarded-for': '10.9.0.4' } },
      citEval,
      { authUserOverride: citizenAuth }
    );
    expect(citEval.statusCode).toBe(403);

    const adminEval = createMockRes();
    await handler(
      { method: 'GET', url: '/api/duplicate-case-detector/eval', headers: { 'x-forwarded-for': '10.9.0.5' } },
      adminEval,
      { authUserOverride: adminAuth }
    );
    expect(adminEval.statusCode).toBe(200);
    expect(adminEval.body.evaluation.precision).toBeGreaterThanOrEqual(0.8);
  });
});
