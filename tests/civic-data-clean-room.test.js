import { describe, it, expect, beforeEach } from 'vitest';
import handler, { scanPayloadForPii } from '../api/_lib/handlers/civic-data-clean-room.js';
import { resetCleanRoomStorage } from '../src/services/cleanRoomStorage.js';
import { ALLOWED_DATASET_IDS } from '../src/data/cleanRoomContract.js';

function createMockReqRes(options = {}) {
  const req = {
    method: options.method || 'GET',
    headers: options.headers || { 'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 200)}` },
    query: options.query || {},
    body: options.body || {},
    socket: { remoteAddress: '127.0.0.1' },
  };

  let statusCode = 200;
  const headers = {};
  let responseData = null;

  const res = {
    setHeader: (name, val) => {
      headers[name] = val;
    },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return { statusCode, headers, data };
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  };

  return { req, res };
}

describe('api/civic-data-clean-room (#1164)', () => {
  beforeEach(() => {
    resetCleanRoomStorage();
  });

  describe('PII Scanner', () => {
    it('detects Aadhaar, PAN, and phone numbers in inputs', () => {
      const piiObj = {
        filter: 'test',
        aadhaarCandidate: '2345 6789 0123',
        panCandidate: 'ABCDE1234F',
        contact: '+919876543210',
      };
      const check = scanPayloadForPii(piiObj);
      expect(check.hasPii).toBe(true);
      expect(check.violations.some((v) => v.includes('Aadhaar'))).toBe(true);
      expect(check.violations.some((v) => v.includes('PAN'))).toBe(true);
      expect(check.violations.some((v) => v.includes('phone'))).toBe(true);
    });

    it('passes for clean analytical parameters', () => {
      const cleanObj = {
        workspaceId: 'ws-urban-inst-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: { ward_id: 'Ward-101', fiscal_quarter: 'Q1-2026' },
      };
      const check = scanPayloadForPii(cleanObj);
      expect(check.hasPii).toBe(false);
      expect(check.violations).toHaveLength(0);
    });
  });

  describe('GET Endpoints', () => {
    it('returns available workspaces', async () => {
      const { req, res } = createMockReqRes({ method: 'GET', query: { action: 'workspaces' } });
      await handler(req, res);
      expect(res.getStatusCode()).toBe(200);
      expect(res.getResponseData().workspaces.length).toBeGreaterThanOrEqual(3);
    });

    it('returns query templates and dataset catalogs', async () => {
      const { req: reqT, res: resT } = createMockReqRes({ method: 'GET', query: { action: 'templates' } });
      await handler(reqT, resT);
      expect(resT.getStatusCode()).toBe(200);
      expect(resT.getResponseData().templates.length).toBeGreaterThanOrEqual(3);

      const { req: reqD, res: resD } = createMockReqRes({ method: 'GET', query: { action: 'datasets' } });
      await handler(reqD, resD);
      expect(resD.getStatusCode()).toBe(200);
      expect(resD.getResponseData().datasets.length).toBeGreaterThanOrEqual(3);
    });

    it('returns evaluation metrics and audit logs', async () => {
      const { req, res } = createMockReqRes({ method: 'GET', query: { action: 'metrics' } });
      await handler(req, res);
      expect(res.getStatusCode()).toBe(200);
      expect(res.getResponseData().metrics.zeroPiiInvariantVerified).toBe(true);
    });
  });

  describe('POST Endpoints', () => {
    it('executes valid aggregate query successfully', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          action: 'execute-query',
          workspaceId: 'ws-urban-inst-01',
          templateId: 'TPL_WARD_SERVICE_SUMMARY',
          filters: {},
        },
      });

      await handler(req, res);
      expect(res.getStatusCode()).toBe(200);
      const data = res.getResponseData();
      expect(data.success).toBe(true);
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.meta.resultDigest).toBeDefined();
    });

    it('blocks query with PII payload and returns 400', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          action: 'execute-query',
          workspaceId: 'ws-urban-inst-01',
          templateId: 'TPL_WARD_SERVICE_SUMMARY',
          filters: { citizen_aadhaar: '1234 5678 9012' },
        },
      });

      await handler(req, res);
      expect(res.getStatusCode()).toBe(400);
      expect(res.getResponseData().error).toBe('CLEAN_ROOM_RE_IDENTIFICATION_RISK');
    });

    it('registers new workspace via POST', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          action: 'register-workspace',
          partnerName: 'Urban Transport Forum',
          partnerOrg: 'City Transit Council',
          partnerEmail: 'urban@transitcouncil.org',
          tier: 'academic_research',
          approvedDatasets: [ALLOWED_DATASET_IDS.WARD_SERVICE_DEMAND],
        },
      });

      await handler(req, res);
      expect(res.getStatusCode()).toBe(201);
      expect(res.getResponseData().workspace.status).toBe('pending_approval');
    });

    it('handles data steward review via POST', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          action: 'review-workspace',
          workspaceId: 'ws-pending-ngo-03',
          decision: 'approve',
          stewardId: 'steward-official-9',
          notes: 'Charter approved by civic oversight committee',
        },
      });

      await handler(req, res);
      expect(res.getStatusCode()).toBe(200);
      expect(res.getResponseData().workspace.status).toBe('approved');
    });

    it('handles concurrent query requests safely with single-flight deduplication', async () => {
      const body = {
        action: 'execute-query',
        workspaceId: 'ws-urban-inst-01',
        templateId: 'TPL_WARD_SERVICE_SUMMARY',
        filters: { fiscal_quarter: 'Q2-2026' },
      };

      const call1 = createMockReqRes({ method: 'POST', body });
      const call2 = createMockReqRes({ method: 'POST', body });

      await Promise.all([
        handler(call1.req, call1.res),
        handler(call2.req, call2.res),
      ]);

      expect(call1.res.getStatusCode()).toBe(200);
      expect(call2.res.getStatusCode()).toBe(200);
      expect(call1.res.getResponseData().success).toBe(true);
      expect(call2.res.getResponseData().success).toBe(true);
    });

    it('rejects unauthorized dataset access for workspace with permission error', async () => {
      // ws-civic-trans-02 is only authorized for ward_service_demand and civic_infrastructure_defects
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          action: 'execute-query',
          workspaceId: 'ws-civic-trans-02',
          templateId: 'TPL_WELFARE_PROCESSING_TIMES', // requires welfare_scheme_reach
          filters: {},
        },
      });

      await handler(req, res);
      expect(res.getStatusCode()).toBe(400);
      expect(res.getResponseData().error).toBe('CLEAN_ROOM_INVALID_PARAMETERS');
      expect(res.getResponseData().details.some((d) => d.includes('not authorized for dataset'))).toBe(true);
    });

    it('enforces rate limiting and returns Retry-After header when limit exceeded', async () => {
      const fixedIpHeaders = { 'x-forwarded-for': '203.0.113.195' };
      let lastRes = null;

      // Exhaust limit of 30 req/min
      for (let i = 0; i < 32; i++) {
        const { req, res } = createMockReqRes({
          method: 'GET',
          query: { action: 'templates' },
          headers: fixedIpHeaders,
        });
        await handler(req, res);
        lastRes = res;
      }

      expect(lastRes.getStatusCode()).toBe(429);
      expect(lastRes.getResponseData().error).toBe('RATE_LIMIT_EXCEEDED');
      expect(lastRes.getResponseData().retryAfterSeconds).toBeGreaterThan(0);
    });

    it('rejects unsupported HTTP method with 405', async () => {
      const { req, res } = createMockReqRes({ method: 'DELETE' });
      await handler(req, res);
      expect(res.getStatusCode()).toBe(405);
    });
  });
});
