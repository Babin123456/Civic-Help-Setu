import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeRevocationList,
  getRevocationList,
  checkRevocationStatus,
  revokeCredential,
  resetRevocationRegistry,
} from './zkRevocationRegistryService';

describe('zkRevocationRegistryService', () => {
  const testIssuer = 'did:civic:dept-revenue-tn';

  beforeEach(() => {
    resetRevocationRegistry();
  });

  it('initializes a fresh revocation list where all indices are active', () => {
    const list = initializeRevocationList(testIssuer, 64);
    expect(list.issuerId).toBe(testIssuer);
    expect(list.version).toBe(1);
    expect(list.bitVector).toHaveLength(64);
    expect(list.bitVector.every((bit) => bit === 0)).toBe(true);
  });

  it('checks revocation status and returns ACTIVE for unrevoked index', () => {
    const res = checkRevocationStatus(testIssuer, 5);
    expect(res.revoked).toBe(false);
    expect(res.status).toBe('ACTIVE');
  });

  it('revokes a credential index and updates version and listHash', () => {
    const initialList = getRevocationList(testIssuer);
    const initialHash = initialList.listHash;

    const revocation = revokeCredential(testIssuer, 5, 'Lost card');
    expect(revocation.revoked).toBe(true);
    expect(revocation.statusListIndex).toBe(5);
    expect(revocation.version).toBe(2);
    expect(revocation.listHash).not.toBe(initialHash);

    const check = checkRevocationStatus(testIssuer, 5);
    expect(check.revoked).toBe(true);
    expect(check.status).toBe('REVOKED');

    // Index 6 should remain active
    expect(checkRevocationStatus(testIssuer, 6).revoked).toBe(false);
  });

  it('rejects out of bounds index gracefully', () => {
    const res = checkRevocationStatus(testIssuer, 999999);
    expect(res.revoked).toBe(true);
    expect(res.status).toBe('INDEX_EXCEEDS_CAPACITY');
  });

  it('rejects invalid inputs safely', () => {
    expect(checkRevocationStatus(null, 0).revoked).toBe(true);
    expect(checkRevocationStatus(testIssuer, -1).revoked).toBe(true);
  });
});
