/**
 * tests/fixtures/abuseSyntheticFixtures.js
 *
 * Synthetic fixtures for the Abuse Control Plane (#1174).
 *
 * These are synthetic, non-citizen records: hashed identifiers, made-up routes,
 * and fabricated signals. No citizen records, credentials, raw documents, or
 * sensitive prompts are included. Safe to commit and share.
 */

import { privacyIdentifier } from '../../api/_lib/abuseControlPlane.js';

const SECRET = 'dev-secret-change-me';

/** A synthetic caller address -> its privacy-minimized hash. */
export function syntheticAddress(label) {
  const raw = `203.0.113.${label}`;
  return { raw, hash: privacyIdentifier(raw, SECRET) };
}

/** A synthetic authenticated user id -> its privacy-minimized hash. */
export function syntheticUser(label) {
  const raw = `user_${label}`;
  return { raw, hash: privacyIdentifier(raw, SECRET) };
}

/** A set of synthetic abuse signals for dashboard testing. */
export function syntheticSignals(count = 10) {
  const kinds = ['rapid_fire', 'error_burst', 'route_anomaly', 'blocked_retry'];
  const severities = ['low', 'medium', 'high', 'critical'];
  const routes = ['GET:/api/report', 'POST:/api/firebase-token', 'GET:/api/privacy-exports'];
  const signals = [];
  for (let i = 0; i < count; i += 1) {
    const { hash } = syntheticAddress(i % 6);
    signals.push({
      bucket: `addr:${hash}`,
      kind: kinds[i % kinds.length],
      at: Date.now() - i * 60_000,
      route: routes[i % routes.length],
      severity: severities[i % severities.length],
    });
  }
  return signals;
}

/** A set of synthetic appeals for dashboard testing. */
export function syntheticAppeals(count = 8) {
  const statuses = ['pending', 'approved', 'rejected'];
  const appeals = [];
  for (let i = 0; i < count; i += 1) {
    const { hash } = syntheticAddress(i % 4);
    appeals.push({
      id: `appeal_synth_${String(i).padStart(3, '0')}`,
      identifierHash: hash,
      route: 'GET:/api/report',
      reason: `Synthetic appeal ${i} reason`,
      userId: syntheticUser(i % 3).hash,
      status: statuses[i % statuses.length],
      createdAt: Date.now() - i * 3_600_000,
      updatedAt: Date.now() - i * 3_600_000,
    });
  }
  return appeals;
}

/** A synthetic route quota config. */
export function syntheticRouteQuota() {
  return {
    route: '/api/report',
    method: 'POST',
    limit: 10,
    windowMs: 60_000,
    adaptive: true,
  };
}

export { SECRET };
