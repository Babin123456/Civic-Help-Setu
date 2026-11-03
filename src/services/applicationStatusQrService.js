/**
 * applicationStatusQrService.js
 *
 * QR-based application status lookup service (#458).
 * Generates privacy-safe, opaque, revocable lookup tokens for tracked applications.
 *
 * Privacy Guarantees:
 * - QR code encodes ONLY an opaque lookup URL with a random unguessable token.
 * - Application ID, Aadhaar number, phone number, and sensitive document downloads
 *   are NEVER encoded in the QR code and are stripped from the public lookup page.
 * - Supports token rotation and one-click token revocation.
 * - In-memory / local storage rate limiter prevents brute-force token scanning.
 */

import qrcode from 'qrcode-generator';

const STORAGE_KEY = 'civicbridge_app_status_qr_tokens';
const RATE_LIMIT_KEY = 'civicbridge_app_status_qr_rate_limits';

/**
 * Generates an opaque, hard-to-guess token (24 hex characters)
 */
export function generateStatusToken() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Loads all token registries from local storage
 */
export function getAllStatusTokens() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Saves all token registries to local storage
 */
function saveAllStatusTokens(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Registers or rotates a QR lookup token for an application record.
 *
 * @param {string} applicationId - Unique ID of tracked application
 * @param {Object} applicationRecord - Application data to project
 * @returns {Object} Token metadata record
 */
export function createOrRotateStatusToken(applicationId, applicationRecord = {}) {
  if (!applicationId) throw new Error('Application ID is required');

  const all = getAllStatusTokens();
  const token = generateStatusToken();
  const createdAt = Date.now();
  // Tokens valid for 30 days by default
  const expiresAt = createdAt + 30 * 24 * 60 * 60 * 1000;

  // Deactivate any existing active tokens for this application
  Object.keys(all).forEach((existingToken) => {
    if (all[existingToken].applicationId === applicationId && !all[existingToken].revoked) {
      all[existingToken].revoked = true;
      all[existingToken].revokedReason = 'ROTATED';
    }
  });

  // Extract ONLY non-sensitive milestone and progress data
  const safeMilestones = Array.isArray(applicationRecord.milestones)
    ? applicationRecord.milestones.map((m) => ({
        label: m.label || m.title || 'Milestone',
        status: m.status || 'PENDING',
        completedAt: m.completedAt || m.date || null,
      }))
    : [
        { label: 'Application Submitted', status: 'COMPLETED', completedAt: 'Recorded' },
        { label: 'Under Review / Verification', status: 'IN_PROGRESS', completedAt: null },
        { label: 'Final Decision & Notice', status: 'PENDING', completedAt: null },
      ];

  const record = {
    token,
    applicationId,
    createdAt,
    expiresAt,
    revoked: false,
    accessCount: 0,
    lastAccessedAt: null,
    // Sanitized projection
    publicData: {
      serviceName: applicationRecord.serviceName || applicationRecord.title || 'Civic Service Application',
      department: applicationRecord.department || 'Government Department',
      stage: applicationRecord.status || applicationRecord.stage || 'In Progress',
      submissionDate: applicationRecord.submissionDate || applicationRecord.appliedOn || null,
      expectedResolution: applicationRecord.expectedResolution || 'Within statutory SLA',
      milestones: safeMilestones,
    },
  };

  all[token] = record;
  saveAllStatusTokens(all);

  return record;
}

/**
 * Revokes a status lookup token immediately.
 */
export function revokeStatusToken(token) {
  const all = getAllStatusTokens();
  if (all[token]) {
    all[token].revoked = true;
    all[token].revokedReason = 'MANUAL_REVOCATION';
    all[token].revokedAt = Date.now();
    saveAllStatusTokens(all);
    return true;
  }
  return false;
}

/**
 * Checks client rate limits to prevent brute-force token harvesting.
 * Allows at most 10 requests per 60 seconds per client IP/session.
 */
export function checkLookupRateLimit(clientIdentifier = 'default_client') {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const registry = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 10;

    const clientHistory = (registry[clientIdentifier] || []).filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (clientHistory.length >= maxRequests) {
      return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - clientHistory[0])) / 1000) };
    }

    clientHistory.push(now);
    registry[clientIdentifier] = clientHistory;
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(registry));
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Resolves a public, privacy-safe status view by opaque token.
 *
 * @param {string} token - Opaque QR token
 * @param {string} [clientIdentifier] - Rate limiter identifier
 * @returns {Object} Public status view result
 */
export function resolvePublicStatusByToken(token, clientIdentifier = 'web_client') {
  if (!token || typeof token !== 'string') {
    return { status: 'INVALID', error: 'Invalid or missing lookup token' };
  }

  const rateCheck = checkLookupRateLimit(clientIdentifier);
  if (!rateCheck.allowed) {
    return {
      status: 'RATE_LIMITED',
      error: `Too many lookup attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
    };
  }

  const all = getAllStatusTokens();
  const record = all[token];

  if (!record) {
    return { status: 'NOT_FOUND', error: 'No active application found matching this QR code.' };
  }

  if (record.revoked) {
    return {
      status: 'REVOKED',
      error: 'This lookup QR code has been rotated or deactivated by the applicant for security.',
    };
  }

  if (record.expiresAt && Date.now() > record.expiresAt) {
    return {
      status: 'EXPIRED',
      error: 'This lookup QR code has expired. Please check your account dashboard for an updated QR pass.',
    };
  }

  // Record audit access
  record.accessCount = (record.accessCount || 0) + 1;
  record.lastAccessedAt = Date.now();
  all[token] = record;
  saveAllStatusTokens(all);

  return {
    status: 'ACTIVE',
    application: record.publicData,
    expiresAt: record.expiresAt,
    readOnly: true,
  };
}

/**
 * Generates the SVG path for the QR code payload.
 */
export function buildStatusQrPath(lookupUrl) {
  if (!lookupUrl || typeof lookupUrl !== 'string') {
    throw new Error('Valid lookup URL is required');
  }

  const qr = qrcode(0, 'M');
  qr.addData(lookupUrl);
  qr.make();

  const count = qr.getModuleCount();
  const cells = [];
  const pad = 4;

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        cells.push(`M${c + pad},${r + pad}h1v1h-1z`);
      }
    }
  }

  return {
    path: cells.join(''),
    size: count + pad * 2,
  };
}
