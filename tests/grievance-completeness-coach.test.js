import { describe, it, expect, beforeEach } from 'vitest';
import { createGrievanceCompletenessCoachHandler } from '../api/_lib/handlers/grievance-completeness-coach.js';
import {
  InMemoryGrievanceCoachStore,
  resetDefaultGrievanceCoachStoreForTests,
} from '../api/_lib/grievanceCompletenessCoachStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('Grievance Completeness Coach API Handler (#1444)', () => {
  let store;

  beforeEach(() => {
    resetDefaultGrievanceCoachStoreForTests();
    store = new InMemoryGrievanceCoachStore();
  });

  it('serves multilingual prompts and enforces auth, owner isolation, PII rejection, and approval', async () => {
    const handler = createGrievanceCompletenessCoachHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyActor: async (req) => {
        const auth = req.headers?.authorization;
        if (!auth) return { ok: false, status: 401, error: 'Authentication required.' };
        if (auth === 'Bearer citizen-1') return { ok: true, actorId: 'c-1', role: 'citizen' };
        if (auth === 'Bearer citizen-2') return { ok: true, actorId: 'c-2', role: 'citizen' };
        return { ok: true, actorId: 'admin-1', role: 'admin' };
      },
    });

    const resPrompts = createMockRes();
    await handler({ method: 'GET', url: '/api/grievance-completeness-coach/prompts?lang=ta', headers: {} }, resPrompts);
    expect(resPrompts.statusCode).toBe(200);
    expect(resPrompts.body.language).toBe('ta');

    // 401 unauthenticated analyze
    const res401 = createMockRes();
    await handler(
      { method: 'POST', url: '/api/grievance-completeness-coach/analyze', headers: {}, body: { originalText: 'Broken pipe' } },
      res401
    );
    expect(res401.statusCode).toBe(401);

    // 400 PII rejected
    const resPii = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/grievance-completeness-coach/analyze',
        headers: { authorization: 'Bearer citizen-1' },
        body: { originalText: 'Aadhaar 2345 6789 0123 useless pipe' },
      },
      resPii
    );
    expect(resPii.statusCode).toBe(400);
    expect(resPii.body.code).toBe('ERR_PII_PROHIBITED');

    // 201 citizen-1 analyzes draft
    const resCreate = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/grievance-completeness-coach/analyze',
        headers: { authorization: 'Bearer citizen-1' },
        body: { originalText: 'The streetlight is useless near Ward 4.', language: 'en' },
      },
      resCreate
    );
    expect(resCreate.statusCode).toBe(201);
    const draftId = resCreate.body.draft.draftId;

    // 403 citizen-2 cannot approve suggestion on citizen-1's draft
    const res403 = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/grievance-completeness-coach/drafts/${draftId}/decide`,
        headers: { authorization: 'Bearer citizen-2' },
        body: { suggestionId: 'nw-useless', decision: 'approve' },
      },
      res403
    );
    expect(res403.statusCode).toBe(403);

    // 200 citizen-1 approves suggestion
    const resApprove = createMockRes();
    await handler(
      {
        method: 'POST',
        url: `/api/grievance-completeness-coach/drafts/${draftId}/decide`,
        headers: { authorization: 'Bearer citizen-1' },
        body: { suggestionId: 'nw-useless', decision: 'approve' },
      },
      resApprove
    );
    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.body.draft.originalText).toBe('The streetlight is useless near Ward 4.');
    expect(resApprove.body.draft.approvedDraftText).toContain('non-functional');
  });
});
