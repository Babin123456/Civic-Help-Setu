/**
 * Public drinking-water point directory.
 *
 * Operational status (does the tap work?) and water-quality status (is the water tested safe?)
 * are separate on purpose. Quality is only shown when a dated, attributable test record is linked
 * to the point. It is never inferred from reports, votes or appearance.
 *
 * Point shape:
 * {
 *   id, name, locality, lat, lng, sourceType: 'tap'|'handpump'|'tank'|'dispenser',
 *   accessible: boolean, maintenanceContact,
 *   statusReports: [{ status: 'working'|'broken'|'no_supply', reportedAt, moderation }],
 *   qualityTest: { testedAt, authority, source, result: 'pass'|'fail', parameters }
 * }
 */

export const REPORT_VALID_HOURS = 48;
export const QUALITY_TEST_VALID_DAYS = 90;
export const MIN_REPORTS_TO_CHANGE_STATUS = 2;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const REPORT_STATUSES = ['working', 'broken', 'no_supply'];

export const SAFETY_UNKNOWN_WARNING =
  'Water safety is not known for this point. Do not drink from it unless it has a current test record or you can confirm with the local authority.';

/** Search by name, locality or source type. */
export function searchWaterPoints(points, query = '') {
  const q = String(query).trim().toLowerCase();
  return (points || []).filter(
    (p) => !q || [p.name, p.locality, p.sourceType].filter(Boolean).join(' ').toLowerCase().includes(q)
  );
}

/** Straight line distance in metres between two { lat, lng } points. */
export function distanceMetres(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Points sorted by distance from `origin`, nearest first, skipping points without coordinates. */
export function nearestWaterPoints(points, origin, limit = 5) {
  return (points || [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({ point: p, metres: Math.round(distanceMetres(origin, p)) }))
    .sort((a, b) => a.metres - b.metres)
    .slice(0, limit);
}

/**
 * Operational status from recent moderated reports.
 * One report is not enough to change the status; it needs MIN_REPORTS_TO_CHANGE_STATUS
 * agreeing reports in the last 48 hours, and a newer 'working' report wins over older faults.
 */
export function getOperationalStatus(point, now = Date.now()) {
  const recent = ((point && point.statusReports) || [])
    .filter((r) => {
      const t = new Date(r.reportedAt).getTime();
      return (
        REPORT_STATUSES.includes(r.status) &&
        r.moderation === 'approved' &&
        !Number.isNaN(t) &&
        t <= now &&
        now - t <= REPORT_VALID_HOURS * HOUR_MS
      );
    })
    .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));

  if (recent.length === 0) return { status: 'unknown', reports: 0, lastReportAt: null };

  const latest = recent[0];
  const agreeing = recent.filter((r) => r.status === latest.status);
  if (agreeing.length < MIN_REPORTS_TO_CHANGE_STATUS) {
    return { status: 'unconfirmed', reports: recent.length, lastReportAt: latest.reportedAt };
  }
  return { status: latest.status, reports: agreeing.length, lastReportAt: latest.reportedAt };
}

/**
 * Water quality status, separate from operational status.
 * Needs a test with a date and a named authority. Old tests expire after 90 days.
 */
export function getQualityStatus(point, now = Date.now()) {
  const test = point && point.qualityTest;
  const t = test ? new Date(test.testedAt).getTime() : NaN;
  if (!test || Number.isNaN(t) || !test.authority || !['pass', 'fail'].includes(test.result)) {
    return { status: 'unknown', warning: SAFETY_UNKNOWN_WARNING };
  }
  const expired = now - t > QUALITY_TEST_VALID_DAYS * DAY_MS;
  const detail = { testedAt: test.testedAt, authority: test.authority, source: test.source || null };
  if (expired) return { status: 'expired', ...detail, warning: SAFETY_UNKNOWN_WARNING };
  return { status: test.result === 'pass' ? 'tested_pass' : 'tested_fail', ...detail };
}

/** Everything the public detail view needs, with both statuses kept apart. */
export function describeWaterPoint(point, now = Date.now()) {
  return {
    id: point.id,
    name: point.name,
    sourceType: point.sourceType || 'unknown',
    accessible: typeof point.accessible === 'boolean' ? point.accessible : null,
    maintenanceContact: point.maintenanceContact || null,
    operational: getOperationalStatus(point, now),
    quality: getQualityStatus(point, now),
  };
}
