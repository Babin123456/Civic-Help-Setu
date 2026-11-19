import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateWaterTankerReportPayload,
  generateWaterTankerSeal,
  WATER_TANKER_REPORT_QUEUE,
} from '../api/_lib/handlers/water-tanker-reports.js';

describe('api/water-tanker-reports', () => {
  beforeEach(() => {
    WATER_TANKER_REPORT_QUEUE.length = 0;
  });

  const validPayload = {
    authorityId: 'bengaluru-bwssb-south',
    ward: 'Ward 176 - BTM Layout',
    reportType: 'tariff_overcharge',
    details: 'Private tanker contracted under BWSSB charged ₹950 instead of the government gazetted ceiling of ₹600.',
    officialSourceUrl: 'https://bwssb.karnataka.gov.in/tariff-notification',
  };

  it('validates a compliant citizen report payload', () => {
    const errors = validateWaterTankerReportPayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('rejects missing required fields', () => {
    const errors = validateWaterTankerReportPayload({});
    expect(errors.some((e) => e.includes('authorityId'))).toBe(true);
    expect(errors.some((e) => e.includes('ward'))).toBe(true);
    expect(errors.some((e) => e.includes('details'))).toBe(true);
  });

  it('strictly rejects personal data (Aadhaar, PAN, Phone, Exact Address)', () => {
    const withAadhaar = { ...validPayload, details: 'Resident Aadhaar: 1234 5678 9012 denied supply.' };
    expect(validateWaterTankerReportPayload(withAadhaar).some((e) => e.includes('Aadhaar'))).toBe(true);

    const withPan = { ...validPayload, details: 'Tax ID: ABCDE1234F overbilled.' };
    expect(validateWaterTankerReportPayload(withPan).some((e) => e.includes('PAN'))).toBe(true);

    const withPhone = { ...validPayload, details: 'Call citizen at 9876543210 for verification.' };
    expect(validateWaterTankerReportPayload(withPhone).some((e) => e.includes('phone'))).toBe(true);

    const withDoor = { ...validPayload, details: 'Supply delivered to Flat No 102 instead of public tank.' };
    expect(validateWaterTankerReportPayload(withDoor).some((e) => e.includes('flat/door'))).toBe(true);
  });

  it('rejects insecure http URLs for official source verification', () => {
    const insecure = { ...validPayload, officialSourceUrl: 'http://unsecured-site.org/tariff' };
    const errors = validateWaterTankerReportPayload(insecure);
    expect(errors.some((e) => e.includes('https://'))).toBe(true);
  });

  it('generates deterministic cryptographic seal', () => {
    const timestamp = '2026-11-14T10:00:00.000Z';
    const seal1 = generateWaterTankerSeal('delhi-djb-central', timestamp);
    const seal2 = generateWaterTankerSeal('delhi-djb-central', timestamp);
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^WT-REP-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('handles HTTP POST successfully and queues record for admin review', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '192.168.1.1' },
      body: validPayload,
    };

    let statusCode = 0;
    let jsonResponse = null;

    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          },
        };
      },
    };

    await handler(req, res);

    expect(statusCode).toBe(201);
    expect(jsonResponse.success).toBe(true);
    expect(jsonResponse.seal).toMatch(/^WT-REP-/);
    expect(WATER_TANKER_REPORT_QUEUE.length).toBe(1);
    expect(WATER_TANKER_REPORT_QUEUE[0].authorityId).toBe('bengaluru-bwssb-south');
    expect(WATER_TANKER_REPORT_QUEUE[0].status).toBe('pending_review');
  });

  it('supports GET to return pending queue for admin review', async () => {
    WATER_TANKER_REPORT_QUEUE.push({ id: 'rep_1', status: 'pending_review' });

    const req = { method: 'GET', headers: {} };
    let statusCode = 0;
    let jsonResponse = null;

    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          },
        };
      },
    };

    await handler(req, res);
    expect(statusCode).toBe(200);
    expect(jsonResponse.pendingCount).toBe(1);
    expect(jsonResponse.items.length).toBe(1);
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const req = { method: 'DELETE', headers: {} };
    let statusCode = 0;
    let jsonResponse = null;

    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          },
        };
      },
    };

    await handler(req, res);
    expect(statusCode).toBe(405);
    expect(jsonResponse.error).toContain('Method Not Allowed');
  });
});
