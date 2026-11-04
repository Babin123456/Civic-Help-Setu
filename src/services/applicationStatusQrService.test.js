import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createOrRotateStatusToken,
  resolvePublicStatusByToken,
  revokeStatusToken,
  checkLookupRateLimit,
  buildStatusQrPath,
} from './applicationStatusQrService';

describe('applicationStatusQrService (#458)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    });
  });

  const mockApp = {
    id: 'APP-9988',
    serviceName: 'Ration Card Renewal',
    department: 'Food & Civil Supplies',
    status: 'Field Inspection Scheduled',
    submissionDate: '2026-10-15',
    // Sensitive fields that MUST NOT leak
    applicantAadhaar: '9988-7766-5544',
    applicantPhone: '+91 9876543210',
    internalOfficerNotes: 'Priority verification required',
  };

  it('creates an opaque status token without leaking sensitive fields', () => {
    const record = createOrRotateStatusToken(mockApp.id, mockApp);

    expect(record.token).toBeDefined();
    expect(record.token.length).toBeGreaterThanOrEqual(16);
    expect(record.token).not.toContain(mockApp.id);
    expect(record.publicData.serviceName).toBe('Ration Card Renewal');
    expect(record.publicData.applicantAadhaar).toBeUndefined();
    expect(record.publicData.applicantPhone).toBeUndefined();
  });

  it('resolves active status by token', () => {
    const record = createOrRotateStatusToken(mockApp.id, mockApp);
    const res = resolvePublicStatusByToken(record.token, 'test_client_1');

    expect(res.status).toBe('ACTIVE');
    expect(res.readOnly).toBe(true);
    expect(res.application.serviceName).toBe('Ration Card Renewal');
    expect(res.application.stage).toBe('Field Inspection Scheduled');
    expect(res.application.milestones).toBeDefined();
  });

  it('rotates previous tokens when a new one is created', () => {
    const token1 = createOrRotateStatusToken(mockApp.id, mockApp);
    const token2 = createOrRotateStatusToken(mockApp.id, mockApp);

    const check1 = resolvePublicStatusByToken(token1.token, 'test_client_2');
    expect(check1.status).toBe('REVOKED');

    const check2 = resolvePublicStatusByToken(token2.token, 'test_client_3');
    expect(check2.status).toBe('ACTIVE');
  });

  it('revokes an active token and blocks further access', () => {
    const record = createOrRotateStatusToken(mockApp.id, mockApp);
    const revoked = revokeStatusToken(record.token);
    expect(revoked).toBe(true);

    const res = resolvePublicStatusByToken(record.token, 'test_client_4');
    expect(res.status).toBe('REVOKED');
    expect(res.error).toContain('rotated or deactivated');
  });

  it('enforces client rate limiting after 10 requests within window', () => {
    for (let i = 0; i < 10; i++) {
      const check = checkLookupRateLimit('rate_limit_client');
      expect(check.allowed).toBe(true);
    }

    const blocked = checkLookupRateLimit('rate_limit_client');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('builds SVG QR matrix for lookup URL', () => {
    const url = 'https://civichelpsetu.gov.in/app-status/abc123token';
    const { path, size } = buildStatusQrPath(url);
    expect(path).toBeDefined();
    expect(path.startsWith('M')).toBe(true);
    expect(size).toBeGreaterThan(20);
  });
});
