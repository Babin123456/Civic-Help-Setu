import { describe, it, expect } from 'vitest';
import {
  CSP_ORIGIN_INVENTORY,
  DEFAULT_CSP_DIRECTIVES,
  buildCspHeaderString,
  getCspResponseHeaders,
  sanitizeCspViolationReport,
  isOriginPermittedInInventory
} from './cspService';

describe('cspService', () => {
  it('should define comprehensive origin inventory for Clerk, Vercel, Firebase, and OpenStreetMap', () => {
    expect(CSP_ORIGIN_INVENTORY.CLERK.scripts).toContain('https://challenges.cloudflare.com');
    expect(CSP_ORIGIN_INVENTORY.VERCEL.scripts).toContain('https://va.vercel-scripts.com');
    expect(CSP_ORIGIN_INVENTORY.FIREBASE.connect).toContain('https://identitytoolkit.googleapis.com');
    expect(DEFAULT_CSP_DIRECTIVES['object-src']).toEqual(["'none'"]);
  });

  it('should build valid CSP header string with directives, nonces, and report-uri', () => {
    const csp = buildCspHeaderString({
      nonce: 'rAnd0m123',
      reportUri: '/api/csp-report'
    });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'nonce-rAnd0m123'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('report-uri /api/csp-report');
  });

  it('should return Content-Security-Policy-Report-Only header during report-only phase', () => {
    const headers = getCspResponseHeaders({ mode: 'report-only' });
    expect(headers['Content-Security-Policy-Report-Only']).toBeDefined();
    expect(headers['Content-Security-Policy']).toBeUndefined();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
  });

  it('should return enforcing Content-Security-Policy header in enforce mode', () => {
    const headers = getCspResponseHeaders({ mode: 'enforce' });
    expect(headers['Content-Security-Policy']).toBeDefined();
    expect(headers['Content-Security-Policy-Report-Only']).toBeUndefined();
  });

  it('should sanitize violation reports stripping query parameters, sensitive tokens, and PII', () => {
    const rawViolation = {
      'csp-report': {
        'document-uri': 'https://civichelpsetu.in/services?token=SECRET_AUTH_JWT_TOKEN&citizenId=12345',
        'blocked-uri': 'https://malicious-tracker.com/track?payload=sensitiveCitizenData#fragment',
        'violated-directive': 'script-src-elem',
        'effective-directive': 'script-src',
        'status-code': 200
      }
    };

    const sanitized = sanitizeCspViolationReport(rawViolation);
    expect(sanitized.documentUri).toBe('https://civichelpsetu.in/services');
    expect(sanitized.documentUri).not.toContain('SECRET_AUTH_JWT_TOKEN');
    expect(sanitized.blockedUri).toBe('https://malicious-tracker.com/track');
    expect(sanitized.blockedUri).not.toContain('sensitiveCitizenData');
    expect(sanitized.originalPolicySnippet).toBe('REDACTED_FOR_PRIVACY');
  });

  it('should verify whether essential origins are permitted in inventory', () => {
    expect(isOriginPermittedInInventory('https://clerk.civichelpsetu.in/npm/@clerk', 'script')).toBe(true);
    expect(isOriginPermittedInInventory('https://challenges.cloudflare.com/turnstile/v0/api.js', 'script')).toBe(true);
    expect(isOriginPermittedInInventory('https://firestore.googleapis.com', 'connect')).toBe(true);
    expect(isOriginPermittedInInventory('https://a.tile.openstreetmap.org/1/2/3.png', 'image')).toBe(true);
    expect(isOriginPermittedInInventory('https://evil-hacker.com/malicious.js', 'script')).toBe(false);
  });

  it('should retrieve CSP rollout checklist and analyze violation batches', async () => {
    const { getCspRolloutChecklist, analyzeViolationBatch } = await import('./cspService');
    const checklist = getCspRolloutChecklist();
    expect(checklist.length).toBeGreaterThanOrEqual(5);
    expect(checklist[0]).toContain('Clerk domain aliases');

    const sampleViolations = [
      { blockedUri: 'https://evil-analytics.com/tracker.js', violatedDirective: 'script-src' },
      { blockedUri: 'https://evil-analytics.com/other.js', violatedDirective: 'script-src' },
      { blockedUri: 'https://unregistered-cdn.org/style.css', violatedDirective: 'style-src' }
    ];

    const analysis = analyzeViolationBatch(sampleViolations);
    expect(analysis.totalViolations).toBe(3);
    expect(analysis.highRiskViolations).toBe(2);
    expect(analysis.distinctBlockedOrigins.length).toBe(2);
  });
});
