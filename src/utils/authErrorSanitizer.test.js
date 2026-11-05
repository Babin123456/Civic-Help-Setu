import { describe, it, expect } from 'vitest';
import {
  classifyAuthError,
  getSafeAuthErrorMessage,
  getDevAuthDiagnostics,
  AUTH_ERROR_CODES,
} from './authErrorSanitizer';

describe('authErrorSanitizer (#209)', () => {
  const sensitiveError = {
    name: 'ClerkAPIResponseError',
    message: 'Failed request with token sk_live_998877665544 and session sess_abc123',
    stack: 'Error: at line 42 /internal/auth/clerk.js',
    errors: [
      {
        code: 'form_identifier_exists',
        message: 'Account with email test@example.com already exists in tenant org_123',
      },
    ],
  };

  it('sanitizes sensitive provider error and strips all internal tokens and stack traces', () => {
    const safe = getSafeAuthErrorMessage(sensitiveError);

    expect(safe.code).toBe(AUTH_ERROR_CODES.USER_EXISTS);
    expect(safe.title).toBe('Account Already Exists');
    expect(safe.message).toContain('already registered with this email address');
    expect(safe.action).toContain('Try signing in');

    // Verify raw tokens or stacks do not appear anywhere in safe object
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain('sk_live');
    expect(serialized).not.toContain('sess_abc123');
    expect(serialized).not.toContain('org_123');
    expect(serialized).not.toContain('tenant');
    expect(serialized).not.toContain('stack');
  });

  it('detects missing configuration and produces safe fallback message', () => {
    const configError = new Error('Missing clerk publishable key in environment VITE_CLERK_PUBLISHABLE_KEY');
    const safe = getSafeAuthErrorMessage(configError);

    expect(safe.code).toBe(AUTH_ERROR_CODES.MISSING_CONFIG);
    expect(safe.title).toBe('Authentication Not Configured');
    expect(safe.message).toContain('demonstration mode');
    expect(safe.retryable).toBe(false);
  });

  it('detects network disconnections gracefully', () => {
    const safe = getSafeAuthErrorMessage(new Error('Failed to fetch'), { online: false });
    expect(safe.code).toBe(AUTH_ERROR_CODES.NETWORK_DISCONNECTED);
    expect(safe.title).toBe('Connection Lost');
    expect(safe.retryable).toBe(true);
  });

  it('maps unknown errors to generic safe recovery actions', () => {
    const safe = getSafeAuthErrorMessage(new Error('random unhandled internal exception'));
    expect(safe.code).toBe(AUTH_ERROR_CODES.UNKNOWN_ERROR);
    expect(safe.title).toBe('Unable to Complete Request');
    expect(safe.action).toContain('refresh the page and try again');
  });

  it('strictly returns null diagnostics in production environments', () => {
    const diagnostics = getDevAuthDiagnostics(sensitiveError, false); // isDevelopment = false
    expect(diagnostics).toBeNull();
  });

  it('provides redacted diagnostics in development mode without secrets', () => {
    const diagnostics = getDevAuthDiagnostics(sensitiveError, true); // isDevelopment = true
    expect(diagnostics).not.toBeNull();
    expect(diagnostics.diagnosticsExcludedSecrets).toBe(true);
    expect(diagnostics.sanitizedMessage).not.toContain('sk_live_998877665544');
    expect(diagnostics.sanitizedMessage).toContain('[REDACTED_SECRET]');
  });
});
