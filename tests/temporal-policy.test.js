import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateEvaluationRequest,
  detectPiiViolation,
} from '../api/_lib/handlers/temporal-policy.js';
import { getOutboxEvents, _resetEventBusInternalStores } from '../src/services/civicDomainEventBusService.js';

describe('api/temporal-policy handler (#1155)', () => {
  beforeEach(() => {
    _resetEventBusInternalStores();
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      writableEnded: false,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        this.writableEnded = true;
        return this;
      },
      end() {
        this.writableEnded = true;
        return this;
      },
    };
    return res;
  };

  describe('Boundary Validation & Zero-PII Defense', () => {
    it('detects and flags PII violations in payloads', () => {
      expect(detectPiiViolation({ notes: 'My Aadhaar is 1234 5678 9012' })).toBe(true);
      expect(detectPiiViolation({ pan: 'ABCDE1234F' })).toBe(true);
      expect(detectPiiViolation({ phone: '9876543210' })).toBe(true);
      expect(detectPiiViolation({ annualIncome: 500000, landAcres: 2 })).toBe(false);
    });

    it('rejects malformed requests missing ruleFamilyId or containing PII', () => {
      const errs1 = validateEvaluationRequest({});
      expect(errs1).toContain('ruleFamilyId is required and must be a string.');

      const errs2 = validateEvaluationRequest({
        ruleFamilyId: 'scheme_ews',
        asOfDate: 'not-a-date',
      });
      expect(errs2).toContain('asOfDate must be a valid ISO 8601 date string.');

      const errs3 = validateEvaluationRequest({
        ruleFamilyId: 'scheme_ews',
        applicantAadhaar: '2345 6789 0123',
      });
      expect(errs3.some((e) => e.includes('Direct citizen PII'))).toBe(true);
    });
  });

  describe('HTTP Handler Request Processing', () => {
    it('handles OPTIONS pre-flight request with correct CORS headers', async () => {
      const req = { method: 'OPTIONS', headers: {} };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(204);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res.headers['Access-Control-Allow-Methods']).toContain('GET, POST, OPTIONS');
    });

    it('handles GET queries for as-of policy resolution and anomaly discovery', async () => {
      const req = {
        method: 'GET',
        headers: { 'x-client-key': 'test-client' },
        query: {
          ruleFamilyId: 'scheme_ews_certificate',
          jurisdictionCode: 'IN-MH',
          asOfDate: '2022-06-15T00:00:00.000Z',
        },
      };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.schemaVersion).toBe('1.0.0');
      expect(res.body.resolution.rule).toBeDefined();
      expect(res.body.resolution.rule.version).toBe('2.0.0');
      expect(res.body.anomalies).toBeDefined();
      expect(res.body.disclaimer).toBeDefined();
    });

    it('rejects GET requests without ruleFamilyId with HTTP 400', async () => {
      const req = { method: 'GET', headers: { 'x-client-key': 'test-client' }, query: {} };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('ruleFamilyId');
    });

    it('handles POST evaluation and stages a TEMPORAL_POLICY_EVALUATED outbox event', async () => {
      const req = {
        method: 'POST',
        headers: { 'x-client-key': 'test-client-post' },
        body: {
          action: 'EVALUATE',
          ruleFamilyId: 'scheme_ews_certificate',
          jurisdictionCode: 'IN-MH',
          asOfDate: '2022-06-15T00:00:00.000Z',
          citizenFacts: {
            annualFamilyIncome: 500000,
            agriculturalLandAcres: 2,
            residentialPlotSqYards: 100,
          },
        },
      };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.schemaVersion).toBe('1.0.0');
      expect(res.body.evaluation.outcome).toBe('ELIGIBLE');
      expect(res.body.snapshot.snapshotHash).toHaveLength(64);

      // Verify domain outbox event was staged
      const events = getOutboxEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);
      const evalEvent = events.find((e) => e.eventType === 'TEMPORAL_POLICY_EVALUATED');
      expect(evalEvent).toBeDefined();
      expect(evalEvent.aggregateId).toBe(res.body.snapshot.evaluationId);
      expect(evalEvent.payload.ruleFamilyId).toBe('scheme_ews_certificate');
    });

    it('handles POST multi-date simulation requests', async () => {
      const req = {
        method: 'POST',
        headers: { 'x-client-key': 'test-sim-client' },
        body: {
          action: 'SIMULATE',
          ruleFamilyId: 'scheme_ews_certificate',
          jurisdictionCode: 'IN-MH',
          citizenFacts: {
            annualFamilyIncome: 750000,
            agriculturalLandAcres: 2,
            residentialPlotSqYards: 100,
            aadhaarSeededBankAccount: true,
          },
          dates: ['2019-06-01T00:00:00.000Z', '2022-06-01T00:00:00.000Z'],
        },
      };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.action).toBe('SIMULATE');
      expect(res.body.simulation.simulations).toHaveLength(2);
    });

    it('rejects unsupported HTTP methods with HTTP 405 Method Not Allowed', async () => {
      const req = { method: 'DELETE', headers: { 'x-client-key': 'test-delete' } };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(405);
      expect(res.body.error).toContain('Method DELETE not allowed');
    });
  });
});
