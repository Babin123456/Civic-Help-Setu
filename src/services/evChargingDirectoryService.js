/**
 * Public EV charging directory.
 *
 * Station shape:
 * {
 *   id, name, operator, locality,
 *   connectors: [{ type: 'CCS2', powerKw: 30 }],
 *   attributes: { hours, payment, accessibleParking, access },   // each { value, source, verifiedAt }
 *   operatorFeed: { updatedAt, available, total },               // optional live feed from the operator
 *   observations: [{ status: 'working'|'broken'|'occupied', observedAt, moderation }]
 * }
 *
 * Operator data and community observations are never mixed. Availability is only shown from a
 * current operator feed; community reports are shown as reports, with their age.
 */

export const OPERATOR_FEED_MAX_AGE_MINUTES = 10;
export const ATTRIBUTE_STALE_DAYS = 180;
export const OBSERVATION_MAX_AGE_HOURS = 24;

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MIN_MS;

const OBSERVATION_STATUSES = ['working', 'broken', 'occupied'];

/** Filter stations. Every provided filter has to match. */
export function filterStations(stations, filters = {}) {
  const { connector, minPowerKw, operator, locality } = filters;
  const op = operator ? String(operator).trim().toLowerCase() : '';
  const loc = locality ? String(locality).trim().toLowerCase() : '';
  return (stations || []).filter((s) => {
    const connectors = s.connectors || [];
    if (connector && !connectors.some((c) => c.type === connector)) return false;
    if (minPowerKw != null && !connectors.some((c) => Number(c.powerKw) >= Number(minPowerKw))) return false;
    if (op && String(s.operator || '').toLowerCase() !== op) return false;
    if (loc && !String(s.locality || '').toLowerCase().includes(loc)) return false;
    return true;
  });
}

/** Source and freshness for one attribute such as hours or payment methods. */
export function describeAttribute(station, name, now = Date.now()) {
  const attr = station && station.attributes && station.attributes[name];
  if (!attr || attr.value === undefined || attr.value === null || attr.value === '') {
    return { name, known: false, text: 'Not known' };
  }
  const t = new Date(attr.verifiedAt).getTime();
  const hasDate = !Number.isNaN(t);
  const stale = !hasDate || now - t > ATTRIBUTE_STALE_DAYS * DAY_MS;
  return {
    name,
    known: true,
    value: attr.value,
    source: attr.source || 'unknown source',
    verifiedAt: hasDate ? attr.verifiedAt : null,
    stale,
  };
}

/**
 * Availability. Only a current operator feed gives numbers. Without one we say so
 * instead of guessing.
 */
export function getAvailability(station, now = Date.now()) {
  const feed = station && station.operatorFeed;
  if (feed && feed.updatedAt) {
    const age = (now - new Date(feed.updatedAt).getTime()) / MIN_MS;
    if (!Number.isNaN(age) && age >= 0 && age <= OPERATOR_FEED_MAX_AGE_MINUTES) {
      return { live: true, available: feed.available, total: feed.total, updatedAt: feed.updatedAt };
    }
  }
  return { live: false, message: 'Real-time availability is not known. Check with the operator before travelling.' };
}

/**
 * Summarise approved community observations from the last 24 hours.
 * These are reports from users, not operator confirmation.
 */
export function summariseObservations(station, now = Date.now()) {
  const recent = ((station && station.observations) || []).filter((o) => {
    const t = new Date(o.observedAt).getTime();
    return (
      OBSERVATION_STATUSES.includes(o.status) &&
      o.moderation === 'approved' &&
      !Number.isNaN(t) &&
      t <= now &&
      now - t <= OBSERVATION_MAX_AGE_HOURS * 60 * MIN_MS
    );
  });
  const counts = { working: 0, broken: 0, occupied: 0 };
  recent.forEach((o) => {
    counts[o.status] += 1;
  });
  const newest = recent.length ? Math.max(...recent.map((o) => new Date(o.observedAt).getTime())) : null;
  return {
    reports: recent.length,
    counts,
    latestAt: newest === null ? null : new Date(newest).toISOString(),
    label: recent.length ? 'Community reports (not confirmed by the operator)' : 'No recent community reports',
  };
}

/**
 * Find stations that look like the same location: same operator and a very close position, or
 * the same name in the same locality. Returns pairs of ids for a moderator to review.
 */
export function findDuplicateCandidates(stations, maxDistanceMetres = 50) {
  const list = stations || [];
  const pairs = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const sameName =
        a.name && b.name && a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
        String(a.locality || '').toLowerCase() === String(b.locality || '').toLowerCase();
      const close =
        a.lat != null && a.lng != null && b.lat != null && b.lng != null &&
        distanceMetres(a, b) <= maxDistanceMetres &&
        String(a.operator || '').toLowerCase() === String(b.operator || '').toLowerCase();
      if (sameName || close) pairs.push([a.id, b.id]);
    }
  }
  return pairs;
}

function distanceMetres(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
