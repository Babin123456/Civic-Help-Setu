import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SAFE_APPLICATION_ROUTES,
  normalizeRedirectCandidate,
  getSafeRedirectPath,
  storeIntendedAuthRedirect,
  retrieveAndClearAuthRedirect,
  AUTH_REDIRECT_STORAGE_KEY
} from './oauthRedirectService';

function makeMockStorage() {
  const store = new Map();
  return {
    getItem: vi.fn((key) => store.get(key) || null),
    setItem: vi.fn((key, val) => store.set(key, String(val))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear())
  };
}

describe('oauthRedirectService', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeMockStorage();
    vi.stubGlobal('sessionStorage', mockStorage);
    vi.stubGlobal('window', { sessionStorage: mockStorage });
  });

  it('should accept valid relative application routes', () => {
    expect(getSafeRedirectPath('/services')).toBe('/services');
    expect(getSafeRedirectPath('/track?appId=UP12345')).toBe('/track?appId=UP12345');
    expect(getSafeRedirectPath('/assistant#tab-faq')).toBe('/assistant#tab-faq');
    expect(getSafeRedirectPath('/')).toBe('/');
  });

  it('should reject external origins and protocol-relative URLs', () => {
    expect(getSafeRedirectPath('https://evil.com')).toBe('/');
    expect(getSafeRedirectPath('http://attacker.org/phish')).toBe('/');
    expect(getSafeRedirectPath('//attacker.org/services')).toBe('/');
    expect(getSafeRedirectPath('///evil.com')).toBe('/');
    expect(getSafeRedirectPath('/\\evil.com')).toBe('/');
  });

  it('should reject javascript:, data:, and dangerous protocol schemes', () => {
    expect(getSafeRedirectPath('javascript:alert(1)')).toBe('/');
    expect(getSafeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe('/');
    expect(getSafeRedirectPath('vbscript:msgbox("test")')).toBe('/');
    expect(normalizeRedirectCandidate('JAVASCRIPT:alert(1)')).toBeNull();
  });

  it('should defeat encoded and double-encoded bypass attempts', () => {
    // Single encoded //
    expect(getSafeRedirectPath('%2f%2fevil.com')).toBe('/');
    // Double encoded //
    expect(getSafeRedirectPath('%252f%252fevil.com')).toBe('/');
    // Backslash bypass: \evil.com -> %5cevil.com
    expect(getSafeRedirectPath('%5c%5cevil.com')).toBe('/');
    // Path traversal attempting to escape allowlist
    expect(getSafeRedirectPath('/services/../../attacker')).toBe('/');
  });

  it('should fall back to safe home route when unknown or unauthorized route is supplied', () => {
    expect(getSafeRedirectPath('/unregistered-admin-portal')).toBe('/');
    expect(getSafeRedirectPath('/nonexistent-private-route')).toBe('/');
    expect(getSafeRedirectPath(null)).toBe('/');
    expect(getSafeRedirectPath(undefined)).toBe('/');
  });

  it('should safely store and retrieve validated return path in sessionStorage', () => {
    const saved = storeIntendedAuthRedirect('/water-connection?step=2');
    expect(saved).toBe('/water-connection?step=2');
    expect(sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBe('/water-connection?step=2');

    const retrieved = retrieveAndClearAuthRedirect('/');
    expect(retrieved).toBe('/water-connection?step=2');
    expect(sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBeNull();
  });

  it('should safely neutralize malicious values placed in storage before retrieval', () => {
    sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, 'https://hacker.com/steal-token');
    const safeRetrieved = retrieveAndClearAuthRedirect('/services');
    expect(safeRetrieved).toBe('/services');
  });

  it('should resolve session transitions for expired sessions and active resumption', async () => {
    const { resolveSessionTransition, AUTH_FLOW_STATES } = await import('./oauthRedirectService');
    const expiredRes = resolveSessionTransition(AUTH_FLOW_STATES.SESSION_EXPIRED, '/flood-response');
    expect(expiredRes.action).toBe('REDIRECT_TO_SIGN_IN');
    expect(expiredRes.preservedDestination).toBe('/flood-response');

    const activeRes = resolveSessionTransition(AUTH_FLOW_STATES.SESSION_ACTIVE, '/services');
    expect(activeRes.action).toBe('NAVIGATE');
    expect(activeRes.target).toBe('/flood-response'); // retrieved preserved destination
  });

  it('should list security audit rules enforced by redirect service', async () => {
    const { getOAuthRedirectSecurityRules } = await import('./oauthRedirectService');
    const rules = getOAuthRedirectSecurityRules();
    expect(rules.length).toBeGreaterThanOrEqual(5);
    expect(rules[0]).toContain('Protocol-relative URLs');
    expect(rules[1]).toContain('Dangerous executable schemes');
  });
});
