/**
 * src/services/portalChangeMonitorService.js
 *
 * Government Portal Change Detection & Broken-Link Monitor (#1428).
 *
 * Extends `linkHealthService.js` with:
 *   1. Source ownership & jurisdiction metadata per monitored portal.
 *   2. Noise-tolerant content fingerprinting (strips dynamic timestamps/whitespace)
 *      for meaningful-change detection.
 *   3. HTTP health & redirect tracking with `lastCheckedAt`.
 *   4. Human review queue for broken links, redirects, and meaningful content changes.
 *   5. PII-free audit log.
 */

import { safeHttpUrl } from '../utils/safeContent.js';

export const PORTAL_MONITOR_STORAGE_KEY = 'civicbridge_portal_monitor_sources_v1';
export const PORTAL_REVIEW_QUEUE_KEY = 'civicbridge_portal_monitor_reviews_v1';
export const PORTAL_AUDIT_LOG_KEY = 'civicbridge_portal_monitor_audit_v1';

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

export function hasForbiddenPII(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input || {});
  return AADHAAR_RE.test(s) || PAN_RE.test(s);
}

/**
 * Strips dynamic timestamps, session tokens, and extra whitespace before
 * computing a content fingerprint so trivial churn does not trigger false alerts.
 */
export function normalizePortalContent(rawText = '') {
  return String(rawText || '')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '<TS>')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/gi, '<TIME>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Deterministic FNV-1a 32-bit hex fingerprint of normalized portal content.
 */
export function computeContentFingerprint(rawText = '') {
  const norm = normalizePortalContent(rawText);
  let hash = 0x811c9dc5;
  for (let i = 0; i < norm.length; i += 1) {
    hash ^= norm.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fp_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export const DEFAULT_MONITORED_PORTALS = Object.freeze([
  {
    sourceId: 'portal-edistrict-delhi',
    url: 'https://edistrict.delhigovt.nic.in',
    sourceOwner: 'Revenue Department, GNCTD',
    jurisdiction: 'Delhi',
    effectiveDate: '2026-04-01',
    httpStatus: 200,
    redirectedTo: null,
    contentFingerprint: computeContentFingerprint('Delhi e-District Income & Caste Certificate Portal'),
    lastCheckedAt: '2026-11-26T10:00:00.000Z',
    healthStatus: 'HEALTHY',
  },
  {
    sourceId: 'portal-cpgrams',
    url: 'https://pgportal.gov.in',
    sourceOwner: 'DARPG, Ministry of Personnel',
    jurisdiction: 'All India',
    effectiveDate: '2026-01-01',
    httpStatus: 200,
    redirectedTo: null,
    contentFingerprint: computeContentFingerprint('CPGRAMS Central Public Grievance Redressal Portal'),
    lastCheckedAt: '2026-11-26T10:00:00.000Z',
    healthStatus: 'HEALTHY',
  },
]);

const memoryFallback = new Map();
const fallbackStorage = {
  getItem: (k) => (memoryFallback.has(k) ? memoryFallback.get(k) : null),
  setItem: (k, v) => memoryFallback.set(k, String(v)),
};

function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // ignore
  }
  return fallbackStorage;
}

function readJson(key, fallback, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listMonitoredPortals(customStorage = null) {
  const saved = readJson(PORTAL_MONITOR_STORAGE_KEY, null, customStorage);
  if (Array.isArray(saved) && saved.length > 0) return saved;
  return DEFAULT_MONITORED_PORTALS.map((p) => ({ ...p }));
}

export function listPortalReviewQueue(customStorage = null) {
  return readJson(PORTAL_REVIEW_QUEUE_KEY, [], customStorage);
}

export function listPortalAuditLog(customStorage = null) {
  return readJson(PORTAL_AUDIT_LOG_KEY, [], customStorage);
}

function appendPortalAudit(entry, customStorage = null) {
  const logs = listPortalAuditLog(customStorage);
  logs.unshift({
    auditId: `pm_aud_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  writeJson(PORTAL_AUDIT_LOG_KEY, logs.slice(0, 500), customStorage);
}

/**
 * Evaluates a portal check observation (HTTP status, redirect, and optional content sample),
 * updates `lastCheckedAt`, and enqueues a human review item if broken, redirected, or
 * meaningfully changed.
 */
export function recordPortalCheck({
  sourceId,
  url,
  sourceOwner = 'Public Authority',
  jurisdiction = 'All India',
  httpStatus = 200,
  redirectedTo = null,
  contentSample = '',
  actorId = 'scheduler_monitor',
  customStorage = null,
}) {
  const cleanUrl = safeHttpUrl(url);
  if (!cleanUrl) throw new Error('Valid http(s) portal URL is required.');
  if (hasForbiddenPII({ sourceOwner, contentSample })) {
    throw new Error('Portal monitor payload must not contain Aadhaar or PAN numbers.');
  }

  const portals = listMonitoredPortals(customStorage);
  const existingIdx = portals.findIndex((p) => p.sourceId === sourceId);
  const prev = existingIdx >= 0 ? portals[existingIdx] : null;

  const newFingerprint = contentSample
    ? computeContentFingerprint(contentSample)
    : prev?.contentFingerprint || null;

  const isBroken = Number(httpStatus) >= 400 || Number(httpStatus) === 0;
  const isRedirected = Boolean(redirectedTo && redirectedTo !== cleanUrl);
  const hasMeaningfulChange = Boolean(
    prev?.contentFingerprint && newFingerprint && prev.contentFingerprint !== newFingerprint
  );

  const healthStatus = isBroken
    ? 'BROKEN_LINK'
    : isRedirected
      ? 'REDIRECTED'
      : hasMeaningfulChange
        ? 'CONTENT_CHANGED'
        : 'HEALTHY';

  const nowIso = new Date().toISOString();
  const updatedRecord = {
    sourceId,
    url: cleanUrl,
    sourceOwner,
    jurisdiction,
    effectiveDate: prev?.effectiveDate || nowIso.slice(0, 10),
    httpStatus: Number(httpStatus),
    redirectedTo: isRedirected ? redirectedTo : null,
    contentFingerprint: newFingerprint,
    lastCheckedAt: nowIso,
    healthStatus,
  };

  if (existingIdx >= 0) {
    portals[existingIdx] = updatedRecord;
  } else {
    portals.unshift(updatedRecord);
  }
  writeJson(PORTAL_MONITOR_STORAGE_KEY, portals, customStorage);

  let reviewItem = null;
  if (isBroken || isRedirected || hasMeaningfulChange) {
    const queue = listPortalReviewQueue(customStorage);
    reviewItem = {
      changeId: `pchk_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      sourceId,
      url: cleanUrl,
      sourceOwner,
      jurisdiction,
      changeReason: isBroken
        ? `HTTP ${httpStatus} Broken Link`
        : isRedirected
          ? `Redirected to ${redirectedTo}`
          : 'Meaningful content fingerprint change',
      previousFingerprint: prev?.contentFingerprint || null,
      newFingerprint,
      status: 'PENDING_REVIEW',
      detectedAt: nowIso,
    };
    queue.unshift(reviewItem);
    writeJson(PORTAL_REVIEW_QUEUE_KEY, queue.slice(0, 200), customStorage);
  }

  appendPortalAudit(
    {
      action: 'PORTAL_CHECK_RECORDED',
      sourceId,
      actorId,
      healthStatus,
      httpStatus: Number(httpStatus),
    },
    customStorage
  );

  return { record: updatedRecord, reviewItem, hasMeaningfulChange, isBroken, isRedirected };
}

export function reviewPortalChange({
  changeId,
  reviewerId = 'reviewer_local',
  reviewerRole = 'reviewer',
  decision,
  rationale = '',
  customStorage = null,
}) {
  if (!['admin', 'reviewer', 'municipal_officer'].includes(reviewerRole)) {
    throw new Error('Forbidden: admin or reviewer role required.');
  }
  if (!['APPROVE', 'REJECT'].includes(decision)) {
    throw new Error('decision must be APPROVE or REJECT.');
  }
  if (hasForbiddenPII(rationale)) {
    throw new Error('Review rationale must not contain Aadhaar or PAN numbers.');
  }

  const queue = listPortalReviewQueue(customStorage);
  const item = queue.find((q) => q.changeId === changeId);
  if (!item) throw new Error('Portal review item not found.');

  item.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  item.reviewedBy = reviewerId;
  item.reviewRationale = rationale.trim();
  item.reviewedAt = new Date().toISOString();
  writeJson(PORTAL_REVIEW_QUEUE_KEY, queue, customStorage);

  appendPortalAudit(
    {
      action: decision === 'APPROVE' ? 'PORTAL_CHANGE_APPROVED' : 'PORTAL_CHANGE_REJECTED',
      changeId,
      sourceId: item.sourceId,
      actorId: reviewerId,
    },
    customStorage
  );

  return item;
}
