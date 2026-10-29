/**
 * Helpers for sending people back to the page they wanted after they sign in
 * or sign up.
 *
 * The destination travels two ways: in router state (set by ProtectedRoute)
 * and in a `redirect_url` query param. Router state is lost on a page refresh
 * and on the Google OAuth round trip, the query param is not. `redirect_url`
 * is also the name Clerk's own <SignIn /> / <SignUp /> components read.
 */

export const REDIRECT_PARAM = 'redirect_url';

const AUTH_PATHS = ['/login', '/signup', '/sso-callback'];

const PROTECTED_PAGE_LABELS = {
  '/saved': 'your saved services',
  '/vault': 'your document vault',
  '/profile': 'your profile',
  '/admin': 'the admin dashboard',
};

const isAuthPath = (pathname) =>
  AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Other origins we are happy to send people back to after sign in (for example a sibling app
 * that shares this login). Empty on purpose: nothing but this site is trusted until it is listed
 * here, as a full origin such as "https://apply.example.org".
 */
export const APPROVED_REDIRECT_ORIGINS = [];

// Browsers drop tabs and line breaks inside a URL, so "/<TAB>/evil.com" is read as "//evil.com".
// Any control character (and the Unicode line/paragraph separators) is therefore refused.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const HAS_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

// A leading slash that is still percent-encoded can be decoded later by a router, server or the
// auth provider and turn "/%2Fevil.com" into "//evil.com" (or "/%5Cevil.com" into "/\evil.com").
const ENCODED_LEADING_SEPARATOR = /^\/+(?:%2f|%5c|%09|%0a|%0d|%00)/i;

/** Decodes at most a few rounds so double-encoded input is inspected in its final form. */
const fullyDecoded = (value) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    let next;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next === current) return current;
    current = next;
  }
  return current;
};

/**
 * Returns `path` if it is a safe destination, otherwise null.
 * Relative in-app paths are allowed ("/saved", "/saved?folder=x"), and so are full URLs on our
 * own origin or on an approved origin (turned into a path when it is our own). Other sites,
 * protocol-relative URLs ("//evil.com"), backslash tricks ("/\evil.com"), "javascript:" and other
 * schemes, control characters, encoded variants of all of these, and the auth pages themselves
 * (which would loop) are rejected.
 */
export const sanitizeRedirectPath = (
  path,
  origin = globalThis.location?.origin,
  approvedOrigins = APPROVED_REDIRECT_ORIGINS
) => {
  if (typeof path !== 'string') return null;
  let trimmed = path.trim();
  if (!trimmed || trimmed.length > 2048 || HAS_CONTROL_CHARS.test(trimmed)) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    let url;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.username || url.password) return null;
    if (origin && url.origin === origin) {
      trimmed = `${url.pathname}${url.search}${url.hash}`;
    } else if (approvedOrigins.includes(url.origin)) {
      return url.href;
    } else {
      return null;
    }
  }

  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }
  if (ENCODED_LEADING_SEPARATOR.test(trimmed)) return null;

  // Look at what the path becomes once decoded: it must still be a plain in-app path.
  const decoded = fullyDecoded(trimmed);
  if (decoded === null || HAS_CONTROL_CHARS.test(decoded)) return null;
  const pathPart = decoded.split(/[?#]/)[0];
  if (pathPart.startsWith('//') || pathPart.startsWith('/\\') || /^\/*[a-z][a-z0-9+.-]*:/i.test(pathPart)) {
    return null;
  }

  const pathname = trimmed.split(/[?#]/)[0];
  if (isAuthPath(pathname) || isAuthPath(pathPart)) return null;
  return trimmed;
};

/** Turns a router location object into "/path?search#hash". */
export const locationToPath = (location) => {
  if (!location || typeof location.pathname !== 'string') return null;
  return `${location.pathname}${location.search || ''}${location.hash || ''}`;
};

/**
 * Works out where to send the user after auth. Router state wins, then the
 * `redirect_url` query param, then null (caller decides the default).
 */
export const getRedirectTarget = (location) => {
  const fromState = location?.state?.from;
  const statePath = typeof fromState === 'string' ? fromState : locationToPath(fromState);
  const safeStatePath = sanitizeRedirectPath(statePath);
  if (safeStatePath) return safeStatePath;

  const params = new URLSearchParams(location?.search || '');
  return sanitizeRedirectPath(params.get(REDIRECT_PARAM));
};

/**
 * Builds a link to an auth page that keeps the destination, e.g.
 * buildAuthPath('/signup', '/saved') -> "/signup?redirect_url=%2Fsaved".
 */
export const buildAuthPath = (authPath, redirectTo) => {
  const safe = sanitizeRedirectPath(redirectTo);
  if (!safe) return authPath;
  const params = new URLSearchParams({ [REDIRECT_PARAM]: safe });
  return `${authPath}?${params.toString()}`;
};

/**
 * Friendly name for a protected page, used in the sign in notice.
 * Returns null when there is nothing worth explaining (no target, or home).
 */
export const describeProtectedPath = (path) => {
  const safe = sanitizeRedirectPath(path);
  if (!safe) return null;
  const pathname = safe.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (pathname === '/') return null;
  const match = Object.keys(PROTECTED_PAGE_LABELS).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  return match ? PROTECTED_PAGE_LABELS[match] : 'that page';
};
