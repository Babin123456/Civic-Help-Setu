import { getApplicabilityLabel, normalizeJurisdiction, validateJurisdiction } from './jurisdictionService.js';
import { MAX_VERIFICATION_AGE_DAYS } from './sourceFreshnessTimelineService.js';
import { getServiceById } from './serviceCatalog.js';
import { requirePermission } from './accessControl.js';

export const REGIONAL_REVIEW_KEY = 'civicbridge_regional_reviews_v1';
export const MAX_DIRECTORY_RECORDS = 5000;
export const MAX_REVIEW_HISTORY = 100;
const MAX_BYTES = 2_000_000;
const AVAILABILITY = ['unknown', 'available', 'unavailable'];
const storageFor = (storage) => storage || globalThis.localStorage;
const dateOnly = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const publicUrl = (value) => {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 1000) throw new Error('Use a public HTTPS URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Use a public HTTPS URL without credentials, query strings or fragments.');
  }
  return url.href;
};

export function validateRegionalReview(input, now = Date.now()) {
  if (typeof input?.cadenceDays !== 'number' && !(typeof input?.cadenceDays === 'string' && /^\d+$/.test(input.cadenceDays))) throw new Error('Review cadence must be a whole number.');
  const cadenceDays = Number(input.cadenceDays);
  if (!Number.isInteger(cadenceDays) || cadenceDays < 1 || cadenceDays > 365) throw new Error('Review cadence must be 1 to 365 whole days.');
  if (!AVAILABILITY.includes(input?.availability)) throw new Error('Choose a valid availability status.');
  const verifiedAt = input?.verifiedAt || '';
  if (verifiedAt && (!dateOnly(verifiedAt) || Date.parse(verifiedAt) > now)) throw new Error('Use a real review date that is not in the future.');
  const sourceUrl = publicUrl(input?.sourceUrl);
  const authorityUrl = publicUrl(input?.authorityUrl);
  if ((verifiedAt || input.availability !== 'unknown') && (!sourceUrl || !verifiedAt)) {
    throw new Error('A dated source is required before recording reviewed availability.');
  }
  return { cadenceDays, availability: input.availability, verifiedAt, sourceUrl, authorityUrl };
}

/** Public metadata only: no actor, reviewer name, team, private note or ownership history. */
export function readRegionalReviews(storage) {
  try {
    const raw = storageFor(storage)?.getItem(REGIONAL_REVIEW_KEY);
    if (!raw) return { ok: true, records: {} };
    if (raw.length > MAX_BYTES) throw new Error();
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== 1 || !parsed.records || typeof parsed.records !== 'object' || Array.isArray(parsed.records)) throw new Error();
    const entries = Object.entries(parsed.records);
    if (entries.length > MAX_DIRECTORY_RECORDS) throw new Error();
    const records = Object.create(null);
    for (const [id, record] of entries) {
      if (!/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(id) || !Number.isSafeInteger(record?.revision) || record.revision < 1) throw new Error();
      const history = record.history;
      if (!Array.isArray(history) || history.length > MAX_REVIEW_HISTORY || record.revision !== history.length + 1 || history.some((entry, index) => entry.revision !== index + 1)) throw new Error();
      records[id] = {
        ...validateRegionalReview(record), revision: record.revision,
        history: history.map((entry) => ({ ...validateRegionalReview(entry), revision: Number(entry.revision) || 0 })),
      };
    }
    return { ok: true, records };
  } catch {
    return { ok: false, records: {}, error: 'Local directory review storage is unreadable. Export or restore a known-good backup before changing it.' };
  }
}

/** Uses a browser lock and revision check so stale tabs cannot overwrite a newer local review. */
export async function saveRegionalReview(serviceId, input, { expectedRevision = 0, storage, locks = globalThis.navigator?.locks, now = Date.now() } = {}) {
  requirePermission('ownership.manage');
  if (!getServiceById(serviceId)) return { ok: false, error: 'Service is not in the current catalogue.' };
  let value;
  try { value = validateRegionalReview(input, now); } catch (error) { return { ok: false, error: error.message }; }
  if (!locks?.request) return { ok: false, error: 'Safe local editing requires browser Web Locks. This browser can still read the directory.' };
  try {
    return await locks.request(REGIONAL_REVIEW_KEY, () => {
      requirePermission('ownership.manage');
      const state = readRegionalReviews(storage);
      if (!state.ok) return state;
      const old = state.records[serviceId];
      if ((old?.revision || 0) !== expectedRevision) return { ok: false, error: 'This review changed in another tab. Close and reopen the form before retrying.' };
      if ((!old && Object.keys(state.records).length >= MAX_DIRECTORY_RECORDS) || (old?.history.length || 0) >= MAX_REVIEW_HISTORY) {
        return { ok: false, error: 'Local review capacity reached. Export the history and plan an approved archive/migration before more updates.' };
      }
      const history = old ? [...old.history, { ...validateRegionalReview(old, now), revision: old.revision }] : [];
      const record = { ...value, revision: (old?.revision || 0) + 1, history };
      const serialized = JSON.stringify({ schemaVersion: 1, records: { ...state.records, [serviceId]: record } });
      if (serialized.length > MAX_BYTES) return { ok: false, error: 'Local review capacity reached. Export before changing it.' };
      storageFor(storage).setItem(REGIONAL_REVIEW_KEY, serialized);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(REGIONAL_REVIEW_KEY));
      return { ok: true, record };
    });
  } catch {
    return { ok: false, error: 'Could not save the local review. Previous stored reviews are preserved; please retry.' };
  }
}

export function buildRegionalDirectory(services, reviews = {}, now = Date.now()) {
  const groups = new Map();
  const entries = services.map((service) => {
    const review = reviews[service.id];
    let sourceUrl = review?.sourceUrl || '';
    if (!sourceUrl) for (const source of service.resources || []) {
      try { sourceUrl = publicUrl(source.url); } catch { /* An unsafe source is not published. */ }
      if (sourceUrl) break;
    }
    const verifiedAt = review?.verifiedAt ?? (dateOnly(service.lastVerified) ? service.lastVerified : '');
    const cadenceDays = review?.cadenceDays || MAX_VERIFICATION_AGE_DAYS;
    const age = verifiedAt ? now - Date.parse(verifiedAt) : NaN;
    const jurisdiction = normalizeJurisdiction(service.jurisdiction);
    const invalidJurisdiction = validateJurisdiction(jurisdiction).length > 0;
    const status = !sourceUrl || !Number.isFinite(age) || age < 0 || invalidJurisdiction ? 'unknown' : age >= cadenceDays * 86400000 ? 'stale' : 'current';
    const entry = { id: service.id, name: service.name, department: service.department || 'Authority not specified', region: getApplicabilityLabel(service), sourceUrl, authorityUrl: review?.authorityUrl || '', verifiedAt, cadenceDays, status, availability: review?.availability || 'unknown', conflict: invalidJurisdiction, escalation: status === 'stale' ? 'Maintainer review overdue; confirm current availability with the authority.' : '' };
    if (!invalidJurisdiction) {
      const regionKey = JSON.stringify([jurisdiction.level, [...jurisdiction.states].sort(), [...jurisdiction.districts].sort(), jurisdiction.localBody]).toLowerCase();
      const key = `${String(service.name).trim().toLowerCase()}|${regionKey}`;
      const group = groups.get(key) || []; group.push(entry); groups.set(key, group);
    }
    return entry;
  });
  for (const group of groups.values()) {
    if (new Set(group.map((entry) => `${entry.department.toLowerCase()}|${entry.availability}|${entry.authorityUrl}`)).size > 1) {
      for (const entry of group) entry.conflict = true;
    }
  }
  return entries;
}
