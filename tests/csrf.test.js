/**
 * tests/csrf.test.js
 * Unit tests for client-side CSRF helper (src/utils/csrf.js).
 */

import { describe, it, expect } from 'vitest';
import {
  parseCookieString,
  getCookie,
  getCsrfToken,
  withCsrfHeaders,
  DEFAULT_CSRF_COOKIE,
  DEFAULT_CSRF_HEADER,
} from '../src/utils/csrf.js';

describe('client-side csrf helper', () => {
  const cookieString = 'foo=bar; __Host-csrf=token1234567890abcdef; other=value';

  it('parses specific cookies correctly from cookie string', () => {
    expect(parseCookieString(cookieString, 'foo')).toBe('bar');
    expect(parseCookieString(cookieString, '__Host-csrf')).toBe('token1234567890abcdef');
    expect(parseCookieString(cookieString, 'missing')).toBeNull();
  });

  it('reads specific cookies via getCookie with source string', () => {
    expect(getCookie('__Host-csrf', cookieString)).toBe('token1234567890abcdef');
    expect(getCookie('missing', cookieString)).toBeNull();
  });

  it('gets csrf token from default cookie name', () => {
    const raw = '__Host-csrf=secret_csrf_token_value_12345';
    expect(getCsrfToken(DEFAULT_CSRF_COOKIE, raw)).toBe('secret_csrf_token_value_12345');
  });

  it('falls back to alias cookie names if default is absent', () => {
    const raw = 'session=abc; csrf_token=alias_csrf_token_value_67890';
    expect(getCsrfToken(DEFAULT_CSRF_COOKIE, raw)).toBe('alias_csrf_token_value_67890');
  });

  it('returns null when no CSRF cookie exists', () => {
    const raw = 'session=123; user=alice';
    expect(getCsrfToken(DEFAULT_CSRF_COOKIE, raw)).toBeNull();
    expect(getCsrfToken(DEFAULT_CSRF_COOKIE, '')).toBeNull();
    expect(getCsrfToken(DEFAULT_CSRF_COOKIE, null)).toBeNull();
  });

  it('withCsrfHeaders injects X-CSRF-Token header when token cookie is present', () => {
    const raw = '__Host-csrf=active_token_9876543210';
    const originalHeaders = { 'Content-Type': 'application/json' };
    const secured = withCsrfHeaders(originalHeaders, DEFAULT_CSRF_HEADER, raw);
    expect(secured).toEqual({
      'Content-Type': 'application/json',
      [DEFAULT_CSRF_HEADER]: 'active_token_9876543210',
    });
  });

  it('withCsrfHeaders returns unchanged headers when no token cookie exists', () => {
    const originalHeaders = { 'Content-Type': 'application/json' };
    const secured = withCsrfHeaders(originalHeaders, DEFAULT_CSRF_HEADER, '');
    expect(secured).toEqual(originalHeaders);
  });
});
