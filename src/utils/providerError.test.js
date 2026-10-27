import { describe, it, expect, vi } from 'vitest';
import { describeProviderError, logProviderError } from './providerError';

// Shaped like a Clerk API error: the useful code plus fields that must never be shown.
const clerkError = (code, extra = {}) => ({
  name: 'ClerkAPIResponseError',
  status: 422,
  clerkTraceId: 'trace_9f8e7d',
  message: 'Clerk: sess_2abcSECRET eyJhbGciOiJIUzI1NiJ9.payload.sig user_123 sk_live_abc',
  errors: [
    {
      code,
      message: 'RAW provider message sess_2abcSECRET',
      longMessage: 'RAW long message eyJhbGciOiJIUzI1NiJ9.payload.sig',
      meta: { paramName: 'email_address', sessionId: 'sess_2abcSECRET' },
    },
  ],
  ...extra,
});

describe('describeProviderError', () => {
  it('maps known Clerk codes to fixed wording', () => {
    expect(describeProviderError(clerkError('form_identifier_exists'))).toMatch(/already exists/);
    expect(describeProviderError(clerkError('form_password_pwned'))).toMatch(/data breach/);
    expect(describeProviderError(clerkError('form_password_length_too_short'))).toMatch(/too short/);
    expect(describeProviderError(clerkError('too_many_requests'))).toMatch(/Too many attempts/);
  });

  it('never copies the provider message, long message, ids or trace id', () => {
    const codes = ['form_identifier_exists', 'form_param_format_invalid', 'something_new', ''];
    codes.forEach((code) => {
      const text = describeProviderError(clerkError(code), 'Fallback text');
      ['RAW', 'sess_', 'eyJ', 'user_', 'sk_live', 'trace_', 'email_address', 'Clerk:'].forEach((bit) => {
        expect(text).not.toContain(bit);
      });
    });
  });

  it('uses the fallback for unknown codes and unusable input', () => {
    expect(describeProviderError(clerkError('something_new'), 'Fallback text')).toBe('Fallback text');
    expect(describeProviderError(undefined, 'Fallback text')).toBe('Fallback text');
    expect(describeProviderError(null, 'Fallback text')).toBe('Fallback text');
    expect(describeProviderError('boom', 'Fallback text')).toBe('Fallback text');
    expect(describeProviderError({ errors: [] }, 'Fallback text')).toBe('Fallback text');
  });

  it('has a generic default fallback', () => {
    expect(describeProviderError(new Error('sk_live_abc'))).toBe('Something went wrong. Please try again.');
  });

  it('treats a 429 and a network failure as retryable wording', () => {
    expect(describeProviderError({ status: 429, message: 'x' })).toMatch(/Too many attempts/);
    expect(describeProviderError(new TypeError('Failed to fetch'))).toMatch(/reach the service/);
  });

  it('does not trip over a code named like an Object.prototype member', () => {
    expect(describeProviderError({ errors: [{ code: 'constructor' }] }, 'Fallback text')).toBe('Fallback text');
    expect(describeProviderError({ errors: [{ code: '__proto__' }] }, 'Fallback text')).toBe('Fallback text');
  });
});

describe('logProviderError', () => {
  it('in production logs the label and nothing from the error', () => {
    const log = vi.fn();
    logProviderError('Sign-up failed', clerkError('form_identifier_exists'), { dev: false, log });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Sign-up failed');
  });

  it('in development logs code, status and a redacted message only', () => {
    const log = vi.fn();
    logProviderError('Sign-up failed', clerkError('form_identifier_exists'), { dev: true, log });
    expect(log).toHaveBeenCalledTimes(1);
    const [label, detail] = log.mock.calls[0];
    expect(label).toBe('Sign-up failed');
    expect(detail.code).toBe('form_identifier_exists');
    expect(detail.status).toBe(422);
    expect(Object.keys(detail).sort()).toEqual(['code', 'message', 'status']);
    const dump = JSON.stringify(detail);
    ['sess_', 'eyJ', 'user_123', 'sk_live', 'trace_', 'RAW'].forEach((bit) => expect(dump).not.toContain(bit));
  });

  it('copes with errors that are not objects', () => {
    const log = vi.fn();
    expect(() => logProviderError('x', undefined, { dev: true, log })).not.toThrow();
    expect(() => logProviderError('x', 'a string', { dev: true, log })).not.toThrow();
  });
});
