import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  resetServerLedger,
  getServerLedger,
  getServerKeyring,
} from './civic-release-ledger.js';

describe('api/_lib/handlers/civic-release-ledger.js', () => {
  beforeEach(() => {
    resetServerLedger();
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
      setHeader(k, v) {
        this.headers[k] = v;
      },
    };
    return res;
  };

  it('handles GET request to fetch release ledger entries', async () => {
    const req = {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.1' },
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.schemaVersion).toBe('1.0.0');
    expect(res.body.totalBlocks).toBeGreaterThanOrEqual(1);
    expect(res.body.blocks[0].entryType).toBe('genesis');
  });

  it('handles GET request for public keys', async () => {
    const req = {
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.2' },
      query: { action: 'keys' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.keys.length).toBeGreaterThan(0);
    expect(res.body.keys[0].keyId).toBe('authority-key-dept-rev-2026');
    expect(res.body.keys[0].privateKeyJwk).toBeUndefined(); // Never leak private keys
  });

  it('rejects POST with unknown signing key', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.3' },
      query: { action: 'append-release' },
      body: {
        manifestId: 'manifest-unknown-key',
        guidanceId: 'sample',
        signatureBlock: {
          keyId: 'non-existent-key',
        },
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Unrecognized Key');
  });

  it('rejects POST with revoked/compromised signing key', async () => {
    // Revoke key first
    const reqRevoke = {
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.4' },
      query: { action: 'key-lifecycle' },
      body: {
        keyId: 'authority-key-dept-rev-2026',
        lifecycleEvent: 'REVOCATION',
        reason: 'Compromised key test',
      },
    };
    const resRevoke = createMockRes();
    await handler(reqRevoke, resRevoke);
    expect(resRevoke.statusCode).toBe(200);

    // Try signing with revoked key
    const reqPost = {
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.5' },
      query: { action: 'append-release' },
      body: {
        manifestId: 'manifest-revoked-key',
        guidanceId: 'tree-pruning',
        version: '1.0.0',
        signatureBlock: {
          keyId: 'authority-key-dept-rev-2026',
        },
      },
    };
    const resPost = createMockRes();
    await handler(reqPost, resPost);

    expect(resPost.statusCode).toBe(403);
    expect(resPost.body.error).toBe('Revoked Signing Key');
  });
});
