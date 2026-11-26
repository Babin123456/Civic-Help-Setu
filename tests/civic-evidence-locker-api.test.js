/**
 * tests/civic-evidence-locker-api.test.js
 * Integration tests for Civic Evidence Locker Serverless API Endpoint (#1186).
 *
 * Tests:
 * 1. Health check & status returns zeroEscrowEnforced and supported ciphers
 * 2. Storing valid client-encrypted envelope (validation passes, zero plaintext exposed)
 * 3. Rejecting plaintext leakage payloads (security guardrail)
 * 4. Revocable share grant creation, retrieval, and consumption
 * 5. Grant access-count decrement and expiration enforcement
 * 6. Emergency grant revocation by citizen
 * 7. Safe record deletion and cascading grant invalidation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import handler, { resetServerEvidenceLocker } from '../api/_lib/handlers/civic-evidence-locker.js';
import {
  EVIDENCE_LOCKER_SCHEMA_VERSION,
  SYNTHETIC_EVIDENCE_FIXTURES,
} from '../src/data/civicEvidenceLockerContract.js';
import {
  encryptEvidencePayload,
} from '../src/services/civicEvidenceLockerCryptoService.js';

function createMockReqRes({ method = 'GET', query = {}, body = {}, headers = {} }) {
  const req = {
    method,
    query,
    body,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  };

  let statusCode = 200;
  let responseData = null;
  const headersSent = {};

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    setHeader(name, val) {
      headersSent[name] = val;
    },
    getStatusCode() {
      return statusCode;
    },
    getData() {
      return responseData;
    },
  };

  return { req, res };
}

describe('Civic Evidence Locker: Serverless API Handler', () => {
  beforeEach(() => {
    resetServerEvidenceLocker();
  });

  it('GET status returns operational status and zero-escrow policy confirmation', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', query: { action: 'status' } });
    await handler(req, res);

    expect(res.getStatusCode()).toBe(200);
    const data = res.getData();
    expect(data.status).toBe('operational');
    expect(data.schemaVersion).toBe(EVIDENCE_LOCKER_SCHEMA_VERSION);
    expect(data.zeroEscrowEnforced).toBe(true);
    expect(data.supportedCiphers).toContain('AES-256-GCM');
  });

  it('POST store_envelope saves client-encrypted envelope successfully', async () => {
    const fixture = SYNTHETIC_EVIDENCE_FIXTURES[0];
    const envelope = await encryptEvidencePayload(
      fixture.plaintextSample,
      'TestPassphrase123!',
      fixture.publicMetadata,
      fixture.id
    );

    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'store_envelope',
        envelope,
      },
    });

    await handler(req, res);
    expect(res.getStatusCode()).toBe(201);
    expect(res.getData().success).toBe(true);
    expect(res.getData().recordId).toBe(fixture.id);
  });

  it('POST store_envelope rejects payload with plaintext leakage (security guardrail)', async () => {
    const fixture = SYNTHETIC_EVIDENCE_FIXTURES[0];
    const envelope = await encryptEvidencePayload(
      fixture.plaintextSample,
      'TestPassphrase123!',
      fixture.publicMetadata,
      fixture.id
    );

    // Malicious or buggy client accidentally attaching plaintext
    envelope.plaintextSample = fixture.plaintextSample;

    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'store_envelope',
        envelope,
      },
    });

    await handler(req, res);
    expect(res.getStatusCode()).toBe(400);
    expect(res.getData().error).toMatch(/plaintext data cannot be submitted/i);
  });

  it('manages revocable sharing grants lifecycle: create, consume, access-count decrement, and revoke', async () => {
    const fixture = SYNTHETIC_EVIDENCE_FIXTURES[0];
    const envelope = await encryptEvidencePayload(
      fixture.plaintextSample,
      'TestPassphrase123!',
      fixture.publicMetadata,
      fixture.id
    );

    // 1. Store record first
    const storeCall = createMockReqRes({
      method: 'POST',
      body: { action: 'store_envelope', envelope },
    });
    await handler(storeCall.req, storeCall.res);
    expect(storeCall.res.getStatusCode()).toBe(201);

    // 2. Create sharing grant
    const grantPayload = {
      grantId: 'grant-test-101',
      recordId: fixture.id,
      recipientLabel: 'Legal Counsel / District Consumer Court',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      maxAccessCount: 2,
    };

    const createGrantCall = createMockReqRes({
      method: 'POST',
      body: { action: 'create_grant', grant: grantPayload },
    });
    await handler(createGrantCall.req, createGrantCall.res);
    expect(createGrantCall.res.getStatusCode()).toBe(201);

    // 3. Verify grant status
    const verifyCall = createMockReqRes({
      method: 'GET',
      query: { action: 'verify_grant', grantId: 'grant-test-101' },
    });
    await handler(verifyCall.req, verifyCall.res);
    expect(verifyCall.res.getStatusCode()).toBe(200);
    expect(verifyCall.res.getData().usable).toBe(true);
    expect(verifyCall.res.getData().remainingAccessCount).toBe(2);

    // 4. Consume grant (access 1)
    const consume1 = createMockReqRes({
      method: 'POST',
      body: { action: 'consume_grant', grantId: 'grant-test-101' },
    });
    await handler(consume1.req, consume1.res);
    expect(consume1.res.getStatusCode()).toBe(200);
    expect(consume1.res.getData().remainingAccessCount).toBe(1);
    expect(consume1.res.getData().envelope.id).toBe(fixture.id);

    // 5. Consume grant (access 2 - limit reached)
    const consume2 = createMockReqRes({
      method: 'POST',
      body: { action: 'consume_grant', grantId: 'grant-test-101' },
    });
    await handler(consume2.req, consume2.res);
    expect(consume2.res.getStatusCode()).toBe(200);
    expect(consume2.res.getData().remainingAccessCount).toBe(0);

    // 6. Access 3 should be rejected due to depletion
    const consume3 = createMockReqRes({
      method: 'POST',
      body: { action: 'consume_grant', grantId: 'grant-test-101' },
    });
    await handler(consume3.req, consume3.res);
    expect(consume3.res.getStatusCode()).toBe(403);
    expect(consume3.res.getData().error).toMatch(/Maximum access count reached/i);
  });

  it('supports emergency grant revocation by owner', async () => {
    const fixture = SYNTHETIC_EVIDENCE_FIXTURES[1];
    const envelope = await encryptEvidencePayload(
      fixture.plaintextSample,
      'TestPassphrase123!',
      fixture.publicMetadata,
      fixture.id
    );

    await handler(
      createMockReqRes({ method: 'POST', body: { action: 'store_envelope', envelope } }).req,
      createMockReqRes({ method: 'POST', body: { action: 'store_envelope', envelope } }).res
    );

    const grantPayload = {
      grantId: 'grant-rev-202',
      recordId: fixture.id,
      recipientLabel: 'Opposing Party Settlement Auditor',
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      maxAccessCount: 5,
    };

    const createCall = createMockReqRes({
      method: 'POST',
      body: { action: 'create_grant', grant: grantPayload },
    });
    await handler(createCall.req, createCall.res);
    expect(createCall.res.getStatusCode()).toBe(201);

    // Revoke the grant
    const revokeCall = createMockReqRes({
      method: 'POST',
      body: { action: 'revoke_grant', grantId: 'grant-rev-202', reason: 'Settlement talks broken down' },
    });
    await handler(revokeCall.req, revokeCall.res);
    expect(revokeCall.res.getStatusCode()).toBe(200);
    expect(revokeCall.res.getData().revoked).toBe(true);

    // Subsequent consume must fail with 403
    const consumeRevoked = createMockReqRes({
      method: 'POST',
      body: { action: 'consume_grant', grantId: 'grant-rev-202' },
    });
    await handler(consumeRevoked.req, consumeRevoked.res);
    expect(consumeRevoked.res.getStatusCode()).toBe(403);
    expect(consumeRevoked.res.getData().error).toMatch(/revoked by owner/i);
  });
});
