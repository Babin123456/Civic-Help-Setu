/**
 * Hardened OAuth Redirect Validation and Return Path Management Service
 * 
 * Provides centralized post-authentication redirect parsing, validation, and safe state preservation:
 * - Rejection of external origins, javascript:, data:, and vbscript: URIs.
 * - Defense against protocol-relative URLs (e.g. //evil.com, ///evil.com, /\\evil.com).
 * - Multi-layer decoding and bypass detection (URL-encoded %2f, double-encoded %252f, backslash substitutions).
 * - Preservation of verified in-app destinations through Clerk OAuth sign-in and session resumption.
 * - Explicit route allowlist with safe fallback to application root ('/').
 * - Zero storage of unvalidated redirect targets.
 */

export const SAFE_APPLICATION_ROUTES = [
  '/',
  '/services',
  '/track',
  '/offices',
  '/assistant',
  '/admin',
  '/open-source',
  '/privacy',
  '/terms',
  '/faq',
  '/emergency-contacts',
  '/jurisdiction-handoff',
  '/micro-volunteer',
  '/form-field-explainer',
  '/water-connection',
  '/heatwave-relief',
  '/flood-response',
  '/school-zone-safety'
];

export const FORBIDDEN_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:'
];

/**
 * Sanitizes and normalizes a candidate redirect target by recursively decoding and checking bypasses.
 * @param {string} candidate 
 * @returns {string|null}
 */
export function normalizeRedirectCandidate(candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }

  let decoded = candidate.trim();

  // Guard against infinite decode loops while stripping up to 3 layers of URL encoding
  for (let i = 0; i < 3; i++) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      // Malformed encoding sequence is immediately rejected
      return null;
    }
  }

  // Normalize Windows-style backslashes to forward slashes for traversal detection
  const normalizedSlashes = decoded.replace(/\\+/g, '/');

  // Check for dangerous protocol injections
  const lower = normalizedSlashes.toLowerCase();
  for (const proto of FORBIDDEN_PROTOCOLS) {
    if (lower.startsWith(proto) || lower.includes(proto)) {
      return null;
    }
  }

  // Protocol-relative URLs (//example.com, ///example.com)
  if (normalizedSlashes.startsWith('//')) {
    return null;
  }

  // Scheme or external host presence (http://, https://)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalizedSlashes)) {
    return null;
  }

  // Must begin with a single forward slash
  if (!normalizedSlashes.startsWith('/') || normalizedSlashes.startsWith('/\\')) {
    return null;
  }

  return normalizedSlashes;
}

/**
 * Validates a redirect target against the application route allowlist and path rules.
 * @param {string} candidate 
 * @param {Object} [options]
 * @param {string} [options.fallback='/']
 * @param {Array<string>} [options.customAllowlist]
 * @returns {string} Safe relative path
 */
export function getSafeRedirectPath(candidate, options = {}) {
  const fallback = options.fallback || '/';
  const allowlist = options.customAllowlist || SAFE_APPLICATION_ROUTES;

  const normalized = normalizeRedirectCandidate(candidate);
  if (!normalized) {
    return fallback;
  }

  // Strip query strings and hash anchors for route matching
  const [basePath] = normalized.split(/[?#]/);

  // Exact match or sub-path prefix match with strict boundary check
  const isAllowed = allowlist.some(route => {
    if (route === '/') {
      return basePath === '/' || basePath === '';
    }
    return basePath === route || basePath.startsWith(`${route}/`);
  });

  if (!isAllowed) {
    return fallback;
  }

  // Clean path to prevent path traversal (e.g. /services/../evil)
  try {
    const parsed = new URL(`https://civichelpsetu.in${normalized}`);
    const pathname = parsed.pathname;

    const isResolvedAllowed = allowlist.some(route => {
      if (route === '/') return pathname === '/';
      return pathname === route || pathname.startsWith(`${route}/`);
    });

    if (!isResolvedAllowed) {
      return fallback;
    }

    return `${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Safely persists and retrieves intended redirect URL across Clerk authentication transitions.
 */
export const AUTH_REDIRECT_STORAGE_KEY = 'chs_post_auth_dest';

export function storeIntendedAuthRedirect(path) {
  const safe = getSafeRedirectPath(path, { fallback: '/' });
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, safe);
    } catch {
      // Storage unavailable or disabled
    }
  }
  return safe;
}

export function retrieveAndClearAuthRedirect(defaultFallback = '/') {
  let stored = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      stored = window.sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
      window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  return getSafeRedirectPath(stored, { fallback: defaultFallback });
}


export const AUTH_FLOW_STATES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  REDIRECT_INITIATED: 'REDIRECT_INITIATED',
  OAUTH_CALLBACK_PENDING: 'OAUTH_CALLBACK_PENDING',
  SESSION_ACTIVE: 'SESSION_ACTIVE',
  SESSION_EXPIRED: 'SESSION_EXPIRED'
};

/**
 * Handles transition state and resolves next route when session expires or renews.
 * @param {string} currentState 
 * @param {string} lastKnownRoute 
 * @returns {Object} next action
 */
export function resolveSessionTransition(currentState, lastKnownRoute) {
  const safeReturn = getSafeRedirectPath(lastKnownRoute, { fallback: '/' });

  if (currentState === AUTH_FLOW_STATES.SESSION_EXPIRED) {
    storeIntendedAuthRedirect(safeReturn);
    return {
      action: 'REDIRECT_TO_SIGN_IN',
      target: '/sign-in',
      preservedDestination: safeReturn,
      message: 'Session timed out. Please sign in to resume your application.'
    };
  }

  if (currentState === AUTH_FLOW_STATES.SESSION_ACTIVE) {
    const destination = retrieveAndClearAuthRedirect(safeReturn);
    return {
      action: 'NAVIGATE',
      target: destination,
      preservedDestination: null,
      message: 'Welcome back.'
    };
  }

  return {
    action: 'DEFAULT',
    target: safeReturn,
    preservedDestination: null,
    message: null
  };
}


export const OAUTH_REDIRECT_SECURITY_RULES = [
  'Protocol-relative URLs starting with // or /\\ are unconditionally stripped and rejected.',
  'Dangerous executable schemes (javascript:, data:, vbscript:, file:, blob:) return null.',
  'Multi-layer URL decoding (up to 3 iterations) dismantles nested obfuscation (%252f -> %2f -> /).',
  'Path traversal attempts containing /../ are resolved against canonical origin and strictly boundary checked.',
  'Allowed destinations must strictly match predefined application routes or approved subpaths.',
  'Unauthenticated or expired transitions store safe destinations in sessionStorage and clear upon first read.'
];

/**
 * Returns security audit rules enforced by oauthRedirectService.
 * @returns {Array<string>}
 */
export function getOAuthRedirectSecurityRules() {
  return OAUTH_REDIRECT_SECURITY_RULES;
}
