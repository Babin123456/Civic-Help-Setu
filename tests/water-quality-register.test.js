/**
 * tests/water-quality-register.test.js
 * API endpoint tests for Community Water-Quality Sampling & Lab Results (#754).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateWaterIntakePayload,
  generateServerWaterSeal,
  WATER_QUALITY_INTAKE_QUEUE,
} from '../api/_lib/handlers/water-quality-register.js';

describe('api/water-quality-register (#754)', () => {
  beforeEach(() => {
    WATER_QUALITY_INTAKE_QUEUE.length = 0;
  });

  const validPayload = {
    waterPointId: 'WP-BLR-W150-01',
    waterPointName: 'Bellandur Village Community Standpost Tap',
    pointType: 'public_standpost',
    ward: 'Ward 150 - Bellandur',
    city: 'Bengaluru',
    sampleType: 'routine_surveillance',
    collectionDate: '2026-11-16T08:00:00Z',
    notes: 'Sample collected following 3 minute flush. Clear water.',
    testedParameters: [
      { code: 'ph', value: 7.4 },
      { code: 'tds', value: 310 },
      { code: 'e_coli', value: 0 },
    ],
  };

  it('validates a compliant water-quality sampling payload', () => {
    const errors = validateWaterIntakePayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('strictly rejects personal data (Aadhaar, Phone, Flat/Door Numbers)', () => {
    const piiPayload = {
      ...validPayload,
      notes: 'Sample taken near resident Aadhaar 8492 1048 2910, phone 9845012345, Flat No. 201',
    };
    const errors = validateWaterIntakePayload(piiPayload);
    expect(errors.some((e) => e.includes('Aadhaar'))).toBe(true);
    expect(errors.some((e) => e.includes('Phone'))).toBe(true);
    expect(errors.some((e) => e.includes('flat/door'))).toBe(true);
  });

  it('generates a deterministic server seal starting with SEAL-WQR', () => {
    const seal = generateServerWaterSeal('WP-01', '2026-11-16', '2026-11-16T10:00:00Z');
    expect(seal).toMatch(/^SEAL-WQR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('handles GET requests returning IS 10500 standards citation and queue items', async () => {
    const req = { method: 'GET' };
    let responseStatus;
    let responseBody;

    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };

    await handler(req, res);
    expect(responseStatus).toBe(200);
    expect(responseBody.success).toBe(true);
    expect(responseBody.specification).toBe('IS 10500:2012');
  });

  it('handles POST requests and queues verified report with cryptographic seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '10.0.0.99' },
      body: validPayload,
    };
    let responseStatus;
    let responseBody;

    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
      setHeader: () => {},
    };

    await handler(req, res);
    expect(responseStatus).toBe(201);
    expect(responseBody.success).toBe(true);
    expect(responseBody.seal).toMatch(/^SEAL-WQR-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(WATER_QUALITY_INTAKE_QUEUE.length).toBe(1);
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const req = { method: 'DELETE' };
    let responseStatus;
    let responseBody;
    const res = {
      status: (code) => {
        responseStatus = code;
        return { json: (body) => { responseBody = body; } };
      },
    };

    await handler(req, res);
    expect(responseStatus).toBe(405);
    expect(responseBody.error).toContain('Method Not Allowed');
  });

  it('enforces rate limiting returning 429 when threshold exceeded', async () => {
    let lastStatus;
    const ip = '192.168.1.42';

    for (let i = 0; i < 12; i += 1) {
      const req = {
        method: 'POST',
        headers: { 'x-vercel-forwarded-for': ip },
        body: { ...validPayload, waterPointId: `WP-RATE-${i}` },
      };
      const res = {
        status: (code) => {
          lastStatus = code;
          return { json: () => {} };
        },
        setHeader: () => {},
      };
      await handler(req, res);
    }

    expect(lastStatus).toBe(429);
  });
});
