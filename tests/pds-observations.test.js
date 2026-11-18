import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateObservationPayload,
  generateObservationSeal,
  PDS_OBSERVATION_QUEUE,
} from '../api/pds-observations.js';

describe('api/pds-observations endpoint (#723)', () => {
  beforeEach(() => {
    PDS_OBSERVATION_QUEUE.length = 0;
  });

  it('validates a conformant observation payload', () => {
    const payload = {
      shopId: 'delhi-fps-paharganj-101',
      shopName: 'Fair Price Shop No. 101 - Paharganj',
      observationType: 'epos_receipt',
      observationText: 'Electronic weighing scale connected to e-POS device; printed receipt issued successfully.',
      observedDate: '2026-02-14',
    };
    const errors = validateObservationPayload(payload);
    expect(errors).toEqual([]);
  });

  it('strictly rejects payloads containing Ration Card numbers or Aadhaar for privacy', () => {
    const payloadWithRc = {
      shopId: 'delhi-fps-paharganj-101',
      observationType: 'queue_status',
      observationText: 'My ration card 109283746501 could not authenticate.',
    };
    const errors1 = validateObservationPayload(payloadWithRc);
    expect(errors1.some((e) => e.includes('Ration Card'))).toBe(true);

    const payloadWithAadhaar = {
      shopId: 'delhi-fps-paharganj-101',
      observationType: 'queue_status',
      observationText: 'Beneficiary with 5544 3322 1100 waited 20 minutes.',
    };
    const errors2 = validateObservationPayload(payloadWithAadhaar);
    expect(errors2.some((e) => e.includes('Aadhaar'))).toBe(true);
  });

  it('strictly rejects payloads claiming live stock without authorization', () => {
    const payloadWithStock = {
      shopId: 'delhi-fps-paharganj-101',
      observationType: 'service_correction',
      observationText: 'Shop has remaining stock of grains.',
      liveStock: { wheatBags: 20 },
    };
    const errors = validateObservationPayload(payloadWithStock);
    expect(errors.some((e) => e.includes('Live stock'))).toBe(true);
  });

  it('generates consistent deterministic cryptographic verification seals', () => {
    const seal1 = generateObservationSeal('delhi-fps-101', '2026-02-14T10:00:00Z');
    const seal2 = generateObservationSeal('delhi-fps-101', '2026-02-14T10:00:00Z');
    expect(seal1).toMatch(/^PDS-OBS-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(seal1).toBe(seal2);
  });

  it('handles GET requests by returning queued observations', async () => {
    PDS_OBSERVATION_QUEUE.push({
      id: 'obs_seed_1',
      shopId: 'delhi-fps-paharganj-101',
      status: 'pending_review',
    });

    const req = { method: 'GET' };
    let responseStatus = 0;
    let responseData = null;
    const res = {
      setHeader: () => {},
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => {
            responseData = data;
          },
        };
      },
    };

    await handler(req, res);
    expect(responseStatus).toBe(200);
    expect(responseData.pendingCount).toBe(1);
    expect(responseData.items.length).toBe(1);
  });

  it('handles valid POST submissions and enqueues them with verification seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '192.168.1.50' },
      body: {
        shopId: 'delhi-fps-paharganj-101',
        shopName: 'Fair Price Shop No. 101',
        observationType: 'closure_timing',
        observationText: 'Notice board states shop will open at 10:00 AM on Friday due to stock delivery.',
        observedDate: '2026-02-14',
      },
    };
    let responseStatus = 0;
    let responseData = null;
    const res = {
      setHeader: () => {},
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => {
            responseData = data;
          },
        };
      },
    };

    await handler(req, res);
    expect(responseStatus).toBe(201);
    expect(responseData.ok).toBe(true);
    expect(responseData.verificationSeal).toMatch(/^PDS-OBS-/);
    expect(PDS_OBSERVATION_QUEUE.length).toBe(1);
    expect(PDS_OBSERVATION_QUEUE[0].status).toBe('pending_review');
  });
});

