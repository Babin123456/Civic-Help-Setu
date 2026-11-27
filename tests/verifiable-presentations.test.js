import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/verifiable-presentations.js';
import { generatePresentation } from '../src/services/verifiablePresentationService.js';
import { CREDENTIAL_SCHEMA_TYPES, TRUST_TIERS } from '../src/data/walletContracts.js';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
};

describe('api/verifiable-presentations handler (#1159)', () => {
  const testCred = {
    id: 'cred_api_test_01',
    schemaType: CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF,
    trustTier: TRUST_TIERS.SELF_ASSERTED,
    createdAt: new Date().toISOString(),
    claims: {
      fullName: 'Rahul Varma',
      wardNumber: 'Ward 14',
      city: 'Pune'
    }
  };

  it('generates ephemeral challenge nonces on GET', async () => {
    const req = {
      method: 'GET',
      query: { action: 'challenge' },
      headers: { 'x-forwarded-for': '127.0.0.1' }
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.challenge.startsWith('chn_')).toBe(true);
  });

  it('verifies a valid verifiable presentation on POST', async () => {
    const { presentation } = await generatePresentation({
      credential: testCred,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:meter-connection',
      nonce: 'challenge_12345'
    });

    const req = {
      method: 'POST',
      body: {
        presentation,
        expectedAudience: 'civicbridge:service:meter-connection',
        expectedNonce: 'challenge_12345'
      },
      headers: { 'x-forwarded-for': '127.0.0.1' }
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verdict).toBe('PASS');
    expect(res.body.disclosedClaims.wardNumber).toBe('Ward 14');
    expect(res.body.isSelfAsserted).toBe(true);
    expect(res.body.statutoryNotice).toBeDefined();
  });

  it('fails verification on audience mismatch (replay defense)', async () => {
    const { presentation } = await generatePresentation({
      credential: testCred,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:meter-connection',
      nonce: 'challenge_12345'
    });

    const req = {
      method: 'POST',
      body: {
        presentation,
        expectedAudience: 'civicbridge:service:unauthorized-other-service',
        expectedNonce: 'challenge_12345'
      },
      headers: { 'x-forwarded-for': '127.0.0.1' }
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.verdict).toBe('FAIL');
    expect(res.body.code).toBe('AUDIENCE_MISMATCH');
  });

  it('fails verification on expired presentation', async () => {
    const past = Date.now() - 60000;
    const { presentation } = await generatePresentation({
      credential: testCred,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:meter-connection',
      nonce: 'challenge_12345',
      validDurationSeconds: 10,
      now: past
    });

    const req = {
      method: 'POST',
      body: {
        presentation,
        currentTime: Date.now()
      },
      headers: { 'x-forwarded-for': '127.0.0.1' }
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.verdict).toBe('FAIL');
    expect(res.body.code).toBe('PRESENTATION_EXPIRED');
  });

  it('fails verification on tampered attribute claim', async () => {
    const { presentation } = await generatePresentation({
      credential: testCred,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:meter-connection',
      nonce: 'challenge_12345'
    });

    presentation.disclosedClaims.wardNumber = 'Ward 99'; // Modified claim

    const req = {
      method: 'POST',
      body: { presentation },
      headers: { 'x-forwarded-for': '127.0.0.1' }
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.verdict).toBe('FAIL');
    expect(res.body.code).toBe('TAMPERED_ATTRIBUTE');
  });

  it('rejects oversized payloads (> 32KB)', async () => {
    const hugePadding = 'x'.repeat(40000);
    const req = {
      method: 'POST',
      body: { presentation: {}, padding: hugePadding },
      headers: { 'x-forwarded-for': '127.0.0.1' }
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Payload exceeds maximum allowable size');
  });

  it('handles concurrent presentation verification requests cleanly', async () => {
    const { presentation } = await generatePresentation({
      credential: testCred,
      selectedAttributeKeys: ['wardNumber'],
      audience: 'civicbridge:service:meter-connection',
      nonce: 'challenge_concurrent'
    });

    const calls = Array.from({ length: 5 }, (_, i) => {
      const req = {
        method: 'POST',
        body: {
          presentation,
          expectedAudience: 'civicbridge:service:meter-connection',
          expectedNonce: 'challenge_concurrent'
        },
        headers: { 'x-forwarded-for': `192.168.1.${10 + i}` }
      };
      const res = createMockRes();
      return handler(req, res).then(() => res);
    });

    const results = await Promise.all(calls);
    expect(results.length).toBe(5);
    for (const res of results) {
      expect(res.statusCode).toBe(200);
      expect(res.body.verdict).toBe('PASS');
    }
  });

  it('enforces rate limiting and sets Retry-After header on abuse', async () => {
    const abusiveIp = '10.99.88.77';
    let lastRes;

    // Send 35 requests to trip the 30-request limiter
    for (let i = 0; i < 35; i += 1) {
      const req = {
        method: 'GET',
        query: { action: 'challenge' },
        headers: { 'x-forwarded-for': abusiveIp }
      };
      const res = createMockRes();
      await handler(req, res);
      lastRes = res;
    }

    expect(lastRes.statusCode).toBe(429);
    expect(lastRes.body.success).toBe(false);
    expect(lastRes.headers['Retry-After']).toBeDefined();
    expect(lastRes.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
    const req = {
      method: 'DELETE',
      headers: { 'x-forwarded-for': '192.168.100.200' }
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toContain('not allowed');
  });
});
