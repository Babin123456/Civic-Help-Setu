import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateProvenanceSubmissionPayload,
  sanitizeText,
} from '../api/_lib/handlers/knowledge-provenance.js';
import { getLineageDAG } from '../src/services/provenanceService.js';
import { initializeProvenanceStorage } from '../src/services/provenanceStorage.js';

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

describe('knowledge-provenance security & threat modeling (#777)', () => {
  beforeEach(() => {
    initializeProvenanceStorage(true);
  });

  describe('injection attack prevention', () => {
    it('sanitizes XSS payloads and script tags from proposed facts', () => {
      const malicious = '<script>alert("xss")</script><b>Legal Fee:</b> Rs. 50';
      const sanitized = sanitizeText(malicious);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('<b>');
      expect(sanitized).toContain('alert("xss")Legal Fee: Rs. 50');
    });

    it('strips control characters and null bytes from input text', () => {
      const payload = 'Malicious\u0000text\u001fpayload';
      const sanitized = sanitizeText(payload);
      expect(sanitized).toBe('Malicioustextpayload');
    });
  });

  describe('data leakage & role isolation', () => {
    it('strictly prevents private reviewer deliberation notes from leaking into public DAG responses', () => {
      const publicDag = getLineageDAG('tree-pruning-permission', { userRole: 'public' });
      for (const review of publicDag.reviews) {
        expect(review.privateNotes).toBeUndefined();
        expect(review.reviewerId).toBeUndefined();
      }
    });

    it('rejects submissions attempting to exfiltrate or store Aadhaar numbers', () => {
      const errors = validateProvenanceSubmissionPayload({
        targetEntityId: 'fact-leak-test',
        sourceUrl: 'https://official.gov.in',
        publisher: 'Govt Agency',
        proposedFact: 'Submitted by citizen Aadhaar 4321 8765 2109 for scrutiny.',
      });
      expect(errors.some((e) => e.includes('Aadhaar'))).toBe(true);
    });

    it('rejects submissions attempting to inject API tokens or passwords', () => {
      const errors = validateProvenanceSubmissionPayload({
        targetEntityId: 'fact-auth-leak',
        sourceUrl: 'https://official.gov.in',
        publisher: 'Govt Agency',
        proposedFact: 'Use auth_bearer token_xyz123 to access gazette API.',
      });
      expect(errors.some((e) => e.includes('restricted keyword'))).toBe(true);
    });
  });

  describe('enumeration and replay abuse controls', () => {
    it('rate limits excessive rapid requests from the same IP client', async () => {
      const ip = '198.51.100.42';
      let lastRes = null;

      // Send 15 requests rapidly (limit is 10)
      for (let i = 0; i < 15; i += 1) {
        const req = {
          method: 'GET',
          headers: { 'x-forwarded-for': ip },
          query: {},
        };
        const res = createMockRes();
        await handler(req, res);
        lastRes = res;
      }

      expect(lastRes.statusCode).toBe(429);
      expect(lastRes.headers['retry-after']).toBeDefined();
      expect(lastRes.body.error).toBe('Too Many Requests');
    });
  });
});
