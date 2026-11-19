import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateBarrierSubmissionPayload,
  generateBarrierSeal,
  PEDESTRIAN_BARRIER_QUEUE,
  AUDIT_EVENT_LOGS,
} from '../api/_lib/handlers/pedestrian-barriers.js';

describe('api/pedestrian-barriers (#757)', () => {
  beforeEach(() => {
    PEDESTRIAN_BARRIER_QUEUE.length = 0;
    AUDIT_EVENT_LOGS.length = 0;
  });

  const validPayload = {
    segmentId: 'SEG-101-102',
    barrierType: 'missing_curb_ramp',
    severity: 'high_barrier',
    ward: 'Ward 150 - Bellandur',
    description: 'Abrupt 20cm kerb at crossing without dropped ramp, blocking wheelchair access.',
    photoUrl: 'https://example.com/curb.jpg',
  };

  it('validates a compliant barrier submission payload', () => {
    const errors = validateBarrierSubmissionPayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('rejects short descriptions and missing fields', () => {
    const badPayload = {
      segmentId: '',
      barrierType: 'invalid_type',
      severity: 'invalid_sev',
      ward: '',
      description: 'Too short',
    };
    const errors = validateBarrierSubmissionPayload(badPayload);
    expect(errors.some((e) => e.includes('segmentId'))).toBe(true);
    expect(errors.some((e) => e.includes('barrierType'))).toBe(true);
    expect(errors.some((e) => e.includes('severity'))).toBe(true);
    expect(errors.some((e) => e.includes('Description must be at least'))).toBe(true);
  });

  it('detects and rejects personal PII in barrier descriptions', () => {
    const piiPayload = {
      ...validPayload,
      description: 'Please inspect quickly. Call me on 9123456789 or aadhaar 1111 2222 3333.',
    };
    const errors = validateBarrierSubmissionPayload(piiPayload);
    expect(errors.some((e) => e.includes('Aadhaar'))).toBe(true);
    expect(errors.some((e) => e.includes('telephone'))).toBe(true);
  });

  it('generates a stable cryptographic audit seal', () => {
    const timestamp = '2026-11-16T10:00:00Z';
    const s1 = generateBarrierSeal('BAR-101', 'Ward 150', timestamp);
    const s2 = generateBarrierSeal('BAR-101', 'Ward 150', timestamp);
    expect(s1).toBe(s2);
    expect(s1).toMatch(/^SEAL-BARRIER-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('handles GET requests and returns sanitized barrier observations', async () => {
    PEDESTRIAN_BARRIER_QUEUE.push({
      id: 'BAR-TEST-1',
      segmentId: 'SEG-101-102',
      barrierType: 'damaged_footpath',
      severity: 'moderate_impediment',
      ward: 'Ward 150 - Bellandur',
      description: 'Broken paver slabs near crossing.',
      status: 'reported',
      reportedAt: new Date().toISOString(),
      internalReviewerNotes: 'Internal secret notes that must be scrubbed',
    });

    const req = {
      method: 'GET',
      query: { action: 'list', ward: 'Ward 150 - Bellandur' },
      headers: {},
    };

    let responseData = null;
    let statusCode = null;

    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          },
        };
      },
    };

    await handler(req, res);

    expect(statusCode).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.observations.length).toBe(1);
    expect(responseData.observations[0].id).toBe('BAR-TEST-1');
    expect(responseData.observations[0].internalReviewerNotes).toBeUndefined(); // Scrubbed!
  });

  it('requires operator or reviewer role for observation verification', async () => {
    PEDESTRIAN_BARRIER_QUEUE.push({
      id: 'BAR-TEST-2',
      segmentId: 'SEG-101-102',
      barrierType: 'damaged_footpath',
      severity: 'moderate_impediment',
      status: 'reported',
      ward: 'Ward 150 - Bellandur',
    });

    // 1. Citizen attempt (denied)
    const citizenReq = {
      method: 'POST',
      query: { action: 'verify' },
      headers: { 'x-user-role': 'citizen' },
      body: { observationId: 'BAR-TEST-2', decision: 'verify' },
    };

    let citizenCode = null;
    let citizenData = null;

    const citizenRes = {
      setHeader: () => {},
      status: (code) => {
        citizenCode = code;
        return {
          json: (data) => {
            citizenData = data;
          },
        };
      },
    };

    await handler(citizenReq, citizenRes);
    expect(citizenCode).toBe(403);
    expect(citizenData.errorCode).toBe('ERR_UNAUTHORIZED');

    // 2. Reviewer attempt (allowed)
    const reviewerReq = {
      method: 'POST',
      query: { action: 'verify' },
      headers: { 'x-user-role': 'reviewer' },
      body: {
        observationId: 'BAR-TEST-2',
        decision: 'verify',
        reasonCode: 'statutory_inspection_passed',
        reviewerNotes: 'Inspected and confirmed defect.',
      },
    };

    let reviewerCode = null;
    let reviewerData = null;

    const reviewerRes = {
      setHeader: () => {},
      status: (code) => {
        reviewerCode = code;
        return {
          json: (data) => {
            reviewerData = data;
          },
        };
      },
    };

    await handler(reviewerReq, reviewerRes);
    expect(reviewerCode).toBe(200);
    expect(reviewerData.success).toBe(true);
    expect(reviewerData.observation.status).toBe('verified');
    expect(AUDIT_EVENT_LOGS.length).toBe(1);
  });
});
