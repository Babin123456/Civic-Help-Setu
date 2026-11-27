/**
 * tests/form-field-translation-memory.test.js
 *
 * API integration & authorization tests for Form Field Translation Memory (#1423).
 */

import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/form-field-translation-memory.js';

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

describe('form-field-translation-memory API (#1423)', () => {
  it('GET ?phrase=... resolves approved translation and falls back to original wording when missing (200)', async () => {
    const hit = createMockRes();
    await handler(
      { method: 'GET', url: '/api/form-field-translation-memory?phrase=Annual%20Family%20Income&lang=hi', headers: { 'x-forwarded-for': '10.10.0.1' } },
      hit
    );
    expect(hit.statusCode).toBe(200);
    expect(hit.body.resolution.fallbackUsed).toBe(false);

    const miss = createMockRes();
    await handler(
      { method: 'GET', url: '/api/form-field-translation-memory?phrase=Unknown%20Field&lang=ta', headers: { 'x-forwarded-for': '10.10.0.2' } },
      miss
    );
    expect(miss.statusCode).toBe(200);
    expect(miss.body.resolution.fallbackUsed).toBe(true);
    expect(miss.body.resolution.label).toBe('Unknown Field');
  });

  it('POST & /approve enforce auth (401/403), role separation, and complete approval lifecycle', async () => {
    const unauth = createMockRes();
    await handler(
      { method: 'POST', url: '/api/form-field-translation-memory', headers: { 'x-forwarded-for': '10.10.0.3' }, body: {} },
      unauth
    );
    expect(unauth.statusCode).toBe(401);

    const contribAuth = { userId: 'contrib-1', role: 'citizen' };
    const revAuth = { userId: 'rev-1', role: 'legal_reviewer' };

    const propRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/form-field-translation-memory',
        headers: { 'x-forwarded-for': '10.10.0.4' },
        body: {
          sourcePhrase: 'Statutory Mutation Fee',
          proposedTranslation: 'वैधानिक दाखिल-खारिज शुल्क',
          language: 'hi',
        },
      },
      propRes,
      { authUserOverride: contribAuth }
    );
    expect(propRes.statusCode).toBe(201);
    expect(propRes.body.entry.isLegalTerm).toBe(true);

    const citApprove = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/form-field-translation-memory/approve',
        headers: { 'x-forwarded-for': '10.10.0.5' },
        body: { entryId: propRes.body.entry.entryId },
      },
      citApprove,
      { authUserOverride: contribAuth }
    );
    expect(citApprove.statusCode).toBe(403);

    const revApprove = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/form-field-translation-memory/approve',
        headers: { 'x-forwarded-for': '10.10.0.6' },
        body: { entryId: propRes.body.entry.entryId, decision: 'APPROVE' },
      },
      revApprove,
      { authUserOverride: revAuth }
    );
    expect(revApprove.statusCode).toBe(200);
    expect(revApprove.body.entry.status).toBe('approved');
    expect(revApprove.body.entry.version).toBe(1);
  });
});
