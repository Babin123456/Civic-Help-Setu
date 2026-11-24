import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateAuditReviewSubmission,
  generateAuditSeal,
  OPEN_CONTRACTING_REVIEW_QUEUE,
  PROCESSED_IDEMPOTENCY_KEYS,
} from '../api/_lib/handlers/open-contracting-analytics.js';

describe('api/open-contracting-analytics (#751)', () => {
  beforeEach(() => {
    OPEN_CONTRACTING_REVIEW_QUEUE.length = 0;
    PROCESSED_IDEMPOTENCY_KEYS.clear();
  });

  const validReviewBody = {
    flagId: 'FLAG-SBA-NOT-2026-BLR-002',
    disposition: 'marked_false_positive',
    justification: 'Commissioner administrative approval file BBMP/2026/89 justifies single-bid negotiation due to urgent pre-monsoon desilting timeline.',
    reviewerId: 'AUD-KA-9901',
    jurisdiction: 'Bengaluru Urban, Karnataka',
  };

  it('validates a compliant audit review submission', () => {
    const errors = validateAuditReviewSubmission(validReviewBody);
    expect(errors).toEqual([]);
  });

  it('rejects short or missing justification', () => {
    const bad = { ...validReviewBody, justification: 'Approved.' };
    const errors = validateAuditReviewSubmission(bad);
    expect(errors.some((e) => e.includes('at least 15 characters'))).toBe(true);
  });

  it('strictly rejects personal data (Aadhaar, PAN, Phone, Email)', () => {
    const piiPayload = {
      ...validReviewBody,
      justification: 'Contact auditor at 9876543210 or pan ABCDE1234F with Aadhaar 1234 5678 9012 for details.',
    };
    const errors = validateAuditReviewSubmission(piiPayload);
    expect(errors.some((e) => e.includes('Aadhaar'))).toBe(true);
    expect(errors.some((e) => e.includes('PAN'))).toBe(true);
    expect(errors.some((e) => e.includes('telephone'))).toBe(true);
  });

  it('generates deterministic cryptographic audit seal', () => {
    const timestamp = '2026-11-16T10:00:00Z';
    const s1 = generateAuditSeal('FLAG-1', 'AUD-1', 'marked_false_positive', timestamp);
    const s2 = generateAuditSeal('FLAG-1', 'AUD-1', 'marked_false_positive', timestamp);
    expect(s1).toBe(s2);
    expect(s1).toMatch(/^AUDIT-SEAL-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('handles HTTP POST successfully and queues review', async () => {
    let statusCode = null;
    let jsonBody = null;
    const res = {
      setHeader() {},
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.1' },
      body: validReviewBody,
    };

    await handler(req, res);
    expect(statusCode).toBe(201);
    expect(jsonBody.success).toBe(true);
    expect(jsonBody.record.auditSeal).toMatch(/^AUDIT-SEAL-/);
    expect(OPEN_CONTRACTING_REVIEW_QUEUE.length).toBe(1);
  });

  it('enforces idempotency key reuse returns cached response without duplicate side effects', async () => {
    let statusCode = null;
    let jsonBody = null;
    const res = {
      setHeader() {},
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    const req = {
      method: 'POST',
      headers: {
        'x-forwarded-for': '192.168.1.2',
        'idempotency-key': 'idem-test-key-101',
      },
      body: validReviewBody,
    };

    await handler(req, res);
    expect(statusCode).toBe(201);
    expect(OPEN_CONTRACTING_REVIEW_QUEUE.length).toBe(1);

    // Replay exact same request with same idempotency key
    await handler(req, res);
    expect(statusCode).toBe(200);
    expect(jsonBody.idempotentReplay).toBe(true);
    expect(OPEN_CONTRACTING_REVIEW_QUEUE.length).toBe(1); // Not duplicated
  });

  it('handles HTTP GET with role-based public redaction for citizen persona', async () => {
    OPEN_CONTRACTING_REVIEW_QUEUE.push({
      id: 'REV-001',
      flagId: 'FLAG-SBA-1',
      disposition: 'escalated_for_formal_audit',
      justification: 'Confidential internal note: discrepancies in tender committee scoring.',
      reviewerId: 'CONFIDENTIAL-AUDITOR-ID',
      auditSeal: 'AUDIT-SEAL-1111-2222',
      timestamp: '2026-11-16T12:00:00Z',
    });

    let jsonBody = null;
    const res = {
      setHeader() {},
      status() {
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    const req = {
      method: 'GET',
      query: { role: 'citizen' },
      headers: {},
    };

    await handler(req, res);
    expect(jsonBody.success).toBe(true);
    expect(jsonBody.reviews[0].reviewerId).toBeUndefined();
    expect(jsonBody.reviews[0].justification).toBeUndefined();
    expect(jsonBody.reviews[0].publicSummary).toContain('sealed by authorized oversight auditor');
  });
});
