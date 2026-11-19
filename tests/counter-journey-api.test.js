import { describe, it, expect } from 'vitest';
import handler from '../api/counter-journey.js';

// ---- mock fetch-like req/res ----
const makeReq = (init) => ({
  method: init?.method || 'GET',
  headers: init?.headers || {},
  body: init?.body,
  query: init?.query,
});

const makeRes = () => {
  const statusCalls = [];
  const jsonCalls = [];
  const setHeaderCalls = [];
  return {
    statusCalls,
    setHeader: (...args) => {
      setHeaderCalls.push(args);
    },
    status: (code) => {
      statusCalls.push(code);
      return {
        json: (data) => {
          jsonCalls.push(data);
          return { status: code };
        },
      };
    },
    get headersSent() {
      return statusCalls.length > 0;
    },
  };
};

describe('api/counter-journey handler', () => {
  describe('GET /catalogue', () => {
    it('returns paginated catalogue with no serviceId filter', async () => {
      const req = makeReq({ query: { action: 'catalogue' } });
      const res = makeRes();
      const result = await handler(req, res);
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body).toHaveProperty('dataVersion', '2026.11.18-r1');
    });

    it('filters by serviceId', async () => {
      const req = makeReq({ query: { action: 'catalogue', serviceId: 'income-certificate' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body.data.every((i) => i.serviceId === 'income-certificate')).toBe(true);
    });

    it('respects page and pageSize', async () => {
      const req = makeReq({ query: { action: 'catalogue', page: 2, pageSize: 5 } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('page', 2);
      expect(result.body).toHaveProperty('pageSize', 5);
    });

    it('returns 400 when action is missing', async () => {
      const req = makeReq({});
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_action');
    });
  });

  describe('GET /journey', () => {
    it('returns a journey by id', async () => {
      const req = makeReq({ query: { action: 'journey', journeyId: 'income-certificate-delhi-south' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body).toHaveProperty('journey');
    });

    it('returns 404 for unknown journeyId', async () => {
      const req = makeReq({ query: { action: 'journey', journeyId: 'unknown-journey' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'journey_not_found');
    });

    it('returns 400 when journeyId is missing', async () => {
      const req = makeReq({ query: { action: 'journey' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_journeyId');
    });
  });

  describe('POST /evaluate', () => {
    it('returns 401 for guest (no auth)', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'evaluate', journeyId: 'income-certificate-delhi-south', availableDocumentIds: ['aadhaar'] },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });

    it('returns validation errors for bad request with auth', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: { action: 'evaluate', journeyId: 'income-certificate-delhi-south', availableDocumentIds: ['nonexistent'] },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'validation_failed');
    });

    it('evaluates a journey with all docs and returns full data with auth', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: { action: 'evaluate', journeyId: 'income-certificate-delhi-south', availableDocumentIds: ['aadhaar', 'address-proof'] },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body).toHaveProperty('counters');
      expect(result.body).toHaveProperty('blockers');
    });

    it('returns empty result when no docs provided with auth', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: { action: 'evaluate', journeyId: 'income-certificate-delhi-south', availableDocumentIds: [] },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
    });
  });

  describe('POST /checklist', () => {
    it('returns 401 for guest', async () => {
      const req = makeReq({
        method: 'POST',
        body: { action: 'checklist', journeyId: 'income-certificate-delhi-south' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });

    it('returns checklist text with auth', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: { action: 'checklist', journeyId: 'income-certificate-delhi-south' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(result.body).toHaveProperty('checklistText');
    });
  });

  describe('POST /admin:review', () => {
    it('returns 403 for non-admin', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer fake-token' },
        body: { action: 'admin:review', journeyId: 'income-certificate-delhi-south', reviewerNote: 'test' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'permission_denied');
    });

    it('returns success for admin', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer admin-token' },
        body: { action: 'admin:review', journeyId: 'income-certificate-delhi-south', reviewerNote: 'test' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
    });

    it('returns 400 when journeyId is missing', async () => {
      const req = makeReq({
        method: 'POST',
        headers: { authorization: 'Bearer admin-token' },
        body: { action: 'admin:review' },
      });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'missing_journeyId');
    });
  });

  describe('method not allowed', () => {
    it('returns 405 for DELETE', async () => {
      const req = makeReq({ method: 'DELETE' });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'method_not_allowed');
    });

    it('returns 405 for PUT', async () => {
      const req = makeReq({ method: 'PUT' });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'method_not_allowed');
    });
  });

  describe('malformed / empty results', () => {
    it('handles empty catalogue when no services match', async () => {
      const req = makeReq({ query: { action: 'catalogue', serviceId: 'nonexistent' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', false);
      expect(result.body).toHaveProperty('error');
    });

    it('handles empty journey results gracefully', async () => {
      const req = makeReq({ query: { action: 'journey', journeyId: 'nonexistent' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', false);
      expect(result.body).toHaveProperty('error', 'journey_not_found');
    });
  });
});
