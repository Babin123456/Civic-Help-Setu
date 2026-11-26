import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateProgressSubmissionPayload,
  validateProjectCreationPayload,
  validateVerificationReviewPayload,
  generateProjectEvidenceSeal,
  PUBLIC_PROJECT_API_QUEUE,
} from '../api/_lib/handlers/public-projects.js';

describe('api/public-projects handler (#752)', () => {
  beforeEach(() => {
    PUBLIC_PROJECT_API_QUEUE.length = 0;
  });

  const validSubmissionPayload = {
    projectId: 'proj-road-101',
    milestoneId: 'ms-road-101-3',
    narrative: 'Dense Bituminous Macadam (DBM) base layer completed across 2.4km corridor with lab density tests.',
    reportedPercent: 100,
    evidenceAssets: [
      {
        storageUrl: 'https://storage.civicbridge.internal/road101/dbm_inspection.jpg',
        caption: 'DBM compaction cross-section',
      },
    ],
    idempotencyKey: 'idemp-test-001',
  };

  describe('Payload Validations', () => {
    it('validates a compliant progress submission payload', () => {
      const errors = validateProgressSubmissionPayload(validSubmissionPayload);
      expect(errors).toEqual([]);
    });

    it('rejects short narratives or missing evidence assets', () => {
      const bad = {
        ...validSubmissionPayload,
        narrative: 'Short',
        evidenceAssets: [],
      };
      const errors = validateProgressSubmissionPayload(bad);
      expect(errors.some((e) => e.includes('narrative must be at least 20'))).toBe(true);
      expect(errors.some((e) => e.includes('At least one evidence asset is required'))).toBe(true);
    });

    it('strictly rejects submissions containing PII (Aadhaar, PAN, Phone, Email)', () => {
      const piiPayload = {
        ...validSubmissionPayload,
        narrative: 'Work completed by contractor phone +91 9876543210 email engineer@builder.com with Aadhaar 4455 6677 8899.',
      };
      const errors = validateProgressSubmissionPayload(piiPayload);
      expect(errors.some((e) => e.includes('Aadhaar'))).toBe(true);
      expect(errors.some((e) => e.includes('phone'))).toBe(true);
      expect(errors.some((e) => e.includes('email'))).toBe(true);
    });

    it('validates project creation payload with strict enum and jurisdiction requirements', () => {
      const validProject = {
        title: 'New Stormwater Box Drain Corridor',
        description: 'Constructing 1.5km RCC stormwater drain box culvert to alleviate monsoon flooding.',
        category: 'drains',
        jurisdiction: { wardNumber: 'Ward 112' },
      };
      expect(validateProjectCreationPayload(validProject)).toEqual([]);

      const invalidProject = {
        title: 'Short',
        description: 'Short desc',
        category: 'invalid_category',
        jurisdiction: {},
      };
      const errors = validateProjectCreationPayload(invalidProject);
      expect(errors.some((e) => e.includes('title must be between'))).toBe(true);
      expect(errors.some((e) => e.includes('Category must be one of'))).toBe(true);
      expect(errors.some((e) => e.includes('wardNumber is required'))).toBe(true);
    });

    it('validates verification review decisions strictly', () => {
      const validReview = {
        projectId: 'proj-road-101',
        milestoneId: 'ms-road-101-3',
        submissionId: 'sub-01',
        decision: 'APPROVE',
        findings: 'Physical inspection completed. Core cutter test verifies layer thickness satisfies MORTH specs.',
      };
      expect(validateVerificationReviewPayload(validReview)).toEqual([]);

      const invalidReview = {
        projectId: 'proj-1',
        milestoneId: 'ms-1',
        submissionId: 'sub-1',
        decision: 'INVALID_DECISION',
        findings: 'Too short',
      };
      const errors = validateVerificationReviewPayload(invalidReview);
      expect(errors.some((e) => e.includes('Decision must be one of'))).toBe(true);
      expect(errors.some((e) => e.includes('findings must be at least 15'))).toBe(true);
    });
  });

  describe('Cryptographic Seal Generation', () => {
    it('generates deterministic evidence seals', () => {
      const timestamp = '2026-11-15T12:00:00Z';
      const s1 = generateProjectEvidenceSeal('proj-road-101', 'ms-road-101-3', timestamp);
      const s2 = generateProjectEvidenceSeal('proj-road-101', 'ms-road-101-3', timestamp);
      expect(s1).toBe(s2);
      expect(s1).toMatch(/^SEAL-PPP-[0-9A-F]{4}-[0-9A-F]{4}$/);
    });
  });

  describe('Serverless Handler Invocation', () => {
    const mockRes = () => {
      const res = {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(k, v) {
          res.headers[k] = v;
          return res;
        },
        status(code) {
          res.statusCode = code;
          return res;
        },
        json(payload) {
          res.body = payload;
          return res;
        },
      };
      return res;
    };

    it('returns queue stats on GET request', async () => {
      const req = { method: 'GET', headers: {} };
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.queueLength).toBe(0);
    });

    it('handles progress submission POST and issues seal', async () => {
      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.1' },
        body: {
          action: 'submit_progress',
          ...validSubmissionPayload,
        },
      };
      const res = mockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.seal).toMatch(/^SEAL-PPP-[0-9A-F]{4}-[0-9A-F]{4}$/);
      expect(PUBLIC_PROJECT_API_QUEUE.length).toBe(1);
    });

    it('handles verification decision POST and queues review record', async () => {
      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.2' },
        body: {
          action: 'verify_milestone',
          projectId: 'proj-road-101',
          milestoneId: 'ms-road-101-3',
          submissionId: 'sub-01',
          decision: 'APPROVE',
          findings: 'Approved after site re-inspection and core density verification.',
        },
      };
      const res = mockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.review.decision).toBe('APPROVE');
      expect(PUBLIC_PROJECT_API_QUEUE.length).toBe(1);
    });

    it('rejects disallowed HTTP methods', async () => {
      const req = { method: 'DELETE', headers: {} };
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(405);
      expect(res.body.code).toBe('METHOD_NOT_ALLOWED');
    });
  });
});
