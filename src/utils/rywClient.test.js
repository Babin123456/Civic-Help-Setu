/* global Buffer */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveRywToken,
  getRywToken,
  clearAllRywTokens,
  captureRywTokenFromResponse,
  attachRywTokenToHeaders,
  parseStaleReadHeaders,
  createRywFetch,
  decodeTokenPayload,
} from './rywClient.js';

describe('Client Read-Your-Writes Token Utility (#1233)', () => {
  beforeEach(() => {
    clearAllRywTokens();
  });

  it('saves and retrieves token for a user', () => {
    const dummyToken = 'header.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoyMDgwMDAwMDAwfQ.signature';
    saveRywToken(dummyToken, 'user123');

    const retrieved = getRywToken('user123');
    expect(retrieved).toBe(dummyToken);
  });

  it('decodes payload safely', () => {
    const payload = { sub: 'u1', exp: 2000000000 };
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const token = `header.${base64}.sig`;

    const decoded = decodeTokenPayload(token);
    expect(decoded.sub).toBe('u1');
    expect(decoded.exp).toBe(2000000000);
  });

  it('clears expired tokens', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 100;
    const base64 = Buffer.from(JSON.stringify({ sub: 'u1', exp: pastExp })).toString('base64');
    const expiredToken = `header.${base64}.sig`;

    saveRywToken(expiredToken, 'u1');
    expect(getRywToken('u1')).toBeNull();
  });

  it('captures token from Response object headers', () => {
    const token = 'header.payload.sig';
    const mockResponse = {
      headers: {
        get: (name) => (name.toLowerCase() === 'x-read-your-writes-token' ? token : null),
      },
    };

    const captured = captureRywTokenFromResponse(mockResponse, 'u2');
    expect(captured).toBe(token);
    expect(getRywToken('u2')).toBe(token);
  });

  it('attaches token to outgoing headers', () => {
    saveRywToken('saved-token-123', 'u3');

    const headers = { 'Content-Type': 'application/json' };
    const updated = attachRywTokenToHeaders(headers, 'u3');

    expect(updated['x-read-your-writes-token']).toBe('saved-token-123');
    expect(updated['Content-Type']).toBe('application/json');
  });

  it('parses stale-read metadata headers correctly', () => {
    const mockRes = {
      headers: {
        'x-served-by': 'us-central1',
        'x-consistency': 'bounded_stale',
        'x-stale-read': 'true',
        'x-replica-lag-ms': '125',
        'x-primary-region': 'asia-south1',
        'x-failover': 'false',
      },
    };

    const info = parseStaleReadHeaders(mockRes);
    expect(info.isStale).toBe(true);
    expect(info.replicaLagMs).toBe(125);
    expect(info.servedBy).toBe('us-central1');
    expect(info.primaryRegion).toBe('asia-south1');
    expect(info.disclosureLabel).toContain('125ms');
  });

  it('creates transparent wrapped fetch with auto token handling', async () => {
    const issuedToken = 'header.payload.sig-issued';
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {
        get: (name) => {
          if (name === 'x-read-your-writes-token') return issuedToken;
          if (name === 'x-served-by') return 'europe-west1';
          if (name === 'x-replica-lag-ms') return '50';
          return null;
        },
      },
    });

    const rywFetch = createRywFetch(mockFetch, () => 'u4');
    const res = await rywFetch('/api/catalogue', { headers: { 'Accept': 'application/json' } });

    expect(mockFetch).toHaveBeenCalled();
    expect(getRywToken('u4')).toBe(issuedToken);
    expect(res.multiRegionMetadata.servedBy).toBe('europe-west1');
    expect(res.multiRegionMetadata.replicaLagMs).toBe(50);
  });
});
