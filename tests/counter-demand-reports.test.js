import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateCounterDemandReportPayload,
  generateCounterDemandSeal,
  COUNTER_DEMAND_REPORT_QUEUE,
  REPORT_TYPES,
} from '../api/_lib/handlers/counter-demand-reports.js';

describe('api/counter-demand-reports', () => {
  beforeEach(() => {
    COUNTER_DEMAND_REPORT_QUEUE.length = 0;
  });

  const validPayload = {
    officeId: 'off_delhi_south_01',
    reportType: REPORT_TYPES.AGGREGATE_ANOMALY,
    observedDate: '2026-11-18',
    timeSlot: '11:00-12:00',
    summary: 'Observed extreme surge of 70+ citizens due to regional system outage nearby.',
    estimatedFootfallVariancePct: 45,
  };

  it('validates a compliant operational report payload', () => {
    const errors = validateCounterDemandReportPayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('rejects missing mandatory identifiers', () => {
    const errors = validateCounterDemandReportPayload({});
    expect(errors.some((e) => e.includes('officeId'))).toBe(true);
    expect(errors.some((e) => e.includes('reportType'))).toBe(true);
    expect(errors.some((e) => e.includes('observedDate'))).toBe(true);
    expect(errors.some((e) => e.includes('summary'))).toBe(true);
  });

  it('strictly rejects citizen PII (Aadhaar, PAN, phone number, tracking token)', () => {
    const withAadhaar = { ...validPayload, summary: 'Citizen 1234 5678 9012 had token delay.' };
    expect(validateCounterDemandReportPayload(withAadhaar).some((e) => e.includes('Aadhaar'))).toBe(true);

    const withPan = { ...validPayload, summary: 'Applicant ABCDE1234F waiting at counter 3.' };
    expect(validateCounterDemandReportPayload(withPan).some((e) => e.includes('PAN'))).toBe(true);

    const withPhone = { ...validPayload, summary: 'Manager phone 9876543210 called for relief.' };
    expect(validateCounterDemandReportPayload(withPhone).some((e) => e.includes('telephone'))).toBe(true);

    const withAppToken = { ...validPayload, summary: 'Queue token app-12345678 stalled.' };
    expect(validateCounterDemandReportPayload(withAppToken).some((e) => e.includes('tracking ID'))).toBe(true);
  });

  it('generates a deterministic verification seal', () => {
    const timestamp = 1763450000000;
    const seal1 = generateCounterDemandSeal('off_delhi_south_01', timestamp);
    const seal2 = generateCounterDemandSeal('off_delhi_south_01', timestamp);
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^CDR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('processes valid POST requests through the handler', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.1' },
      body: validPayload,
    };

    let responseStatus = null;
    let responseBody = null;
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
      setHeader: () => {},
    };

    await handler(req, res);
    expect(responseStatus).toBe(201);
    expect(responseBody.success).toBe(true);
    expect(responseBody.reportId).toMatch(/^cdr_/);
    expect(COUNTER_DEMAND_REPORT_QUEUE.length).toBe(1);
    expect(COUNTER_DEMAND_REPORT_QUEUE[0].officeId).toBe('off_delhi_south_01');
  });

  it('handles GET requests to retrieve pending queue count', async () => {
    const req = {
      method: 'GET',
      headers: {},
    };

    let responseStatus = null;
    let responseBody = null;
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
      setHeader: () => {},
    };

    await handler(req, res);
    expect(responseStatus).toBe(200);
    expect(responseBody).toHaveProperty('pendingCount');
  });

  it('rejects unsupported HTTP methods (e.g. DELETE) with 405 Method Not Allowed', async () => {
    const req = {
      method: 'DELETE',
      headers: {},
      body: {},
    };

    let responseStatus = null;
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json: () => {},
      setHeader: () => {},
    };

    await handler(req, res);
    expect(responseStatus).toBe(405);
  });
});
