import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateFloodReportPayload,
  generateFloodReportSeal,
  FLOOD_REPORT_QUEUE,
} from '../api/_lib/handlers/flood-incident-reports.js';

describe('api/flood-incident-reports (#985)', () => {
  beforeEach(() => {
    FLOOD_REPORT_QUEUE.length = 0;
  });

  const validPayload = {
    district: 'Lucknow',
    locality: 'Hazratganj crossing near GPO',
    incidentType: 'flooded_road',
    depthCategory: 'knee_deep',
    observedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    notes: 'Standing water near bus stop. Two wheelers stalling.',
    coordinates: { lat: 26.85, lng: 80.94 },
  };

  const referenceTime = new Date('2026-11-19T23:00:00.000Z');

  it('validates a compliant citizen flood report payload', () => {
    const errors = validateFloodReportPayload(validPayload, referenceTime);
    expect(errors).toEqual([]);
  });

  it('rejects missing required fields', () => {
    const errors = validateFloodReportPayload({}, referenceTime);
    expect(errors.some((e) => e.includes('district'))).toBe(true);
    expect(errors.some((e) => e.includes('locality'))).toBe(true);
    expect(errors.some((e) => e.includes('incidentType'))).toBe(true);
    expect(errors.some((e) => e.includes('observedAt'))).toBe(true);
  });

  it('strictly rejects personal data (Aadhaar, PAN, Phone, Exact Flat/Door Address)', () => {
    const withAadhaar = { ...validPayload, notes: 'Citizen Aadhaar: 1234 5678 9012 observed waterlogging.' };
    expect(validateFloodReportPayload(withAadhaar, referenceTime).some((e) => e.includes('Aadhaar'))).toBe(true);

    const withPan = { ...validPayload, notes: 'Complainant PAN: ABCDE1234F reports blocked nallah.' };
    expect(validateFloodReportPayload(withPan, referenceTime).some((e) => e.includes('PAN'))).toBe(true);

    const withPhone = { ...validPayload, notes: 'Call citizen at 9876543210 for live depth update.' };
    expect(validateFloodReportPayload(withPhone, referenceTime).some((e) => e.includes('phone'))).toBe(true);

    const withDoor = { ...validPayload, locality: 'Waterlogging right in front of Flat No 402, Royal Palms' };
    expect(validateFloodReportPayload(withDoor, referenceTime).some((e) => e.includes('flat/door'))).toBe(true);
  });

  it('rejects future observation timestamps (anti-spoofing)', () => {
    const futureTime = new Date('2026-11-20T04:00:00.000Z').toISOString();
    const futurePayload = { ...validPayload, observedAt: futureTime };
    const errors = validateFloodReportPayload(futurePayload, referenceTime);
    expect(errors.some((e) => e.includes('cannot be in the future'))).toBe(true);
  });

  it('rejects coordinates outside Uttar Pradesh administrative boundaries', () => {
    // Bangalore coordinates
    const outOfBounds = { ...validPayload, coordinates: { lat: 12.97, lng: 77.59 } };
    const errors = validateFloodReportPayload(outOfBounds, referenceTime);
    expect(errors.some((e) => e.includes('outside administrative boundaries of Uttar Pradesh'))).toBe(true);
  });

  it('enforces issuing authority and bulletin ref for official disaster alerts', () => {
    const unverifiedOfficial = { ...validPayload, sourceTier: 'official_emergency_alert' };
    const errors = validateFloodReportPayload(unverifiedOfficial, referenceTime);
    expect(errors.some((e) => e.includes('issuingAuthority'))).toBe(true);
    expect(errors.some((e) => e.includes('officialBulletinRef'))).toBe(true);
  });

  it('generates deterministic cryptographic seal', () => {
    const timestamp = '2026-11-19T22:30:00.000Z';
    const seal1 = generateFloodReportSeal('Lucknow', timestamp);
    const seal2 = generateFloodReportSeal('Lucknow', timestamp);
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^UP-FLD-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('successfully processes valid POST request through handler and queues incident', async () => {
    let statusCode = 0;
    let responseBody = null;

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: validPayload,
    };

    const res = {
      setHeader() {
        return this;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    await handler(req, res);

    expect(statusCode).toBe(201);
    expect(responseBody.success).toBe(true);
    expect(responseBody.trackingSeal).toMatch(/^UP-FLD-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(FLOOD_REPORT_QUEUE.length).toBe(1);
    expect(FLOOD_REPORT_QUEUE[0].district).toBe('Lucknow');
  });
});
