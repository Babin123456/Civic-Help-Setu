/**
 * src/test/fixtures/wardAnalyticsFixtures.js
 * 100% Synthetic civic issue fixtures for Differential Privacy evaluation (#1163).
 *
 * Grounded in zero real citizen data, zero real coordinates, and zero credentials.
 */

import { CIVIC_ISSUE_CATEGORIES } from '../../data/wardAnalyticsContract';

export const SYNTHETIC_WARDS = Object.freeze([
  'WARD-101', 'WARD-102', 'WARD-103', 'WARD-104', 'WARD-105',
  'WARD-106', 'WARD-107', 'WARD-108', 'WARD-109', 'WARD-110',
  'WARD-111', 'WARD-112', 'WARD-113', 'WARD-114', 'WARD-115',
]);

/**
 * Deterministic pseudo-random number generator (Mulberry32) for reproducible synthetic datasets.
 */
export const createMulberryPrng = (seed = 42) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Generates an adversarial benchmark dataset of synthetic civic issues.
 *
 * @param {number} count - Total records to generate (e.g. 5,000)
 * @param {number} [seed] - PRNG seed for deterministic generation
 * @returns {Array<Object>} List of synthetic civic complaints
 */
export const generateSyntheticCivicDataset = (count = 5000, seed = 12345) => {
  const prng = createMulberryPrng(seed);
  const categories = Object.keys(CIVIC_ISSUE_CATEGORIES);
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  const dataset = [];

  for (let i = 0; i < count; i++) {
    // Skew distribution: earlier wards and pothole/water categories have higher density
    const wardIdx = Math.floor(Math.pow(prng(), 1.5) * SYNTHETIC_WARDS.length);
    const wardId = SYNTHETIC_WARDS[wardIdx] || SYNTHETIC_WARDS[0];

    const catIdx = Math.floor(Math.pow(prng(), 1.2) * categories.length);
    const category = categories[catIdx] || categories[0];

    const offsetMs = Math.floor(prng() * ninetyDaysMs);
    const timestamp = new Date(now - offsetMs).toISOString();

    dataset.push({
      id: `SYNTH-${String(i + 1).padStart(6, '0')}`,
      wardId,
      category,
      timestamp,
      status: prng() > 0.4 ? 'resolved' : 'pending',
    });
  }

  return dataset;
};

/**
 * Creates neighboring datasets D0 and D1 = D0 U {probeRecord}
 * specifically designed for Membership Inference Attack (MIA) evaluation.
 */
export const createNeighboringProbeDatasets = () => {
  const baseData = generateSyntheticCivicDataset(1000, 9999);

  // Probe record: single citizen complaint in WARD-115 (a sparse ward) under public_health
  const probeRecord = {
    id: 'SYNTH-PROBE-TARGET-001',
    wardId: 'WARD-115',
    category: 'public_health',
    timestamp: new Date().toISOString(),
    status: 'pending',
  };

  // Filter baseData so that WARD-115 public_health has exactly 0 complaints in D0
  const d0 = baseData.filter((r) => !(r.wardId === 'WARD-115' && r.category === 'public_health'));
  const d1 = [...d0, probeRecord];

  return { d0, d1, probeRecord };
};
