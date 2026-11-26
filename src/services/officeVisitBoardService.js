/**
 * Local government office visit board.
 *
 * Works on static, manually verified office records. Live queue data is only shown when an
 * authority-provided feed is attached and fresh. Waiting times are never estimated, and nothing
 * here implies that a token has been reserved.
 *
 * Office shape (all fields optional except id and name):
 * {
 *   id, name, locality, address,
 *   verifiedAt, source,
 *   hours: { days: [1,2,3,4,5], open: '10:00', close: '17:00', source },
 *   lunchClosure: { start: '13:00', end: '13:30' },
 *   holidays: [{ date: '2026-08-15', note: 'Independence Day', source }],
 *   appointment: { required: boolean, url },
 *   tokenInstructions: 'text',
 *   stepFreeAccess: true | false,
 *   facilities: ['drinking water', ...],
 *   counters: [{ id, service, name, instructions, documents: [] }],
 *   liveFeed: { updatedAt, nowServing, waiting, source }
 * }
 */

export const STALE_AFTER_DAYS = 180;
export const LIVE_FEED_MAX_AGE_MINUTES = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'verified' | 'stale' | 'unverified', based on the record's verification date. */
export function getVerificationStatus(office, now = new Date()) {
  const t = new Date(office && office.verifiedAt).getTime();
  if (!office || !office.verifiedAt || Number.isNaN(t)) return 'unverified';
  return now.getTime() - t > STALE_AFTER_DAYS * DAY_MS ? 'stale' : 'verified';
}

/**
 * Whether the office is expected to be open at `now`, from the published hours.
 * Returns { state: 'open' | 'closed' | 'unknown', reason }.
 * 'unknown' means we have no hours to go on, which is not the same as closed.
 */
export function getOpeningStatus(office, now = new Date()) {
  const hours = office && office.hours;
  const open = hours && toMinutes(hours.open);
  const close = hours && toMinutes(hours.close);
  if (!hours || open === null || close === null || !Array.isArray(hours.days)) {
    return { state: 'unknown', reason: 'No verified opening hours.' };
  }

  const holiday = (office.holidays || []).find((h) => h.date === isoDay(now));
  if (holiday) return { state: 'closed', reason: `Holiday: ${holiday.note || 'office closed'}.` };

  if (!hours.days.includes(now.getDay())) {
    return { state: 'closed', reason: `Closed on ${WEEKDAYS[now.getDay()]}.` };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < open || minutes >= close) {
    return { state: 'closed', reason: `Open ${hours.open} to ${hours.close}.` };
  }

  const lunch = office.lunchClosure;
  if (lunch) {
    const ls = toMinutes(lunch.start);
    const le = toMinutes(lunch.end);
    if (ls !== null && le !== null && minutes >= ls && minutes < le) {
      return { state: 'closed', reason: `Lunch closure ${lunch.start} to ${lunch.end}.` };
    }
  }
  return { state: 'open', reason: `Open ${hours.open} to ${hours.close}.` };
}

/**
 * Queue information. Live numbers only come from a fresh authority feed.
 * Otherwise we return static guidance and the date it was verified, and no numbers at all.
 */
export function getQueueInfo(office, now = new Date()) {
  const feed = office && office.liveFeed;
  if (feed && feed.updatedAt) {
    const age = (now.getTime() - new Date(feed.updatedAt).getTime()) / 60000;
    if (!Number.isNaN(age) && age >= 0 && age <= LIVE_FEED_MAX_AGE_MINUTES) {
      return {
        mode: 'live',
        nowServing: feed.nowServing ?? null,
        waiting: feed.waiting ?? null,
        updatedAt: feed.updatedAt,
        source: feed.source || null,
      };
    }
  }
  return {
    mode: 'static',
    message: 'No live queue feed is available for this office. Waiting times are not shown.',
    tokenInstructions: (office && office.tokenInstructions) || null,
    verifiedAt: (office && office.verifiedAt) || null,
  };
}

/** Case-insensitive search over office name, locality and counter service names. */
export function searchOffices(offices, query = '') {
  const q = String(query).trim().toLowerCase();
  return (offices || []).filter((o) => {
    if (!q) return true;
    const haystack = [o.name, o.locality, ...(o.counters || []).flatMap((c) => [c.service, c.name])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Plain-text visit checklist, suitable for printing or saving offline.
 * Pass a counterId to include that counter's instructions and documents.
 */
export function buildVisitChecklist(office, counterId, now = new Date()) {
  const lines = [`Visit checklist: ${office.name}`];
  if (office.address) lines.push(`Address: ${office.address}`);

  const status = getVerificationStatus(office, now);
  if (status === 'unverified') lines.push('Details have not been verified. Please confirm before travelling.');
  else lines.push(`Details verified on ${String(office.verifiedAt).slice(0, 10)}${status === 'stale' ? ' (may be out of date)' : ''}.`);

  if (office.hours && toMinutes(office.hours.open) !== null) {
    lines.push(`Hours: ${office.hours.open} to ${office.hours.close}`);
  }
  if (office.lunchClosure) lines.push(`Lunch closure: ${office.lunchClosure.start} to ${office.lunchClosure.end}`);

  const upcoming = (office.holidays || []).filter((h) => h.date >= isoDay(now)).sort((a, b) => a.date.localeCompare(b.date));
  upcoming.slice(0, 3).forEach((h) => lines.push(`Closed ${h.date}: ${h.note || 'holiday'}`));

  if (office.appointment) {
    lines.push(
      office.appointment.required
        ? `Appointment required${office.appointment.url ? `: ${office.appointment.url}` : ''}`
        : 'Appointment not required'
    );
  }

  const counter = (office.counters || []).find((c) => c.id === counterId);
  if (counter) {
    lines.push(`Counter: ${counter.name || counter.service}`);
    if (counter.instructions) lines.push(`Instructions: ${counter.instructions}`);
    if (counter.documents && counter.documents.length) {
      lines.push('Bring:');
      counter.documents.forEach((d) => lines.push(`[ ] ${d}`));
    }
  }

  if (office.tokenInstructions) lines.push(`Token: ${office.tokenInstructions}`);
  if (typeof office.stepFreeAccess === 'boolean') {
    lines.push(`Step-free access: ${office.stepFreeAccess ? 'yes' : 'no'}`);
  }
  if (office.facilities && office.facilities.length) lines.push(`Facilities: ${office.facilities.join(', ')}`);

  lines.push('This checklist does not reserve a token or a place in the queue.');
  return lines.join('\n');
}
