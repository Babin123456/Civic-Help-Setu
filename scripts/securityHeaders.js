/**
 * Production security headers: the single source of truth.
 *
 * `vercel.json` is generated from this file (`npm run headers:generate`) and a test fails if the
 * two drift apart. Every origin the app needs is listed here with the reason, and
 * docs/SECURITY_HEADERS.md explains how to change the policy safely.
 *
 * The policy ships in report-only mode first (nothing is blocked, the browser only reports what
 * would have been). Switch to enforcement with `npm run headers:generate -- --mode enforce`.
 */

/** Clerk's development instances. A production Clerk domain is added with --clerk-host. */
export const CLERK_DEV_HOST = 'https://*.clerk.accounts.dev';

/**
 * Directive -> allowed sources, and why. Keep a reason for every external origin: a reviewer
 * should be able to tell what breaks if an entry is removed.
 */
export const POLICY = {
  'default-src': { sources: ["'self'"], why: 'Anything not listed below may only load from this site.' },

  'script-src': {
    sources: ["'self'", CLERK_DEV_HOST, 'https://challenges.cloudflare.com'],
    why:
      "Our own bundle (no inline scripts, no eval). Clerk loads clerk-js from its frontend API " +
      'host; Cloudflare Turnstile is its bot check.',
  },

  'style-src': {
    sources: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    why:
      "Google Fonts stylesheet (src/index.css). 'unsafe-inline' is the one deliberate relaxation: " +
      'Clerk injects <style> elements at runtime. Scripts stay strict, so this does not allow script injection.',
  },

  'font-src': { sources: ["'self'", 'https://fonts.gstatic.com'], why: 'Font files for the Google Fonts stylesheet.' },

  'img-src': {
    sources: ["'self'", 'data:', 'blob:', 'https://img.clerk.com'],
    why:
      'data: for inline icons, blob: for the document vault preview, img.clerk.com for avatars. ' +
      'Add https://api.qrserver.com only if the QR modal (QRCodeView) is mounted.',
  },

  'connect-src': {
    sources: ["'self'", CLERK_DEV_HOST, 'https://clerk-telemetry.com'],
    why: 'Clerk API calls and its optional telemetry. The app has no other network calls.',
  },

  'frame-src': {
    sources: ["'self'", 'blob:', 'https://challenges.cloudflare.com'],
    why: 'blob: for the sandboxed vault preview frame, Turnstile challenge frame.',
  },

  'worker-src': { sources: ["'self'", 'blob:'], why: 'Clerk starts a worker from a blob: URL.' },

  'media-src': { sources: ["'self'", 'blob:'], why: 'Vault audio/video previews.' },

  'manifest-src': { sources: ["'self'"], why: 'Web app manifest.' },

  'object-src': { sources: ["'none'"], why: 'No plugins.' },

  'base-uri': { sources: ["'self'"], why: 'Stops an injected <base> tag from redirecting relative URLs.' },

  'form-action': { sources: ["'self'"], why: 'Forms may only submit to this site.' },

  'frame-ancestors': { sources: ["'none'"], why: 'Nobody may embed this site (clickjacking).' },
};

/**
 * Directives with no source list. Browsers ignore these in a report-only policy (and warn about
 * it in the console), so they are only added when the policy is enforced.
 */
export const FLAG_DIRECTIVES = ['upgrade-insecure-requests'];

/** Headers that are always enforced; they have no report-only form. */
export const BASELINE_HEADERS = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  [
    'Permissions-Policy',
    // Speech input uses the microphone and the nearby-offices page asks for location, both only
    // from this site. Everything else is switched off.
    'accelerometer=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=()',
  ],
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
  // Keeps window.opener for sign-in popups but isolates us from other sites' windows.
  ['Cross-Origin-Opener-Policy', 'same-origin-allow-popups'],
];

export const MODES = ['report-only', 'enforce'];

/** @param {string} host e.g. "clerk.example.org" or "https://clerk.example.org" */
export function normalizeHost(host) {
  const text = String(host).trim();
  if (!/^(https:\/\/)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?$/i.test(text)) {
    throw new Error(`Not a valid host: "${host}"`);
  }
  return text.startsWith('https://') ? text : `https://${text}`;
}

/**
 * @param {{ clerkHosts?: string[], reportUri?: string, enforce?: boolean }} options
 * @returns {string} the Content-Security-Policy value
 */
export function buildCsp({ clerkHosts = [], reportUri, enforce = true } = {}) {
  const extraClerk = clerkHosts.map(normalizeHost);
  const parts = [];

  for (const [directive, { sources }] of Object.entries(POLICY)) {
    const list = [...sources];
    // Clerk's frontend API host is needed to load its script and call its API.
    if (directive === 'script-src' || directive === 'connect-src') list.push(...extraClerk);
    parts.push(`${directive} ${[...new Set(list)].join(' ')}`);
  }
  if (enforce) parts.push(...FLAG_DIRECTIVES);
  if (reportUri) {
    const url = new URL(reportUri);
    if (url.protocol !== 'https:') throw new Error('The report URI must be https.');
    parts.push(`report-uri ${url.href}`);
  }
  return parts.join('; ');
}

/**
 * @param {{ mode?: 'report-only'|'enforce', clerkHosts?: string[], reportUri?: string }} options
 * @returns {{ key: string, value: string }[]}
 */
export function buildHeaders({ mode = 'report-only', clerkHosts = [], reportUri } = {}) {
  if (!MODES.includes(mode)) throw new Error(`Unknown mode "${mode}". Use one of: ${MODES.join(', ')}.`);
  const csp = buildCsp({ clerkHosts, reportUri, enforce: mode === 'enforce' });
  const cspKey = mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
  return [{ key: cspKey, value: csp }, ...BASELINE_HEADERS.map(([key, value]) => ({ key, value }))];
}

/**
 * Update a vercel.json object: replace its headers, keep everything else (rewrites, ...).
 * @param {object} existing
 */
export function toVercelConfig(existing, options) {
  return {
    ...existing,
    headers: [{ source: '/(.*)', headers: buildHeaders(options) }],
  };
}
