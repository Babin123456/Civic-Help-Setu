import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_INVENTORY_ALLOWLIST,
  STORAGE_DATA_CLASSIFICATIONS,
  inspectStorageWrite,
  safeStorageWrite,
  purgeCitizenStorageOnConsentWithdrawal,
  exportSanitizedCitizenStorage,
  assertStorageCompliance
} from './sensitiveStorageGuardService';

function makeMockStorage() {
  const store = new Map();
  return {
    getItem: vi.fn((key) => store.get(key) || null),
    setItem: vi.fn((key, val) => store.set(key, String(val))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear())
  };
}

describe('sensitiveStorageGuardService', () => {
  let mockLocal;
  let mockSession;

  beforeEach(() => {
    mockLocal = makeMockStorage();
    mockSession = makeMockStorage();
    vi.stubGlobal('localStorage', mockLocal);
    vi.stubGlobal('sessionStorage', mockSession);
  });

  it('should define allowlisted storage keys with owners and classifications', () => {
    expect(STORAGE_INVENTORY_ALLOWLIST['civicbridge_theme'].classification).toBe(STORAGE_DATA_CLASSIFICATIONS.PREFERENCE);
    expect(STORAGE_INVENTORY_ALLOWLIST['civicbridge_privacy_consent'].consentRequired).toBe(true);
    expect(STORAGE_INVENTORY_ALLOWLIST['chs_post_auth_dest'].storageType).toBe('sessionStorage');
  });

  it('should allow legitimate non-sensitive writes for approved keys', () => {
    const res = inspectStorageWrite('civicbridge_theme', 'dark', 'localStorage');
    expect(res.allowed).toBe(true);
    expect(res.classification).toBe('PREFERENCE');

    const ok = safeStorageWrite('civicbridge_theme', 'dark', mockLocal);
    expect(ok).toBe(true);
    expect(mockLocal.setItem).toHaveBeenCalledWith('civicbridge_theme', 'dark');
  });

  it('should reject unapproved keys attempting to write to browser storage', () => {
    const res = inspectStorageWrite('random_unapproved_key', { some: 'data' }, 'localStorage');
    expect(res.allowed).toBe(false);
    expect(res.violationType).toBe('UNAPPROVED_KEY');

    const ok = safeStorageWrite('random_unapproved_key', { some: 'data' }, mockLocal);
    expect(ok).toBe(false);
  });

  it('should reject storage type mismatch (e.g. attempting to put session key into localStorage)', () => {
    const res = inspectStorageWrite('chs_post_auth_dest', '/services', 'localStorage');
    expect(res.allowed).toBe(false);
    expect(res.violationType).toBe('STORAGE_TYPE_MISMATCH');
  });

  it('should block writes containing JWT auth tokens', () => {
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const payload = { user: 'citizen', token: fakeJwt };

    const res = inspectStorageWrite('civicbridge_privacy_consent', payload, 'localStorage');
    expect(res.allowed).toBe(false);
    expect(res.violationType).toBe('PROHIBITED_SENSITIVE_DATA');
    expect(res.patternMatched).toBe('JWT_BEARER_TOKEN');
  });

  it('should block writes containing 12-digit Aadhaar identity numbers', () => {
    const payload = { citizenNote: 'Resident Aadhaar is 5544 3322 1100 for verification' };
    const res = inspectStorageWrite('chs_offline_report_drafts', payload, 'localStorage');
    expect(res.allowed).toBe(false);
    expect(res.violationType).toBe('PROHIBITED_SENSITIVE_DATA');
    expect(res.patternMatched).toBe('AADHAAR_NUMBER');
  });

  it('should block writes containing raw document base64 data', () => {
    const fakePdfBytes = 'data:application/pdf;base64,' + 'A'.repeat(120);
    const res = inspectStorageWrite('chs_offline_report_drafts', { doc: fakePdfBytes }, 'localStorage');
    expect(res.allowed).toBe(false);
    expect(res.patternMatched).toBe('RAW_DOCUMENT_BASE64');
  });

  it('should purge all consent-bound storage keys upon consent withdrawal', () => {
    mockLocal.setItem('civicbridge_theme', 'dark');
    mockLocal.setItem('civicbridge_privacy_consent', 'true');
    mockLocal.setItem('chs_offline_report_drafts', JSON.stringify([{ id: 1 }]));

    const purged = purgeCitizenStorageOnConsentWithdrawal(mockLocal);
    expect(purged).toContain('civicbridge_privacy_consent');
    expect(purged).toContain('chs_offline_report_drafts');
    expect(purged).not.toContain('civicbridge_theme'); // preference retained
    expect(mockLocal.removeItem).toHaveBeenCalledWith('civicbridge_privacy_consent');
  });

  it('should export sanitized citizen storage package', () => {
    mockLocal.setItem('civicbridge_theme', 'dark');
    mockLocal.setItem('civicbridge_privacy_consent', 'true');

    const rawExport = exportSanitizedCitizenStorage(mockLocal);
    const parsed = JSON.parse(rawExport);
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.entries['civicbridge_theme'].data).toBe('dark');
    expect(parsed.entries['civicbridge_theme'].classification).toBe('PREFERENCE');
  });

  it('should assert storage compliance accurately', () => {
    expect(assertStorageCompliance({ unapprovedKeyCount: 0, sensitiveLeakCount: 0 })).toBe(true);
    expect(assertStorageCompliance({ unapprovedKeyCount: 1, sensitiveLeakCount: 0 })).toBe(false);
    expect(assertStorageCompliance({ unapprovedKeyCount: 0, sensitiveLeakCount: 2 })).toBe(false);
  });
});
