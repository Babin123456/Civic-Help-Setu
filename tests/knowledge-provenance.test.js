import { describe, it, expect } from 'vitest';
import handler, {
  validateProvenanceSubmissionPayload,
  generateProvenanceSeal,
} from '../api/_lib/handlers/knowledge-provenance.js';

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

describe('knowledge-provenance API handler (#777)', () => {
  it('generates consistent deterministic verification seals', () => {
    const seal1 = generateProvenanceSeal('tree-pruning-permission', '2026-11-15T10:00:00Z');
    const seal2 = generateProvenanceSeal('tree-pruning-permission', '2026-11-15T10:00:00Z');
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^PROV-SEAL-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('accepts valid provenance submission payload with official https source', () => {
    const errors = validateProvenanceSubmissionPayload({
      targetEntityId: 'tree-pruning-permission:processingTime',
      sourceUrl: 'https://forest.delhigovt.nic.in/tree-felling-permission',
      publisher: 'Department of Forests & Wildlife, GNCTD',
      proposedFact: 'Statutory decision window is 60 calendar days from application.',
      statutorySection: 'Section 9(3)',
    });
    expect(errors).toEqual([]);
  });

  it('rejects submissions with non-https or invalid URLs', () => {
    const errors = validateProvenanceSubmissionPayload({
      targetEntityId: 'fact-1',
      sourceUrl: 'http://insecure-portal.nic.in',
      publisher: 'Municipal Corporation',
      proposedFact: 'Some updated civic fact information.',
    });
    expect(errors.some((e) => e.includes('HTTPS URL'))).toBe(true);
  });

  it('rejects submissions containing sensitive PII: Aadhaar, PAN, phone numbers', () => {
    const withAadhaar = validateProvenanceSubmissionPayload({
      targetEntityId: 'aadhaar-card:fees',
      sourceUrl: 'https://uidai.gov.in',
      publisher: 'UIDAI',
      proposedFact: 'Citizen with Aadhaar 9876 5432 1098 submitted receipt.',
    });
    expect(withAadhaar.some((e) => e.includes('Aadhaar'))).toBe(true);

    const withPan = validateProvenanceSubmissionPayload({
      targetEntityId: 'pan-card:fees',
      sourceUrl: 'https://incometax.gov.in',
      publisher: 'CBDT',
      proposedFact: 'User with PAN ABCDE1234F verified this statutory circular.',
    });
    expect(withPan.some((e) => e.includes('PAN'))).toBe(true);

    const withPhone = validateProvenanceSubmissionPayload({
      targetEntityId: 'fact-3',
      sourceUrl: 'https://portal.gov.in',
      publisher: 'Directorate',
      proposedFact: 'Call officer on 9876543210 for clarification.',
    });
    expect(withPhone.some((e) => e.includes('phone number'))).toBe(true);
  });

  it('handles GET requests and returns meta information', async () => {
    const req = {
      method: 'GET',
      headers: {},
      query: { limit: '5' },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.meta).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('handles POST requests and generates verification seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        targetEntityId: 'tree-pruning-permission:fees',
        sourceUrl: 'https://forest.delhigovt.nic.in/tree-fees',
        publisher: 'Department of Forests & Wildlife, GNCTD',
        proposedFact: 'Application fee is exempt for residential pruning under 10 cm girth.',
      },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.seal).toMatch(/^PROV-SEAL-/);
    expect(res.body.submissionId).toBeDefined();
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const req = { method: 'DELETE', headers: {} };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toContain('GET');
  });
});

