/**
 * Application intake windows for services (#256).
 *
 * A service record may carry `intakeWindows`: an array of application rounds, each
 *   { label, startDate, endDate, status, notice: { title, url }, reviewedOn }
 * Dates are ISO calendar dates (YYYY-MM-DD). This is separate from office appointments,
 * application deadlines, personal reminders and the office token windows in
 * intakeWindowService. A date the source did not publish is never inferred, and a window
 * whose review date is missing or old is not shown as confirmed.
 */

export const WINDOW_STATUSES = ['open', 'closed'];
export const STALE_AFTER_DAYS = 180;
export const MAX_LABEL_LENGTH = 80;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** True only for real calendar dates in YYYY-MM-DD form (rejects 2026-02-30). */
export const isValidIsoDate = (value) => {
  const m = ISO_DATE.exec(typeof value === 'string' ? value : '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
};

const dayNumber = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** The local calendar date as YYYY-MM-DD. */
export const todayIso = (now = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Returns a clean window object (unusable fields become empty strings). */
export const normalizeWindow = (raw) => {
  const w = raw && typeof raw === 'object' ? raw : {};
  const notice = w.notice && typeof w.notice === 'object' ? w.notice : {};
  const status = clean(w.status).toLowerCase();
  return {
    label: clean(w.label),
    startDate: clean(w.startDate),
    endDate: clean(w.endDate),
    status: WINDOW_STATUSES.includes(status) ? status : '',
    notice: { title: clean(notice.title), url: clean(notice.url) },
    reviewedOn: clean(w.reviewedOn),
  };
};

/** Problems with one window; empty when it is valid. */
export const validateWindow = (raw) => {
  const w = normalizeWindow(raw);
  const errors = [];
  if (w.label.length > MAX_LABEL_LENGTH) errors.push(`Round name must be at most ${MAX_LABEL_LENGTH} characters.`);
  if (w.startDate && !isValidIsoDate(w.startDate)) errors.push('Start date is not a valid date.');
  if (w.endDate && !isValidIsoDate(w.endDate)) errors.push('End date is not a valid date.');
  if (isValidIsoDate(w.startDate) && isValidIsoDate(w.endDate) && w.endDate < w.startDate) {
    errors.push('End date cannot be before the start date.');
  }
  if (raw && typeof raw === 'object' && clean(raw.status) && !w.status) errors.push('Status must be open or closed.');
  if (!w.notice.title && !w.notice.url) errors.push('Add the official notice title or link.');
  if (w.notice.url && !isHttpsUrl(w.notice.url)) errors.push('Notice link must be an https URL.');
  if (w.reviewedOn && !isValidIsoDate(w.reviewedOn)) errors.push('Reviewed-on date is not a valid date.');
  return errors;
};

/**
 * Index pairs of windows whose date ranges overlap. Only windows with both a valid start and
 * end are compared, because an unpublished boundary is never guessed.
 */
export const findOverlaps = (windows) => {
  const ranges = (Array.isArray(windows) ? windows : [])
    .map((w, index) => ({ index, w: normalizeWindow(w) }))
    .filter(({ w }) => isValidIsoDate(w.startDate) && isValidIsoDate(w.endDate) && w.endDate >= w.startDate);
  const pairs = [];
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      const a = ranges[i];
      const b = ranges[j];
      if (a.w.startDate <= b.w.endDate && b.w.startDate <= a.w.endDate) pairs.push([a.index, b.index]);
    }
  }
  return pairs;
};

/** Validates a whole list. Messages are prefixed with the round number. */
export const validateWindows = (windows) => {
  if (windows === undefined || windows === null) return [];
  if (!Array.isArray(windows)) return ['Intake windows must be a list.'];
  const errors = windows.flatMap((w, i) => validateWindow(w).map((m) => `Round ${i + 1}: ${m}`));
  return errors;
};

/** Non-blocking notes for a list (overlapping rounds can be legitimate parallel rounds). */
export const windowWarnings = (windows) =>
  findOverlaps(windows).map(([a, b]) => `Rounds ${a + 1} and ${b + 1} overlap. Check that both are correct.`);

/** Form row <-> window record conversion used by the admin form. */
export const windowToRow = (raw) => {
  const w = normalizeWindow(raw);
  return { label: w.label, startDate: w.startDate, endDate: w.endDate, status: w.status, noticeTitle: w.notice.title, noticeUrl: w.notice.url, reviewedOn: w.reviewedOn };
};

export const rowToWindow = (row) => ({
  label: row.label,
  startDate: row.startDate,
  endDate: row.endDate,
  status: row.status,
  notice: { title: row.noticeTitle, url: row.noticeUrl },
  reviewedOn: row.reviewedOn,
});

const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Display model for one window as of `today` (YYYY-MM-DD).
 * state: open | upcoming | closed | unpublished. `confirmed` is false when the review date is
 * missing, invalid, in the future or older than STALE_AFTER_DAYS.
 */
export const describeWindow = (raw, today = todayIso()) => {
  const w = normalizeWindow(raw);
  const start = isValidIsoDate(w.startDate) ? w.startDate : '';
  const end = isValidIsoDate(w.endDate) ? w.endDate : '';
  const reviewed = isValidIsoDate(w.reviewedOn) ? w.reviewedOn : '';

  let confirmed = false;
  let reviewNote = 'Review date not recorded. Check the official notice before applying.';
  if (reviewed) {
    const age = dayNumber(today) - dayNumber(reviewed);
    if (age < 0) {
      reviewNote = 'Review date is in the future, so this is not treated as confirmed.';
    } else if (age > STALE_AFTER_DAYS) {
      reviewNote = `Last reviewed ${longDate(reviewed)}. This may be out of date; check the official notice.`;
    } else {
      confirmed = true;
      reviewNote = `Last reviewed ${longDate(reviewed)}.`;
    }
  }

  let state = 'unpublished';
  let stateLabel = 'Window not published';
  if (start && today < start) {
    state = 'upcoming';
    stateLabel = `Opens on ${longDate(start)}`;
  } else if (end && today > end) {
    state = 'closed';
    stateLabel = 'Closed';
  } else if (start || end) {
    state = 'open';
    if (start && end) stateLabel = 'Open';
    else if (start) stateLabel = 'Open (end date not published)';
    else stateLabel = 'Open (start date not published)';
  } else if (w.status === 'open') {
    state = 'open';
    stateLabel = 'Open';
  } else if (w.status === 'closed') {
    state = 'closed';
    stateLabel = 'Closed';
  }
  if (state === 'open' && !confirmed) stateLabel = stateLabel.replace(/^Open/, 'Listed as open');

  const range = [];
  if (start) range.push(`From ${longDate(start)}`);
  if (end) range.push(`${start ? 'to' : 'Until'} ${longDate(end)}`);
  if (!start && !end) range.push('Start and end dates not published');

  return { label: w.label, state, stateLabel, rangeText: range.join(' '), confirmed, reviewNote, notice: w.notice };
};

/** Display models for a service's windows; an empty array when it has none. */
export const getWindowViews = (service, today = todayIso()) =>
  Array.isArray(service?.intakeWindows) ? service.intakeWindows.map((w) => describeWindow(w, today)) : [];
