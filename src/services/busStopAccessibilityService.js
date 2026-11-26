/**
 * Bus stop amenity audit.
 *
 * Covers the physical side of a stop only (shelter, seating, lighting, kerb access, tactile
 * paving, signage). Route and timetable data are deliberately out of scope.
 *
 * Each stop carries a list of observations. An observation is either from the official
 * inventory (source: 'official') or from a citizen (source: 'citizen'). Citizen
 * observations only count once a moderator has approved them.
 */

export const STOP_ATTRIBUTES = ['shelter', 'seating', 'lighting', 'kerbAccess', 'tactilePaving', 'signage'];

// A stop is only called accessible when every one of these is verified as present.
export const ACCESSIBILITY_REQUIRED = ['kerbAccess', 'tactilePaving', 'lighting', 'signage'];

export const STALE_AFTER_DAYS = 180;
export const MIN_CITIZEN_CONFIRMATIONS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

const LABELS = {
  shelter: 'Shelter',
  seating: 'Seating',
  lighting: 'Lighting',
  kerbAccess: 'Kerb access',
  tactilePaving: 'Tactile paving',
  signage: 'Signage',
};

export function attributeLabel(attribute) {
  return LABELS[attribute] || attribute;
}

function observedAt(obs) {
  const t = new Date(obs.observedAt).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Work out what we know about one attribute: 'present', 'absent', 'unknown' or 'conflict',
 * and whether that answer is verified.
 *
 * A fresh official record verifies on its own. Citizen records need
 * MIN_CITIZEN_CONFIRMATIONS moderated observations that all agree.
 * If official and citizen evidence disagree the attribute is marked 'conflict'.
 */
export function resolveAttribute(observations, attribute, now = Date.now()) {
  const relevant = (observations || []).filter(
    (o) => o && o.attribute === attribute && typeof o.present === 'boolean' && observedAt(o) !== null
  );

  const fresh = relevant.filter((o) => now - observedAt(o) <= STALE_AFTER_DAYS * DAY_MS);
  const official = fresh.filter((o) => o.source === 'official');
  const citizen = fresh.filter((o) => o.source === 'citizen' && o.moderation === 'approved');

  const officialLatest = [...official].sort((a, b) => observedAt(b) - observedAt(a))[0];
  const citizenPresent = citizen.filter((o) => o.present).length;
  const citizenAbsent = citizen.length - citizenPresent;

  let citizenAnswer = null;
  if (citizenPresent >= MIN_CITIZEN_CONFIRMATIONS && citizenAbsent === 0) citizenAnswer = true;
  else if (citizenAbsent >= MIN_CITIZEN_CONFIRMATIONS && citizenPresent === 0) citizenAnswer = false;

  if (officialLatest && citizenAnswer !== null && officialLatest.present !== citizenAnswer) {
    return { attribute, state: 'conflict', verified: false };
  }
  if (officialLatest) {
    return { attribute, state: officialLatest.present ? 'present' : 'absent', verified: true, basis: 'official' };
  }
  if (citizenAnswer !== null) {
    return { attribute, state: citizenAnswer ? 'present' : 'absent', verified: true, basis: 'citizen' };
  }
  return { attribute, state: 'unknown', verified: false };
}

/**
 * Overall status for a stop.
 *  - 'verified_accessible': every required attribute verified present
 *  - 'not_accessible': a required attribute is verified absent
 *  - 'insufficient_evidence': anything else (never shown as accessible)
 */
export function assessStop(stop, now = Date.now()) {
  const attributes = STOP_ATTRIBUTES.map((a) => resolveAttribute(stop.observations, a, now));
  const byName = Object.fromEntries(attributes.map((a) => [a.attribute, a]));

  const required = ACCESSIBILITY_REQUIRED.map((a) => byName[a]);
  let status = 'insufficient_evidence';
  if (required.some((a) => a.verified && a.state === 'absent')) {
    status = 'not_accessible';
  } else if (required.every((a) => a.verified && a.state === 'present')) {
    status = 'verified_accessible';
  }

  return {
    stopId: stop.id,
    name: stop.name,
    status,
    attributes,
    missingEvidence: required.filter((a) => !a.verified).map((a) => a.attribute),
  };
}

/** Stops whose newest observation is older than the stale limit, or that have none. */
export function findStaleStops(stops, now = Date.now()) {
  return (stops || [])
    .map((stop) => {
      const times = (stop.observations || []).map(observedAt).filter((t) => t !== null);
      const newest = times.length ? Math.max(...times) : null;
      return {
        stopId: stop.id,
        name: stop.name,
        newest,
        ageDays: newest === null ? null : Math.floor((now - newest) / DAY_MS),
      };
    })
    .filter((s) => s.newest === null || s.ageDays > STALE_AFTER_DAYS);
}

/** Plain-text improvement report for the transport or local authority. */
export function buildImprovementReport(stop, now = Date.now()) {
  const assessment = assessStop(stop, now);
  const absent = assessment.attributes.filter((a) => a.verified && a.state === 'absent');
  const conflicts = assessment.attributes.filter((a) => a.state === 'conflict');
  const unverified = assessment.attributes.filter((a) => !a.verified && a.state !== 'conflict');

  const lines = [`Stop: ${stop.name} (${stop.id})`, `Status: ${assessment.status.replace(/_/g, ' ')}`];
  if (absent.length) {
    lines.push('Verified missing:');
    absent.forEach((a) => lines.push(`- ${attributeLabel(a.attribute)} (${a.basis})`));
  }
  if (conflicts.length) {
    lines.push('Needs a site check, official and citizen records disagree:');
    conflicts.forEach((a) => lines.push(`- ${attributeLabel(a.attribute)}`));
  }
  if (unverified.length) {
    lines.push('Not yet verified:');
    unverified.forEach((a) => lines.push(`- ${attributeLabel(a.attribute)}`));
  }
  return lines.join('\n');
}

/** Text-only result rows for screen readers and low-end devices. */
export function searchStopsAsText(stops, query = '', now = Date.now()) {
  const q = String(query).trim().toLowerCase();
  return (stops || [])
    .filter((s) => !q || String(s.name).toLowerCase().includes(q) || String(s.locality || '').toLowerCase().includes(q))
    .map((s) => {
      const a = assessStop(s, now);
      const present = a.attributes
        .filter((x) => x.verified && x.state === 'present')
        .map((x) => attributeLabel(x.attribute));
      return `${s.name}: ${a.status.replace(/_/g, ' ')}. Verified: ${present.length ? present.join(', ') : 'none'}.`;
    });
}
