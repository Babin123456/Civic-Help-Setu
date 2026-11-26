/**
 * src/utils/csrf.js
 *
 * Client-side helper for double-submit CSRF tokens (#926).
 * Reads the CSRF token from browser cookies and attaches it to request headers.
 */

export const DEFAULT_CSRF_COOKIE = '__Host-csrf';
export const DEFAULT_CSRF_HEADER = 'X-CSRF-Token';

const CSRF_COOKIE_ALIASES = ['__Host-csrf', 'csrf_token', '__csrf'];

/**
 * Parses a cookie string for a specific cookie name.
 * @param {string} str
 * @param {string} name
 * @returns {string|null}
 */
export function parseCookieString(str, name) {
  if (typeof str !== 'string' || !str.trim()) return null;
  const match = str.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Reads a cookie value by name from document.cookie or an explicit cookie string.
 * @param {string} name
 * @param {string} [cookieSource]
 * @returns {string|null}
 */
export function getCookie(name, cookieSource) {
  const source = typeof cookieSource === 'string'
    ? cookieSource
    : (typeof document !== 'undefined' ? document.cookie : '');
  return parseCookieString(source, name);
}

/**
 * Retrieves the current CSRF token from browser cookies or an explicit cookie string.
 * @param {string} [preferredCookieName=DEFAULT_CSRF_COOKIE]
 * @param {string} [cookieSource]
 * @returns {string|null}
 */
export function getCsrfToken(preferredCookieName = DEFAULT_CSRF_COOKIE, cookieSource) {
  const candidates = [preferredCookieName, ...CSRF_COOKIE_ALIASES].filter(Boolean);
  for (const name of candidates) {
    const value = getCookie(name, cookieSource);
    if (value) return value;
  }
  return null;
}

/**
 * Attaches the CSRF token header to a headers map when a token exists.
 * @param {Record<string, string>} [headers={}]
 * @param {string} [headerName=DEFAULT_CSRF_HEADER]
 * @param {string} [cookieSource]
 * @returns {Record<string, string>}
 */
export function withCsrfHeaders(headers = {}, headerName = DEFAULT_CSRF_HEADER, cookieSource) {
  const token = getCsrfToken(DEFAULT_CSRF_COOKIE, cookieSource);
  if (!token) return { ...headers };
  return {
    ...headers,
    [headerName]: token,
  };
}
