/**
 * Manual Service Availability Notices (#274)
 *
 * A maintainer can publish a temporary notice on a service guide when an official portal or
 * process is known to be unavailable for a period (for example announced maintenance).
 *
 * What this is not: it does not monitor any portal. Every notice is typed in by an admin, and the
 * guide itself is never changed or deleted. Whether a notice is shown is worked out from its dates
 * every time it is read, so an expired notice simply stops appearing.
 *
 * Times are stored as exact instants (ISO strings) and always displayed in India Standard Time.
 * Kept separate from appointment scheduling and application intake windows.
 */
import { requirePermission } from './accessControl';
import { getAllServices } from './serviceCatalog';
import { sanitizePlainText, safeHttpUrl } from '../utils/safeContent';

export const AVAILABILITY_STORAGE_KEY = 'civicbridge_service_availability_notices_v1';

/** The one timezone every notice time is entered and shown in. */
export const NOTICE_TIME_ZONE = 'Asia/Kolkata';
export const NOTICE_TIME_ZONE_LABEL = 'IST';
const IST_OFFSET = '+05:30';
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

export const PUBLICATION_STATES = { DRAFT: 'draft', PUBLISHED: 'published', WITHDRAWN: 'withdrawn' };

/** What a notice is right now. Only ACTIVE is shown to citizens as current. */
export const NOTICE_STATUS = {
  MALFORMED: 'malformed',
  DRAFT: 'draft',
  WITHDRAWN: 'withdrawn',
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  EXPIRED: 'expired',
};

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_SOURCE_NAME_LENGTH = 120;

const parseInstant = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Turns an admin's "YYYY-MM-DDTHH:mm" (datetime-local) into an ISO instant, reading it as IST.
 * Returns '' for anything that is not a real calendar date and time.
 */
export const istInputToIso = (value) => {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return '';
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (
    probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d ||
    probe.getUTCHours() !== h || probe.getUTCMinutes() !== mi
  ) return '';
  const ms = Date.parse(`${text}:00${IST_OFFSET}`);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString();
};

/** The reverse of istInputToIso, for filling a datetime-local field when editing. */
export const isoToIstInput = (iso) => {
  const ms = parseInstant(iso);
  if (ms === null) return '';
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 16);
};

/** "29 Oct 2026, 02:30 pm IST" for any ISO instant, or '' if it is not a valid date. */
export const formatNoticeTime = (iso) => {
  const ms = parseInstant(iso);
  if (ms === null) return '';
  const text = new Intl.DateTimeFormat('en-IN', {
    timeZone: NOTICE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms));
  return `${text} ${NOTICE_TIME_ZONE_LABEL}`;
};

/**
 * Checks a notice. Returns { isValid, errors }. `services` is the list of valid service records
 * (defaults to the catalogue); a notice must point at one of them.
 */
export const validateAvailabilityNotice = (notice, services = getAllServices()) => {
  const errors = [];
  if (!notice || typeof notice !== 'object' || Array.isArray(notice)) {
    return { isValid: false, errors: ['Notice is missing.'] };
  }

  if (typeof notice.serviceId !== 'string' || !(services || []).some((s) => s && s.id === notice.serviceId)) {
    errors.push('Choose a service that exists in the catalogue.');
  }

  const message = typeof notice.message === 'string' ? sanitizePlainText(notice.message) : '';
  if (!message) errors.push('Add a short explanation.');
  else if (message.length > MAX_MESSAGE_LENGTH) errors.push(`Keep the explanation under ${MAX_MESSAGE_LENGTH} characters.`);

  const start = parseInstant(notice.startsAt);
  const end = parseInstant(notice.endsAt);
  if (start === null) errors.push('Enter a valid start time.');

  if (notice.ongoing === true) {
    if (notice.endsAt) errors.push('An ongoing notice has no end time. Remove the end time or untick ongoing.');
  } else if (end === null) {
    errors.push('Enter an end time, or mark the notice as ongoing.');
  } else if (start !== null && end <= start) {
    errors.push('The end time must be after the start time.');
  }

  const sourceName = typeof notice.sourceName === 'string' ? sanitizePlainText(notice.sourceName, { multiline: false }) : '';
  if (!sourceName) errors.push('Name the official source.');
  else if (sourceName.length > MAX_SOURCE_NAME_LENGTH) errors.push(`Keep the source name under ${MAX_SOURCE_NAME_LENGTH} characters.`);

  const hasUrl = typeof notice.sourceUrl === 'string' && notice.sourceUrl.trim() !== '';
  if (hasUrl && !safeHttpUrl(notice.sourceUrl)) errors.push('The source link must be a valid http or https address.');
  if (notice.confirmed === true && !safeHttpUrl(notice.sourceUrl)) {
    errors.push('A confirmed notice needs a link to the official announcement.');
  }

  if (!Object.values(PUBLICATION_STATES).includes(notice.state)) errors.push('Publication state is not valid.');

  return { isValid: errors.length === 0, errors };
};

/**
 * What a notice is at `now`. A malformed record is MALFORMED and never shown.
 * An open-ended notice counts as ongoing only when it says so explicitly; a missing end time
 * without the ongoing flag is malformed.
 */
export const getNoticeStatus = (notice, now = new Date(), services = getAllServices()) => {
  if (!validateAvailabilityNotice(notice, services).isValid) return NOTICE_STATUS.MALFORMED;
  if (notice.state === PUBLICATION_STATES.DRAFT) return NOTICE_STATUS.DRAFT;
  if (notice.state === PUBLICATION_STATES.WITHDRAWN) return NOTICE_STATUS.WITHDRAWN;

  const t = now instanceof Date ? now.getTime() : Date.parse(now);
  if (Number.isNaN(t)) return NOTICE_STATUS.MALFORMED;
  if (t < Date.parse(notice.startsAt)) return NOTICE_STATUS.UPCOMING;
  if (notice.ongoing !== true && t >= Date.parse(notice.endsAt)) return NOTICE_STATUS.EXPIRED;
  return NOTICE_STATUS.ACTIVE;
};

/** Cleaned copy of a notice, safe to store and render. Does not validate. */
const normalizeNotice = (notice) => ({
  id: notice.id,
  serviceId: notice.serviceId,
  message: sanitizePlainText(notice.message || ''),
  startsAt: notice.startsAt || '',
  endsAt: notice.ongoing === true ? '' : notice.endsAt || '',
  ongoing: notice.ongoing === true,
  sourceName: sanitizePlainText(notice.sourceName || '', { multiline: false }),
  sourceUrl: safeHttpUrl(notice.sourceUrl || ''),
  confirmed: notice.confirmed === true && Boolean(safeHttpUrl(notice.sourceUrl || '')),
  state: notice.state,
  createdAt: notice.createdAt,
  updatedAt: notice.updatedAt,
});

const getStorage = (custom) => {
  if (custom) return custom;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/** All stored records, unfiltered, so admins can still see and fix a bad one. */
export const getAvailabilityNotices = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(AVAILABILITY_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((n) => n && typeof n === 'object' && !Array.isArray(n) && typeof n.id === 'string')
      : [];
  } catch {
    return [];
  }
};

const save = (list, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) throw new Error('Browser storage is not available, so the notice could not be saved.');
  try {
    storage.setItem(AVAILABILITY_STORAGE_KEY, JSON.stringify(list));
  } catch {
    throw new Error('The notice could not be saved. Browser storage may be full or blocked.');
  }
};

const newId = () => `avail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Creates a notice (state defaults to draft). Throws with the validation messages if it is not valid. */
export const addAvailabilityNotice = (input, customStorage, services = getAllServices()) => {
  requirePermission('availabilityNotices.manage');
  const nowIso = new Date().toISOString();
  const candidate = { state: PUBLICATION_STATES.DRAFT, ...input, id: newId(), createdAt: nowIso, updatedAt: nowIso };
  const { isValid, errors } = validateAvailabilityNotice(candidate, services);
  if (!isValid) throw new Error(errors.join(' '));
  const notice = normalizeNotice(candidate);
  save([notice, ...getAvailabilityNotices(customStorage)], customStorage);
  return notice;
};

/** Edits a notice. Throws if it does not exist or the result is not valid. */
export const updateAvailabilityNotice = (id, updates, customStorage, services = getAllServices()) => {
  requirePermission('availabilityNotices.manage');
  const list = getAvailabilityNotices(customStorage);
  const index = list.findIndex((n) => n.id === id);
  if (index === -1) throw new Error('That notice no longer exists.');
  const candidate = { ...list[index], ...updates, id, createdAt: list[index].createdAt, updatedAt: new Date().toISOString() };
  const { isValid, errors } = validateAvailabilityNotice(candidate, services);
  if (!isValid) throw new Error(errors.join(' '));
  list[index] = normalizeNotice(candidate);
  save(list, customStorage);
  return list[index];
};

export const publishAvailabilityNotice = (id, customStorage, services) =>
  updateAvailabilityNotice(id, { state: PUBLICATION_STATES.PUBLISHED }, customStorage, services);

export const withdrawAvailabilityNotice = (id, customStorage, services) =>
  updateAvailabilityNotice(id, { state: PUBLICATION_STATES.WITHDRAWN }, customStorage, services);

/** Permanently removes a notice record. The service guide is untouched. */
export const deleteAvailabilityNotice = (id, customStorage) => {
  requirePermission('availabilityNotices.manage');
  save(getAvailabilityNotices(customStorage).filter((n) => n.id !== id), customStorage);
};

/** Notices to show on a service page right now: published, in range, valid. Earliest start first. */
export const getActiveNoticesForService = (serviceId, now = new Date(), customStorage, services = getAllServices()) =>
  getAvailabilityNotices(customStorage)
    .filter((n) => n.serviceId === serviceId && getNoticeStatus(n, now, services) === NOTICE_STATUS.ACTIVE)
    .map(normalizeNotice)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
