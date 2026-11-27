import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../api/_lib/handlers/zk-attribute-proof-verify.js';
import {
  createPolicyChallenge,
  resetPolicyCache,
} from '../src/services/zkVerifierPolicyService.js';
import { issueCredentialForPersona } from '../src/services/zkCredentialIssuerService.js';
import { generateAttributeProof } from '../src/services/zkAttributeProofService.js';
import { resetRevocationRegistry } from '../src/services/zkRevocationRegistryService.js';

describe('zk-attribute-proof-verify API endpoint (#1161)', () => {
  beforeEach(() => {
    resetPolicyCache();
    resetRevocationRegistry();
  });

  const createMockRes = () => {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
  };

  it('supports GET requests returning active policies and prototype disclaimer', async () => {
    const req = {
      method: 'GET',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toContain('ZK Attribute Proof Verifier');
    expect(res.body.disclaimer).toContain('PROTOTYPE');
    expect(Array.isArray(res.body.policies)).toBe(true);
    expect(res.body.policies.length).toBeGreaterThan(0);
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const req = {
      method: 'DELETE',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects empty or missing payload with 400', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('required');
  });

  it('strictly rejects payloads containing PII with 422', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        proofPayload: { dummy: 'Aadhaar 1234 5678 9012 should fail' },
        policyRequest: { dummy: 'test' },
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.message).toContain('Prohibited Aadhaar');
  });

  it('successfully verifies a valid cryptographic proof via API with 200', async () => {
    const challenge = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');
    const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI', 5);

    const proofPayload = generateAttributeProof({
      credentialEnvelope,
      secretAttributes,
      policyRequest: challenge,
    });

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        proofPayload,
        policyRequest: challenge,
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result.verified).toBe(true);
    expect(res.body.result.checks.predicatesSatisfied).toBe(true);
    expect(res.body.disclaimer).toContain('PROTOTYPE');
  });

  it('handles concurrent verification requests safely without race conditions', async () => {
    const { credentialEnvelope, secretAttributes } = issueCredentialForPersona('SENIOR_CITIZEN_CHENNAI', 5);

    // Concurrently issue 5 distinct challenges and proofs
    const tasks = Array.from({ length: 5 }, async (_, i) => {
      const challenge = createPolicyChallenge('SENIOR_CITIZEN_CONCESSION_TN');
      const proofPayload = generateAttributeProof({
        credentialEnvelope,
        secretAttributes,
        policyRequest: challenge,
      });

      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': `192.168.1.${i + 10}` },
        body: { proofPayload, policyRequest: challenge },
      };
      const res = createMockRes();
      await handler(req, res);
      return res;
    });

    const responses = await Promise.all(tasks);
    expect(responses).toHaveLength(5);
    for (const res of responses) {
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.verified).toBe(true);
    }
  });

  it('enforces rate-limiting retry boundaries when requests exceed threshold', async () => {
    const uniqueIp = '10.0.0.99';
    let blockedResponse = null;

    // The limiter limit is 30 requests per minute
    for (let i = 0; i < 35; i += 1) {
      const req = {
        method: 'GET',
        headers: { 'x-forwarded-for': uniqueIp },
      };
      const res = createMockRes();
      await handler(req, res);
      if (res.statusCode === 429) {
        blockedResponse = res;
        break;
      }
    }

    expect(blockedResponse).not.toBeNull();
    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.body.error).toBe('Too Many Requests');
    expect(blockedResponse.body.message).toContain('Rate limit exceeded');
  });
});
