import { describe, it, expect } from 'vitest';
import handler from '../api/synthetic-datasets.js';
import { validateGenerationPayload } from '../api/_lib/syntheticSchemaContract.js';

function createMockReqRes({ method = 'GET', body = {}, headers = {} } = {}) {
  const req = {
    method,
    body,
    headers: {
      'x-real-ip': '127.0.0.1',
      ...headers,
    },
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };

  return { req, res };
}

describe('api/synthetic-datasets (#778)', () => {
  describe('Schema Validation', () => {
    it('accepts valid generation profile configuration', () => {
      const payload = {
        seed: 4294967,
        scaleConfig: {
          servicesCount: 5,
          officesCount: 3,
          applicationsCount: 50,
          grievancesCount: 20,
        },
        edgeCaseRates: {
          statutoryDeadlineOverduePct: 0.2,
          queryDeficiencyPct: 0.15,
        },
      };

      const result = validateGenerationPayload(payload);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects invalid seed bounds', () => {
      const payload = { seed: -50 };
      const result = validateGenerationPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('seed'))).toBe(true);
    });

    it('rejects scale configuration exceeding limits', () => {
      const payload = {
        scaleConfig: {
          applicationsCount: 5000, // exceeds 500 max limit
        },
      };
      const result = validateGenerationPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('applicationsCount'))).toBe(true);
    });
  });

  describe('Serverless Handler Operations', () => {
    it('returns service capabilities on GET', async () => {
      const { req, res } = createMockReqRes({ method: 'GET' });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.service).toContain('Synthetic Dataset Generator');
      expect(res.body.watermark).toBe('SYNTH-CIVIC-SETU-v1');
      expect(res.body.supportedEntities).toContain('SyntheticService');
    });

    it('processes and accepts valid generation payload on POST', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          seed: 1337,
          scaleConfig: { servicesCount: 2, applicationsCount: 10 },
        },
        headers: { 'x-idempotency-key': 'idem-test-99' },
      });

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ACCEPTED_FOR_GENERATION');
      expect(res.body.watermark).toBe('SYNTH-CIVIC-SETU-v1');
    });

    it('strictly rejects payloads containing real Aadhaar or PAN identifiers', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        body: {
          seed: 1337,
          notes: 'Testing with real Aadhaar: 3456 7890 1234',
        },
      });

      await handler(req, res);

      expect(res.statusCode).toBe(422);
      expect(res.body.code).toBe('ERR_SYNTH_PII_SUSPECT');
    });

    it('rejects unsupported HTTP methods', async () => {
      const { req, res } = createMockReqRes({ method: 'DELETE' });
      await handler(req, res);

      expect(res.statusCode).toBe(405);
    });
  });
});
