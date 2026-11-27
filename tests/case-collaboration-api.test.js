import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/case-collaboration.js';

const makeReq = (init) => ({
  method: init?.method || 'GET',
  headers: init?.headers || {},
  body: init?.body,
  query: init?.query,
});

const makeRes = () => {
  const statusCalls = [];
  const jsonCalls = [];
  return {
    statusCalls,
    setHeader: (...args) => args,
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

describe('api/case-collaboration handler', () => {
  describe('GET /catalogue', () => {
    it('returns catalogue', async () => {
      const req = makeReq({ query: { action: 'catalogue' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('ok', true);
      expect(Array.isArray(result.body.cases)).toBe(true);
      expect(Array.isArray(result.body.caseItems)).toBe(true);
      expect(Array.isArray(result.body.recipients)).toBe(true);
      expect(Array.isArray(result.body.scopes)).toBe(true);
      expect(Array.isArray(result.body.expiryOptions)).toBe(true);
      expect(result.body.cases.length).toBeGreaterThan(0);
    });
    it('400 when action missing', async () => {
      const result = await handler(makeReq({}), makeRes());
      expect(result.body).toHaveProperty('error', 'missing_action');
    });
  });

  describe('POST /create-share', () => {
    it('401 for guest', async () => {
      const req = makeReq({ method: 'POST', body: { action: 'create-share', title: 'T', itemIds: ['item-income-cert-application'] } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
    it('400 for missing title', async () => {
      const req = makeReq({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { action: 'create-share', itemIds: ['item-income-cert-application'] } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error');
    });
  });

  describe('POST /resolve', () => {
    it('rejects unknown share', async () => {
      const req = makeReq({ method: 'POST', body: { action: 'resolve', shareId: 'share-unknown' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error');
    });
  });

  describe('POST /download', () => {
    it('rejects unknown share', async () => {
      const req = makeReq({ method: 'POST', body: { action: 'download', shareId: 'share-unknown', itemId: 'item-income-cert-application' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error');
    });
  });

  describe('POST /revoke-share', () => {
    it('401 for guest', async () => {
      const req = makeReq({ method: 'POST', body: { action: 'revoke-share', shareId: 'share-x' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
  });

  describe('POST /list-shares', () => {
    it('401 for guest', async () => {
      const req = makeReq({ method: 'POST', body: { action: 'list-shares' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
  });

  describe('POST /audit-log', () => {
    it('401 for guest', async () => {
      const req = makeReq({ method: 'POST', body: { action: 'audit-log', shareId: 'share-x' } });
      const result = await handler(req, makeRes());
      expect(result.body).toHaveProperty('error', 'unauthenticated');
    });
  });

  describe('method not allowed', () => {
    it('405 for DELETE', async () => {
      const result = await handler(makeReq({ method: 'DELETE' }), makeRes());
      expect(result.body).toHaveProperty('error', 'method_not_allowed');
    });
    it('405 for PUT', async () => {
      const result = await handler(makeReq({ method: 'PUT' }), makeRes());
      expect(result.body).toHaveProperty('error', 'method_not_allowed');
    });
  });
});
