import { describe, it, expect } from 'vitest';
import handler, {
  validateObservationPayload,
  generateHeatObservationSeal,
} from '../api/_lib/handlers/heat-relief-observations.js';
import { OPERATIONAL_STATUS, CAPACITY_STATUS } from '../src/data/upHeatwaveReliefContract.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
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
  return res;
}

describe('heat-relief-observations API handler (#983)', () => {
  const referenceTime = new Date('2026-05-15T12:00:00.000Z');

  it('generates a deterministic cryptographic verification seal', () => {
    const seal1 = generateHeatObservationSeal('lko-relief-001', '2026-05-15T10:00:00Z');
    const seal2 = generateHeatObservationSeal('lko-relief-001', '2026-05-15T10:00:00Z');
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^UP-HEAT-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  describe('validateObservationPayload', () => {
    const validBody = {
      facilityId: 'lko-relief-001',
      observedStatus: OPERATIONAL_STATUS.OPEN,
      currentCapacityStatus: CAPACITY_STATUS.AVAILABLE,
      feedbackNote: 'Chilled drinking water active, plenty of seating.',
      timestamp: '2026-05-15T11:50:00.000Z',
      coordinates: { lat: 26.85, lng: 80.94 },
    };

    it('accepts valid anonymous community observation', () => {
      const errors = validateObservationPayload(validBody, referenceTime);
      expect(errors).toEqual([]);
    });

    it('rejects submissions with personal PII (Aadhaar, phone, door number, personal name)', () => {
      const withAadhaar = validateObservationPayload(
        { ...validBody, feedbackNote: 'Aadhaar 1234 5678 9012 verification' },
        referenceTime
      );
      expect(withAadhaar.some((e) => e.includes('Aadhaar'))).toBe(true);

      const withPhone = validateObservationPayload(
        { ...validBody, feedbackNote: 'Call caretaker at 9876543210' },
        referenceTime
      );
      expect(withPhone.some((e) => e.includes('telephone number'))).toBe(true);

      const withDoor = validateObservationPayload(
        { ...validBody, feedbackNote: 'Located at Flat 304, Green Court' },
        referenceTime
      );
      expect(withDoor.some((e) => e.includes('door/flat number'))).toBe(true);

      const withName = validateObservationPayload(
        { ...validBody, reporterName: 'Sunita Sharma' },
        referenceTime
      );
      expect(withName.some((e) => e.includes('Personal names are strictly excluded'))).toBe(true);
    });

    it('rejects coordinates situated outside Uttar Pradesh boundaries', () => {
      const outOfBounds = validateObservationPayload(
        { ...validBody, coordinates: { lat: 13.0827, lng: 80.2707 } }, // Chennai
        referenceTime
      );
      expect(outOfBounds.some((e) => e.includes('outside Uttar Pradesh'))).toBe(true);
    });
  });

  describe('HTTP Handler Invocation', () => {
    it('handles GET requests and returns moderation queue status', async () => {
      const req = { method: 'GET', headers: {}, query: {} };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('rejects non-GET/POST HTTP methods with 405 Method Not Allowed', async () => {
      const req = { method: 'DELETE', headers: {} };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(405);
      expect(res.body.ok).toBe(false);
      expect(res.headers.allow).toContain('GET, POST');
    });

    it('successfully posts an observation, generates a seal, and stores in review queue', async () => {
      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.101' },
        body: {
          facilityId: 'lko-relief-001',
          observedStatus: OPERATIONAL_STATUS.OPEN,
          currentCapacityStatus: CAPACITY_STATUS.AVAILABLE,
          feedbackNote: 'Cooling center is functioning normally with ORS packets at front desk.',
          timestamp: new Date().toISOString(),
        },
      };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.verificationSeal).toMatch(/^UP-HEAT-[0-9A-F]{4}-[0-9A-F]{4}$/);
      expect(res.body.record.facilityId).toBe('lko-relief-001');
    });

    it('returns 400 Bad Request when validation fails', async () => {
      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.102' },
        body: {
          facilityId: '', // Invalid empty facilityId
          observedStatus: 'non_existent_status',
        },
      };
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details.length).toBeGreaterThan(0);
    });
  });
});
