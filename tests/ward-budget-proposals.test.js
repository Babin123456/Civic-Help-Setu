import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateProposalSubmissionPayload,
  generateProposalSeal,
  WARD_PROPOSAL_QUEUE,
} from '../api/_lib/handlers/ward-budget-proposals.js';

describe('api/ward-budget-proposals (#765)', () => {
  beforeEach(() => {
    WARD_PROPOSAL_QUEUE.length = 0;
  });

  const validPayload = {
    title: 'Footpath Restoration and Tactile Paving on 14th Main',
    category: 'roads_footpaths',
    ward: 'Ward 150 - Bellandur',
    approximateLocation: '14th Main from Green Glen layout to Outer Ring Road',
    description: 'Construct continuous 1.8m pedestrian footpaths with ramps and tactile guiding paving for senior citizens and school children.',
    costEstimateRange: {
      min: 1200000,
      max: 1500000,
    },
  };

  it('validates a compliant citizen proposal payload', () => {
    const errors = validateProposalSubmissionPayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('rejects missing or short title and description', () => {
    const badPayload = {
      title: 'Short',
      category: 'roads_footpaths',
      ward: 'Ward 150',
      approximateLocation: 'Road',
      description: 'Too short',
      costEstimateRange: { min: 1000, max: 2000 },
    };
    const errors = validateProposalSubmissionPayload(badPayload);
    expect(errors.some((e) => e.includes('title must be between'))).toBe(true);
    expect(errors.some((e) => e.includes('description must be at least'))).toBe(true);
  });

  it('strictly rejects personal data (Aadhaar, PAN, Phone, Email)', () => {
    const piiPayload = {
      ...validPayload,
      description: 'Please contact me at 9876543210 or user@example.com with Aadhaar 4321 8765 2109 to inspect the pothole.',
    };
    const errors = validateProposalSubmissionPayload(piiPayload);
    expect(errors.some((e) => e.includes('Aadhaar'))).toBe(true);
    expect(errors.some((e) => e.includes('phone'))).toBe(true);
    expect(errors.some((e) => e.includes('email'))).toBe(true);
  });

  it('rejects invalid or capped cost estimates', () => {
    const overCap = {
      ...validPayload,
      costEstimateRange: { min: 60000000, max: 70000000 }, // > 5 Crore
    };
    const errors = validateProposalSubmissionPayload(overCap);
    expect(errors.some((e) => e.includes('ceiling'))).toBe(true);
  });

  it('generates deterministic cryptographic seal', () => {
    const timestamp = '2026-11-15T10:00:00Z';
    const s1 = generateProposalSeal('Footpath Repair', 'Ward 150', timestamp);
    const s2 = generateProposalSeal('Footpath Repair', 'Ward 150', timestamp);
    expect(s1).toBe(s2);
    expect(s1).toMatch(/^SEAL-WBP-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('handles HTTP POST successfully and queues record for deliberation', async () => {
    let statusCode = null;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
      setHeader() {},
    };

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: validPayload,
    };

    await handler(req, res);
    expect(statusCode).toBe(201);
    expect(jsonBody.success).toBe(true);
    expect(jsonBody.record.seal).toMatch(/^SEAL-WBP-/);
    expect(WARD_PROPOSAL_QUEUE.length).toBe(1);
  });

  it('supports GET to return pending deliberation queue', async () => {
    let statusCode = null;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
      setHeader() {},
    };

    const req = { method: 'GET' };
    await handler(req, res);
    expect(statusCode).toBe(200);
    expect(jsonBody.success).toBe(true);
    expect(Array.isArray(jsonBody.submissions)).toBe(true);
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    let statusCode = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
      setHeader() {},
    };

    const req = { method: 'DELETE' };
    await handler(req, res);
    expect(statusCode).toBe(405);
  });
});

