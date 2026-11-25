/**
 * Validation and storage primitives for the tree inventory.
 *
 * Every write reaches the trusted service boundary through these helpers. The
 * browser also validates forms for fast feedback, but the service never trusts
 * that the caller did so.
 */

import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  TREE_API_LIMITS,
  TREE_ERROR_CODES,
  TREE_ERROR_MESSAGES,
} from './treeInventoryConstants';
import { minimizeForExternal } from '../utils/dataMinimization';
import { safeHttpUrl, sanitizePlainText } from '../utils/safeContent';

export class TreeServiceError extends Error {
  /**
   * @param {string} code stable machine-readable code
   * @param {string} [message] developer context
   * @param {{ fieldErrors?: Record<string,string>, details?: object, userMessage?: string }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message || TREE_ERROR_MESSAGES[code] || TREE_ERROR_MESSAGES[TREE_ERROR_CODES.VALIDATION_ERROR]);
    this.name = 'TreeServiceError';
    this.code = code;
    this.userMessage = extra.userMessage || TREE_ERROR_MESSAGES[code] || TREE_ERROR_MESSAGES[TREE_ERROR_CODES.VALIDATION_ERROR];
    this.fieldErrors = extra.fieldErrors || {};
    this.details = extra.details || {};
  }
}

export const createTreeError = (code, message, extra) => new TreeServiceError(code, message, extra);

export const getTreeStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const safeReadJson = (storage, key, fallback) => {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

/** Returns false (rather than throwing) so the caller can produce a recoverable error. */
export const safeWriteJson = (storage, key, value) => {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const removeStorageKey = (storage, key) => {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore: the caller reports the larger failure.
  }
};

export const nowIso = (nowMs = Date.now()) => new Date(nowMs).toISOString();

export const cloneJson = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

const randomSuffix = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  } catch {
    // Fall through to the deterministic-ish fallback below.
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

export const newTreeId = (prefix) => `${prefix}_${randomSuffix()}`;

/** FNV-1a, used for demo-safe fingerprints and the audit hash chain. */
export const hashString = (value = '') => {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const sanitizePlain = (value, { max = 500, multiline = false } = {}) =>
  sanitizePlainText(value, { max, multiline }).trim();

/**
 * Public narrative fields must not accumulate emails, phone numbers, national
 * identifiers or precise coordinate pairs. The text is sanitized (no markup)
 * and then minimized using the repository-wide PII rules.
 */
export const sanitizePublicNarrative = (value, { max = TREE_API_LIMITS.maxNotesLength, multiline = true } = {}) =>
  minimizeForExternal(sanitizePlainText(value, { max, multiline })).trim();

export const requireString = (value, field, { min = 1, max = 500, multiline = false, code = TREE_ERROR_CODES.VALIDATION_ERROR } = {}) => {
  const clean = sanitizePlain(value, { max, multiline });
  if (clean.length < min) {
    throw createTreeError(code, `${field} must be at least ${min} characters.`, {
      fieldErrors: { [field]: `${field} must be at least ${min} characters.` },
    });
  }
  return clean;
};

export const optionalString = (value, field, { max = 500, multiline = false } = {}) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, `${field} must be text.`, {
      fieldErrors: { [field]: `${field} must be text.` },
    });
  }
  return sanitizePlain(value, { max, multiline });
};

export const requireEnum = (value, enumObject, field) => {
  const allowed = Object.values(enumObject);
  if (!allowed.includes(value)) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, `${field} must be one of ${allowed.join(', ')}.`, {
      fieldErrors: { [field]: `Choose one of: ${allowed.join(', ')}.` },
    });
  }
  return value;
};

export const requireIsoDate = (value, field, { notFuture = false, notPast = false, nowMs = Date.now() } = {}) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, `${field} is required.`, {
      fieldErrors: { [field]: `${field} is required.` },
    });
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, `${field} must be a valid date.`, {
      fieldErrors: { [field]: `${field} must be a valid date.` },
    });
  }
  if (notFuture && parsed > nowMs + 24 * 60 * 60 * 1000) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, `${field} cannot be in the future.`, {
      fieldErrors: { [field]: `${field} cannot be in the future.` },
    });
  }
  if (notPast && parsed < nowMs - 24 * 60 * 60 * 1000) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, `${field} cannot be in the past.`, {
      fieldErrors: { [field]: `${field} cannot be in the past.` },
    });
  }
  return new Date(parsed).toISOString();
};

export const optionalIsoDate = (value, field, options) => {
  if (value === undefined || value === null || value === '') return null;
  return requireIsoDate(value, field, options);
};

export const requireNumberRange = (value, field, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw createTreeError(TREE_ERROR_CODES.VALIDATION_ERROR, `${field} must be between ${min} and ${max}.`, {
      fieldErrors: { [field]: `${field} must be between ${min} and ${max}.` },
    });
  }
  return num;
};

export const validateApproxCoordinates = (coordinates, { required = false } = {}) => {
  if (coordinates === undefined || coordinates === null || coordinates === '') {
    if (required) {
      throw createTreeError(TREE_ERROR_CODES.INVALID_COORDINATES, 'Approximate coordinates are required.', {
        fieldErrors: { coordinates: 'Enter an approximate latitude and longitude.' },
      });
    }
    return null;
  }
  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw createTreeError(TREE_ERROR_CODES.INVALID_COORDINATES, 'Invalid latitude or longitude.');
  }
  return {
    // Public coordinate is deliberately coarse (~1 km). Staff may store a
    // precise point separately; the public projection never reads it.
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
    precision: 'approx_1km',
  };
};

export const validatePreciseCoordinates = (coordinates) => {
  if (coordinates === undefined || coordinates === null || coordinates === '') return null;
  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw createTreeError(TREE_ERROR_CODES.INVALID_COORDINATES, 'Invalid precise latitude or longitude.');
  }
  // 5 decimal places is ~1 m. Anything more is false precision and increases risk.
  return { lat: Math.round(lat * 100000) / 100000, lng: Math.round(lng * 100000) / 100000 };
};

export const haversineMeters = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

export const gridBucketFor = (coordinates) => {
  if (!coordinates) return 'unknown_grid';
  return `geo_${Number(coordinates.lat).toFixed(2)}_${Number(coordinates.lng).toFixed(2)}`;
};

const SAFE_IMAGE_DATA_URI = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{8,}$/;

export const isSafeTreeImageUrl = (value) => {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || text.length > 2_000_000) return false;
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f-\u009f]/.test(text)) return false;
  if (SAFE_IMAGE_DATA_URI.test(text)) return true;
  const safe = safeHttpUrl(text);
  if (!safe) return false;
  return !/\.svg(?:$|\?)/i.test(safe);
};

/**
 * Validates citizen report attachments. SVG/HTML and oversized files are
 * rejected before any bytes are stored or any model/triage code runs.
 */
export const validateAttachments = (attachments = []) => {
  if (attachments === undefined || attachments === null) return [];
  if (!Array.isArray(attachments)) {
    throw createTreeError(TREE_ERROR_CODES.UNSAFE_ATTACHMENT, 'Attachments must be an array.');
  }
  if (attachments.length > TREE_API_LIMITS.maxAttachmentsPerReport) {
    throw createTreeError(
      TREE_ERROR_CODES.UNSAFE_ATTACHMENT,
      `At most ${TREE_API_LIMITS.maxAttachmentsPerReport} images are accepted.`
    );
  }

  return attachments.map((attachment, index) => {
    if (!attachment || typeof attachment !== 'object') {
      throw createTreeError(TREE_ERROR_CODES.UNSAFE_ATTACHMENT, `Attachment ${index + 1} is invalid.`);
    }
    const mimeType = String(attachment.mimeType || '').toLowerCase().trim();
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(mimeType)) {
      throw createTreeError(TREE_ERROR_CODES.UNSAFE_ATTACHMENT, `Attachment ${index + 1} has an unsupported type.`);
    }
    const sizeBytes = Number(attachment.sizeBytes || 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > TREE_API_LIMITS.maxAttachmentBytes) {
      throw createTreeError(TREE_ERROR_CODES.UNSAFE_ATTACHMENT, `Attachment ${index + 1} is too large.`);
    }
    if (!isSafeTreeImageUrl(attachment.url)) {
      throw createTreeError(TREE_ERROR_CODES.UNSAFE_ATTACHMENT, `Attachment ${index + 1} failed content safety validation.`);
    }
    return {
      id: attachment.id || newTreeId('attach'),
      mimeType,
      sizeBytes,
      url: attachment.url,
      caption: sanitizePublicNarrative(attachment.caption || '', { max: 180, multiline: false }),
      exifStripped: true,
      createdAt: attachment.createdAt || nowIso(),
    };
  });
};

export const normalizeSearch = (value = '') =>
  sanitizePlain(value, { max: TREE_API_LIMITS.maxSearchLength, multiline: false }).toLowerCase();

export const paginate = (items, { page = 1, pageSize = TREE_API_LIMITS.defaultPageSize } = {}) => {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeSize = Math.min(
    TREE_API_LIMITS.maxTreesPerPage,
    Math.max(1, Math.floor(Number(pageSize) || TREE_API_LIMITS.defaultPageSize))
  );
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    page: currentPage,
    pageSize: safeSize,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
};

/**
 * Multi-key write with rollback. localStorage has no transactions, so we
 * snapshot every key, apply all writes, and restore the snapshot if any write
 * fails. Validation always runs before this helper is called.
 */
export const runTreeTransaction = (storage, keys, mutator) => {
  const source = storage || getTreeStorage();
  if (!source) {
    throw createTreeError(TREE_ERROR_CODES.STORAGE_ERROR, 'No storage is available.');
  }
  const before = new Map();
  const draft = new Map();
  for (const key of keys) {
    const raw = source.getItem(key);
    before.set(key, raw);
    let parsed = [];
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = [];
      }
    }
    draft.set(key, parsed);
  }

  const result = mutator(draft, { now: nowIso() });

  try {
    for (const key of keys) {
      const value = draft.get(key);
      source.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    for (const [key, raw] of before.entries()) {
      try {
        if (raw === null) source.removeItem(key);
        else source.setItem(key, raw);
      } catch {
        // Best effort: the original error is the useful one.
      }
    }
    throw createTreeError(TREE_ERROR_CODES.STORAGE_ERROR, `Transaction failed: ${error?.message || error}`);
  }

  return result;
};

export const changeSummary = (before, after, fields = []) =>
  fields.reduce((acc, field) => {
    const oldValue = before?.[field];
    const newValue = after?.[field];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      acc[field] = { before: oldValue ?? null, after: newValue ?? null };
    }
    return acc;
  }, {});
