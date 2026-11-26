/**
 * src/services/civicCaseCollaborationService.js
 *
 * Deterministic engine for the Civic Case Collaboration Space with Granular,
 * Revocable Sharing (#1183).
 *
 * Design rules:
 * - Item-level sharing: citizens share selected case documents/items, never
 *   their entire account.
 * - Each share carries a CSPRNG token, expiry, view/download scope, optional
 *   passcode gate, max views, watermark and SHA-256 snapshot integrity seal.
 * - Recipients must authenticate; access is audited; revoked/expired links are
 *   refused; cached access is blocked after revocation.
 * - Deterministic rules outside LLM prompts; AI outputs carry provenance.
 * - Aggregate/synthetic only. Zero production PII, credentials, raw documents
 *   or sensitive prompts are logged or returned.
 * - Explicit human approval required for high-impact actions (create/revoke
 *   shares). Never autonomously files applications, denies benefits or claims
 *   official verification.
 */

import {
  CIVIC_CASE_COLLABORATION_REVIEW_DATE,
  CIVIC_CASE_COLLABORATION_STALE_AFTER_DAYS,
  CIVIC_CASE_COLLABORATION_DISCLAIMER,
  SHARE_STATUS,
  ACCESS_OUTCOME,
  SHARE_EXPIRY_OPTIONS,
  SHARE_SCOPES,
  MAX_ITEMS_PER_SHARE,
  MAX_ACCESS_LOG_ENTRIES,
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_MS,
  MIN_PASSCODE_LENGTH,
  WATERMARK_TEXT,
  getCaseItem,
  getCase,
  getRecipient,
} from '../data/civicCaseCollaborationData.js';
import { sha256Hex, canonicalStringify } from './privacyIntegrityService.js';

export const CASE_COLLABORATION_STORAGE_KEY = 'civicbridge_case_collaboration_shares_v1';

export const SHARE_SCOPE_VALUES = Object.freeze({
  VIEW_ONLY: SHARE_SCOPES.VIEW_ONLY,
  VIEW_AND_DOWNLOAD: SHARE_SCOPES.VIEW_AND_DOWNLOAD,
});

export const COLLAB_ERRORS = Object.freeze({
  INVALID_REQUEST: 'CC_INVALID_REQUEST',
  INVALID_TYPE: 'CC_INVALID_TYPE',
  SHARE_NOT_FOUND: 'CC_SHARE_NOT_FOUND',
  ITEM_NOT_FOUND: 'CC_ITEM_NOT_FOUND',
  RECIPIENT_NOT_FOUND: 'CC_RECIPIENT_NOT_FOUND',
  CASE_NOT_FOUND: 'CC_CASE_NOT_FOUND',
  TEMPLATE_NOT_FOUND: 'CC_TEMPLATE_NOT_FOUND',
  VALIDATION_FAILED: 'CC_VALIDATION_FAILED',
  SENSITIVE_FIELD: 'CC_SENSITIVE_FIELD',
  SENSITIVE_VALUE: 'CC_SENSITIVE_VALUE',
  PERMISSION_DENIED: 'CC_PERMISSION_DENIED',
  AUTHENTICATION_REQUIRED: 'CC_AUTHENTICATION_REQUIRED',
  SCOPE_DENIED: 'CC_SCOPE_DENIED',
  STALE_DATA: 'CC_STALE_DATA',
  STORAGE_UNAVAILABLE: 'CC_STORAGE_UNAVAILABLE',
});

const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 1000;
const MAX_RECIPIENT_EMAIL_LEN = 254;

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|token|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization|salary|income.?amount|mobile.?number|phone.?number)/i;

const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isSlug = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && SLUG_PATTERN.test(value);

const unique = (items) => Array.from(new Set(items));

function findSensitiveKeys(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveKeys(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (!isObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const where = path ? `${path}.${key}` : key;
    if (SENSITIVE_KEY_PATTERN.test(key)) found.push(where);
    findSensitiveKeys(child, where, depth + 1, found);
  }
  return found;
}

function collectSensitiveText(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (typeof value === 'string') {
    if (AADHAAR_NUMBER_PATTERN.test(value)) found.push(`${path}: Aadhaar-like number`);
    else if (PAN_NUMBER_PATTERN.test(value)) found.push(`${path}: PAN-like number`);
    else if (OTP_PATTERN.test(value)) found.push(`${path}: OTP-like value`);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveText(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectSensitiveText(child, path ? `${path}.${key}` : key, depth + 1, found);
    }
  }
  return found;
}

export function validateCollaborationRequest(input = {}, { requireShare = false } = {}) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });

  if (!isObject(input)) {
    return {
      valid: false,
      errors: [{ field: '(request)', code: COLLAB_ERRORS.INVALID_TYPE, message: 'Request must be a JSON object.' }],
    };
  }

  const sensitiveKeys = findSensitiveKeys(input);
  for (const where of sensitiveKeys) {
    fail(where, COLLAB_ERRORS.SENSITIVE_FIELD, 'Do not send passwords, OTPs, document numbers, income amounts or phone numbers.');
  }
  const sensitiveText = collectSensitiveText(input);
  for (const where of sensitiveText) {
    fail(where, COLLAB_ERRORS.SENSITIVE_VALUE, 'Remove identity numbers, OTPs, income amounts and phone numbers from the request.');
  }

  if (input.shareId !== undefined && !isSlug(input.shareId)) {
    fail('shareId', COLLAB_ERRORS.INVALID_TYPE, 'shareId must be a lowercase slug.');
  }
  if (requireShare && input.shareId && !getShare(input.shareId)) {
    fail('shareId', COLLAB_ERRORS.SHARE_NOT_FOUND, 'No share exists for this share id.');
  }

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim().length === 0 || input.title.length > MAX_TITLE_LEN) {
      fail('title', COLLAB_ERRORS.INVALID_TYPE, `title must be a non-empty string up to ${MAX_TITLE_LEN} characters.`);
    }
  }

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.length > MAX_DESCRIPTION_LEN) {
      fail('description', COLLAB_ERRORS.INVALID_TYPE, `description must be a string up to ${MAX_DESCRIPTION_LEN} characters.`);
    }
  }

  if (input.recipientEmail !== undefined) {
    if (typeof input.recipientEmail !== 'string' || !EMAIL_REGEX.test(input.recipientEmail.trim()) || input.recipientEmail.trim().length > MAX_RECIPIENT_EMAIL_LEN) {
      fail('recipientEmail', COLLAB_ERRORS.INVALID_TYPE, 'recipientEmail must be a valid email address.');
    }
  }

  if (input.itemIds !== undefined) {
    if (!Array.isArray(input.itemIds) || input.itemIds.length === 0 || input.itemIds.length > MAX_ITEMS_PER_SHARE) {
      fail('itemIds', COLLAB_ERRORS.INVALID_TYPE, `itemIds must be an array of 1 to ${MAX_ITEMS_PER_SHARE} item ids.`);
    } else {
      input.itemIds.forEach((id, index) => {
        if (!isSlug(id) || !getCaseItem(id)) {
          fail(`itemIds[${index}]`, COLLAB_ERRORS.ITEM_NOT_FOUND, `Unknown item id "${id}".`);
        }
      });
    }
  }

  if (input.scope !== undefined && !Object.values(SHARE_SCOPE_VALUES).includes(input.scope)) {
    fail('scope', COLLAB_ERRORS.INVALID_TYPE, `scope must be one of ${Object.values(SHARE_SCOPE_VALUES).join(', ')}.`);
  }

  if (input.expiryOption !== undefined && !Object.values(SHARE_EXPIRY_OPTIONS).includes(input.expiryOption)) {
    fail('expiryOption', COLLAB_ERRORS.INVALID_TYPE, `expiryOption must be one of ${Object.values(SHARE_EXPIRY_OPTIONS).join(', ')}.`);
  }

  if (input.maxViews !== undefined) {
    const mv = input.maxViews;
    if (mv !== null && mv !== undefined && (!Number.isInteger(mv) || mv < 1)) {
      fail('maxViews', COLLAB_ERRORS.INVALID_TYPE, 'maxViews must be a positive integer or null.');
    }
  }

  if (input.accessPin !== undefined && input.accessPin !== null && (typeof input.accessPin !== 'string' || input.accessPin.trim().length < MIN_PASSCODE_LENGTH)) {
    fail('accessPin', COLLAB_ERRORS.INVALID_TYPE, `accessPin must be at least ${MIN_PASSCODE_LENGTH} characters.`);
  }

  return { valid: errors.length === 0, errors };
}

function calculateExpiryTime(option = SHARE_EXPIRY_OPTIONS.DAYS_7) {
  const now = Date.now();
  switch (option) {
    case SHARE_EXPIRY_OPTIONS.HOURS_24: return now + 24 * 60 * 60 * 1000;
    case SHARE_EXPIRY_OPTIONS.DAYS_3: return now + 3 * 24 * 60 * 60 * 1000;
    case SHARE_EXPIRY_OPTIONS.DAYS_7: return now + 7 * 24 * 60 * 60 * 1000;
    case SHARE_EXPIRY_OPTIONS.DAYS_30: return now + 30 * 24 * 60 * 60 * 1000;
    case SHARE_EXPIRY_OPTIONS.NEVER:
    default: return null;
  }
}

function getRandomBytes(byteLength) {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographically secure random generator is unavailable.');
  }
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateShareToken() {
  return bytesToHex(getRandomBytes(16));
}

function hashPasscode(pin, salt) {
  return sha256Hex(`civicbridge:case-share-pin:v1:${salt}:${pin}`);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizePasscode(rawPin) {
  if (rawPin === undefined || rawPin === null) return null;
  const trimmed = String(rawPin).trim();
  if (!trimmed) return null;
  if (trimmed.length < MIN_PASSCODE_LENGTH) throw new Error(`Passcode must be at least ${MIN_PASSCODE_LENGTH} characters long.`);
  return trimmed;
}

function computeSnapshotSeal({ token, ownerId, createdAt, itemIds, scope, recipientEmail }) {
  return sha256Hex(canonicalStringify({
    version: 1, token, ownerId, createdAt, itemIds, scope, recipientEmail,
  }));
}

function appendAccessLog(record, outcome, details = {}) {
  const existing = Array.isArray(record.accessLog) ? record.accessLog : [];
  record.accessLog = [...existing, { outcome, timestamp: Date.now(), ...details }].slice(-MAX_ACCESS_LOG_ENTRIES);
}

function readShares() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CASE_COLLABORATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveShares(all) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(CASE_COLLABORATION_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function getShare(shareId) {
  if (!isSlug(shareId)) return null;
  return readShares()[shareId] || null;
}

/**
 * Create a granular, revocable share of selected case items. Requires
 * authentication (actor). Returns { ok, share } or { ok: false, errors }.
 */
export function createShare({
  shareId,
  ownerId,
  title,
  description,
  caseId,
  itemIds,
  recipientEmail,
  recipientId,
  scope = SHARE_SCOPE_VALUES.VIEW_AND_DOWNLOAD,
  expiryOption = SHARE_EXPIRY_OPTIONS.DAYS_7,
  maxViews = null,
  accessPin = null,
  actor = null,
} = {}) {
  const validation = validateCollaborationRequest({ shareId, title, description, recipientEmail, itemIds, scope, expiryOption, maxViews, accessPin });
  if (!validation.valid) {
    return { ok: false, error: { code: COLLAB_ERRORS.VALIDATION_FAILED, message: 'The share request is not valid.' }, errors: validation.errors };
  }
  if (!actor) {
    return { ok: false, error: { code: COLLAB_ERRORS.AUTHENTICATION_REQUIRED, message: 'Authentication required to create a share.' }, errors: [{ field: 'actor', code: COLLAB_ERRORS.AUTHENTICATION_REQUIRED, message: 'Authentication required.' }] };
  }
  if (getCase(caseId) === null) {
    return { ok: false, error: { code: COLLAB_ERRORS.CASE_NOT_FOUND, message: 'Unknown case id.' }, errors: [{ field: 'caseId', code: COLLAB_ERRORS.CASE_NOT_FOUND, message: 'Unknown case id.' }] };
  }
  if (recipientId && !getRecipient(recipientId)) {
    return { ok: false, error: { code: COLLAB_ERRORS.RECIPIENT_NOT_FOUND, message: 'Unknown recipient id.' }, errors: [{ field: 'recipientId', code: COLLAB_ERRORS.RECIPIENT_NOT_FOUND, message: 'Unknown recipient id.' }] };
  }
  const effectiveShareId = shareId || `share-${Date.now()}-${bytesToHex(getRandomBytes(4))}`;
  const resolvedOwnerId = ownerId || (actor?.id || actor || '');
  if (readShares()[effectiveShareId]) {
    return { ok: false, error: { code: COLLAB_ERRORS.VALIDATION_FAILED, message: 'A share with this id already exists.' }, errors: [{ field: 'shareId', code: COLLAB_ERRORS.VALIDATION_FAILED, message: 'Share id already exists.' }] };
  }

  const normalizedPin = normalizePasscode(accessPin);
  const now = Date.now();
  const expiresAt = calculateExpiryTime(expiryOption);
  const itemSnapshot = itemIds.map((id) => ({ id, title: getCaseItem(id)?.title || id, mime: getCaseItem(id)?.mime, category: getCaseItem(id)?.category }));
  const snapshotSeal = computeSnapshotSeal({ token: effectiveShareId, ownerId: resolvedOwnerId, createdAt: now, itemIds, scope, recipientEmail: recipientEmail || '' });

  let passcodeSalt = null, passcodeHash = null;
  if (normalizedPin) {
    passcodeSalt = bytesToHex(getRandomBytes(16));
    passcodeHash = hashPasscode(normalizedPin, passcodeSalt);
  }

  const share = {
    id: effectiveShareId,
    shareId: effectiveShareId,
    ownerId: resolvedOwnerId,
    title,
    description: description || '',
    caseId,
    itemIds: unique(itemIds),
    itemSnapshot,
    recipientEmail: recipientEmail || null,
    recipientId: recipientId || null,
    scope,
    expiryOption,
    expiresAt,
    revoked: false,
    status: SHARE_STATUS.ACTIVE,
    maxViews: maxViews ?? null,
    viewCount: 0,
    downloadCount: 0,
    lastAccessedAt: null,
    passcodeSalt,
    passcodeHash,
    failedAttempts: 0,
    lockedUntil: null,
    accessLog: [],
    snapshotSeal,
    createdAt: now,
    updatedAt: now,
    ownerActor: actor.username || actor.fullName || actor.email || 'citizen',
    illustrative: true,
    noCitizenData: true,
  };

  const all = readShares();
  all[effectiveShareId] = share;
  if (!saveShares(all)) {
    return { ok: false, error: { code: COLLAB_ERRORS.STORAGE_UNAVAILABLE, message: 'Share could not be saved.' }, errors: [{ code: COLLAB_ERRORS.STORAGE_UNAVAILABLE, message: 'Storage write failed.' }] };
  }
  appendAccessLog(share, 'SHARE_CREATED', { itemCount: itemIds.length, scope });
  saveShares(all);

  return { ok: true, share };
}

/**
 * Resolve a share for a viewer. Enforces auth, revocation, expiry, view
 * limits, passcode gating and scope. Returns { ok, share, view } or error.
 */
export function resolveShare({ shareId, viewerId, viewerRole, pin = null, today = new Date() } = {}) {
  const share = getShare(shareId);
  if (!share) {
    return { ok: false, error: { code: COLLAB_ERRORS.SHARE_NOT_FOUND, message: 'Share link does not exist.' }, status: SHARE_STATUS.NOT_FOUND };
  }

  const now = today instanceof Date ? today.getTime() : Date.parse(today) || Date.now();

  // Revocation blocks all access (incl. cached).
  if (share.revoked) {
    appendAccessLog(share, ACCESS_OUTCOME.DENIED_REVOKED, { actor: viewerId });
    persistShare(share);
    return { ok: false, error: { code: COLLAB_ERRORS.PERMISSION_DENIED, message: 'This share has been revoked by the owner.' }, status: SHARE_STATUS.REVOKED, share };
  }

  // Expiry blocks all access.
  if (share.expiresAt && now > share.expiresAt) {
    appendAccessLog(share, ACCESS_OUTCOME.DENIED_EXPIRED, { actor: viewerId });
    persistShare(share);
    return { ok: false, error: { code: COLLAB_ERRORS.PERMISSION_DENIED, message: 'This share link has expired.' }, status: SHARE_STATUS.EXPIRED, share };
  }

  // View quota.
  if (typeof share.maxViews === 'number' && share.viewCount >= share.maxViews) {
    appendAccessLog(share, ACCESS_OUTCOME.DENIED_VIEW_LIMIT, { actor: viewerId, viewCount: share.viewCount });
    persistShare(share);
    return { ok: false, error: { code: COLLAB_ERRORS.PERMISSION_DENIED, message: 'This share link has reached its maximum allowed view limit.' }, status: SHARE_STATUS.VIEW_LIMIT_REACHED, share };
  }

  // Integrity seal.
  const expectedSeal = computeSnapshotSeal({ token: share.shareId, ownerId: share.ownerId, createdAt: share.createdAt, itemIds: share.itemIds, scope: share.scope, recipientEmail: share.recipientEmail || '' });
  if (!constantTimeEqual(share.snapshotSeal, expectedSeal)) {
    appendAccessLog(share, ACCESS_OUTCOME.TAMPERED, { actor: viewerId });
    persistShare(share);
    return { ok: false, error: { code: COLLAB_ERRORS.PERMISSION_DENIED, message: 'Cryptographic integrity check failed for this share.' }, status: SHARE_STATUS.NOT_FOUND, share };
  }

  // Passcode gate + lockout.
  if (share.passcodeHash && share.passcodeSalt) {
    if (share.lockedUntil && now < share.lockedUntil) {
      appendAccessLog(share, ACCESS_OUTCOME.LOCKED, { actor: viewerId, retryAfterMs: share.lockedUntil - now });
      persistShare(share);
      return { ok: false, error: { code: COLLAB_ERRORS.PERMISSION_DENIED, message: 'Too many incorrect passcode attempts. Access is temporarily locked.' }, status: SHARE_STATUS.LOCKED, share, retryAfterMs: share.lockedUntil - now };
    }
    if (share.lockedUntil && now >= share.lockedUntil) { share.lockedUntil = null; share.failedAttempts = 0; }
    const suppliedPin = String(pin ?? '').trim();
    if (!suppliedPin) {
      persistShare(share);
      return { ok: false, error: { code: COLLAB_ERRORS.AUTHENTICATION_REQUIRED, message: 'A viewer passcode is required.' }, status: SHARE_STATUS.ACTIVE, share, pinRequired: true, remainingAttempts: Math.max(0, MAX_PIN_ATTEMPTS - (share.failedAttempts || 0)) };
    }
    if (!constantTimeEqual(hashPasscode(suppliedPin, share.passcodeSalt), share.passcodeHash)) {
      share.failedAttempts = (share.failedAttempts || 0) + 1;
      if (share.failedAttempts >= MAX_PIN_ATTEMPTS) {
        share.lockedUntil = now + PIN_LOCKOUT_MS;
        appendAccessLog(share, ACCESS_OUTCOME.LOCKED, { actor: viewerId, failedAttempts: share.failedAttempts });
        persistShare(share);
        return { ok: false, error: { code: COLLAB_ERRORS.PERMISSION_DENIED, message: 'Too many incorrect passcode attempts.' }, status: SHARE_STATUS.LOCKED, share, retryAfterMs: PIN_LOCKOUT_MS };
      }
      const remaining = MAX_PIN_ATTEMPTS - share.failedAttempts;
      appendAccessLog(share, ACCESS_OUTCOME.DENIED_AUTH, { actor: viewerId, remainingAttempts: remaining });
      persistShare(share);
      return { ok: false, error: { code: COLLAB_ERRORS.AUTHENTICATION_REQUIRED, message: `Incorrect passcode. ${remaining} attempt(s) remaining.` }, status: SHARE_STATUS.ACTIVE, share, pinRequired: true, remainingAttempts: remaining };
    }
    share.failedAttempts = 0; share.lockedUntil = null;
  }

  // Authorized access.
  share.viewCount = (share.viewCount || 0) + 1;
  share.lastAccessedAt = now;
  appendAccessLog(share, ACCESS_OUTCOME.GRANTED, { actor: viewerId, role: viewerRole, scope: share.scope });
  persistShare(share);

  const viewsRemaining = typeof share.maxViews === 'number' ? Math.max(0, share.maxViews - share.viewCount) : null;
  return {
    ok: true,
    status: SHARE_STATUS.ACTIVE,
    share,
    view: {
      shareId: share.shareId,
      title: share.title,
      description: share.description,
      caseId: share.caseId,
      itemIds: share.itemIds,
      itemSnapshot: share.itemSnapshot,
      scope: share.scope,
      viewCount: share.viewCount,
      viewsRemaining,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
      watermark: WATERMARK_TEXT,
      illustrative: true,
      noCitizenData: true,
      readOnly: true,
      integrityVerified: true,
      integrityDigest: share.snapshotSeal,
    },
  };
}

/**
 * Record a download for a share item (only if scope includes download).
 */
export function recordDownload({ shareId, itemId, viewerId, viewerRole } = {}) {
  const share = getShare(shareId);
  if (!share) return { ok: false, error: { code: COLLAB_ERRORS.SHARE_NOT_FOUND, message: 'Share link does not exist.' } };
  if (share.scope !== SHARE_SCOPE_VALUES.VIEW_AND_DOWNLOAD) {
    appendAccessLog(share, ACCESS_OUTCOME.DENIED_SCOPE, { actor: viewerId, itemId });
    persistShare(share);
    return { ok: false, error: { code: COLLAB_ERRORS.SCOPE_DENIED, message: 'Download not permitted for this share scope.' } };
  }
  if (!getCaseItem(itemId)) return { ok: false, error: { code: COLLAB_ERRORS.ITEM_NOT_FOUND, message: 'Unknown item id.' } };
  share.downloadCount = (share.downloadCount || 0) + 1;
  appendAccessLog(share, ACCESS_OUTCOME.DOWNLOAD, { actor: viewerId, role: viewerRole, itemId });
  persistShare(share);
  return { ok: true, downloadCount: share.downloadCount, itemId, watermark: WATERMARK_TEXT };
}

/**
 * Revoke a share. Requires owner or authenticated actor.
 */
export function revokeShare({ shareId, actor = null } = {}) {
  if (!actor) return { ok: false, error: { code: COLLAB_ERRORS.AUTHENTICATION_REQUIRED, message: 'Authentication required to revoke a share.' } };
  const share = getShare(shareId);
  if (!share) return { ok: false, error: { code: COLLAB_ERRORS.SHARE_NOT_FOUND, message: 'Share link does not exist.' } };
  if (share.revoked) return { ok: true, shareId, status: SHARE_STATUS.REVOKED, message: 'Already revoked.' };
  share.revoked = true;
  share.revokedAt = Date.now();
  share.revokedBy = actor.username || actor.fullName || actor.email || 'citizen';
  appendAccessLog(share, ACCESS_OUTCOME.REVOKED_BY_OWNER, { actor: share.revokedBy });
  persistShare(share);
  return { ok: true, shareId, status: SHARE_STATUS.REVOKED, message: 'Share revoked. Cached access is blocked.' };
}

/**
 * List shares (owner-facing metadata only, no raw document content).
 */
export function listShares({ ownerId } = {}) {
  const all = readShares();
  let shares = Object.values(all);
  if (ownerId) shares = shares.filter((s) => s.ownerId === ownerId);
  return shares.map((s) => ({
    id: s.id,
    shareId: s.shareId,
    title: s.title,
    caseId: s.caseId,
    itemCount: s.itemIds.length,
    scope: s.scope,
    status: s.status,
    expiresAt: s.expiresAt,
    viewCount: s.viewCount,
    downloadCount: s.downloadCount,
    createdAt: s.createdAt,
    revoked: s.revoked,
    ownerActor: s.ownerActor,
    illustrative: true,
  }));
}

/**
 * Get the audit log for a share (owner-facing).
 */
export function getShareAuditLog({ shareId, actor = null } = {}) {
  if (!actor) return { ok: false, error: { code: COLLAB_ERRORS.AUTHENTICATION_REQUIRED, message: 'Authentication required.' } };
  const share = getShare(shareId);
  if (!share) return { ok: false, error: { code: COLLAB_ERRORS.SHARE_NOT_FOUND, message: 'Share link does not exist.' } };
  return { ok: true, shareId, accessLog: Array.isArray(share.accessLog) ? share.accessLog : [] };
}

/**
 * Stale-data check.
 */
export function isCollaborationDataStale(today = new Date()) {
  const age = daysBetween(CIVIC_CASE_COLLABORATION_REVIEW_DATE, todayIso(today));
  return age !== null && age > CIVIC_CASE_COLLABORATION_STALE_AFTER_DAYS;
}

function daysBetween(fromIso, toIsoValue) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIsoValue}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86400000);
}

function todayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) return today.toISOString().slice(0, 10);
  if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  return new Date().toISOString().slice(0, 10);
}

function persistShare(share) {
  const all = readShares();
  all[share.shareId] = share;
  saveShares(all);
}

export function buildCollaborationReport(result) {
  if (!result || result.ok !== true) return 'No collaboration result to report.';
  const { share, view } = result;
  const lines = [];
  lines.push('CASE COLLABORATION SHARE REPORT (illustrative, untrusted)');
  lines.push(`Share: ${share.title} (${share.shareId})`);
  lines.push(`Case: ${share.caseId} | Scope: ${share.scope} | Status: ${share.status}`);
  lines.push(`Owner: ${share.ownerActor} | Views: ${share.viewCount} | Downloads: ${share.downloadCount}`);
  lines.push(`Watermark: ${WATERMARK_TEXT}`);
  lines.push('');
  lines.push('ITEMS');
  (view.itemSnapshot || []).forEach((item) => lines.push(`- ${item.title} (${item.category})`));
  lines.push('');
  lines.push(result.disclaimer || CIVIC_CASE_COLLABORATION_DISCLAIMER);
  return lines.join('\n');
}

export const __testables = {
  validateCollaborationRequest,
  createShare,
  resolveShare,
  recordDownload,
  revokeShare,
  listShares,
  getShareAuditLog,
  isCollaborationDataStale,
  computeSnapshotSeal,
  hashPasscode,
  constantTimeEqual,
  generateShareToken,
  COLLAB_ERRORS,
  SHARE_STATUS,
  ACCESS_OUTCOME,
  SHARE_SCOPE_VALUES,
};
