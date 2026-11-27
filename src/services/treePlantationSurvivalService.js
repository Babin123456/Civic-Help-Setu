/**
 * src/services/treePlantationSurvivalService.js
 *
 * Tree-Plantation Survival and Public Green Asset Registry (#1441).
 *
 * Extends src/services/treeInventoryService.js conventions and
 * src/services/piiLeakageGuardService.js to provide:
 * - Geotagged green-asset records (batchId, species, steward, inspection dates, survivalStatus)
 * - Strict distinction between planted (unverified) vs verified surviving trees
 * - Duplicate prevention on batch + species + rounded geo-coordinates
 * - Append-only evidence history (official inspections vs citizen observations)
 * - Zero-PII enforcement & safe backward-compatible migrations
 */

import { inspectStringForPII } from './piiLeakageGuardService.js';

export const GREEN_ASSET_SCHEMA_VERSION = '1.0.0';

export const GREEN_ASSET_ORIGIN = {
  OFFICIAL_RECORD: 'official_record',
  CITIZEN_OBSERVATION: 'citizen_entered_fact',
  AI_ADVISORY: 'ai_community_suggestion',
};

export const SURVIVAL_STATUS = {
  PLANTED_UNVERIFIED: 'planted_unverified',
  VERIFIED_SURVIVING: 'verified_surviving',
  NEEDS_REPLACEMENT: 'needs_replacement',
  REPLACED: 'replaced',
};

const SENSITIVE_KEY_REGEX = /^(aadhaar|pan|otp|password|biometric|fingerprint|iris|phone|mobile|email)$/i;

export function sanitizeGreenAssetText(val, maxLen = 400) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateGreenAssetZeroPii(payload, path = 'greenAsset') {
  const violations = [];
  function walk(node, currentPath) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      const check = inspectStringForPII(node);
      if (!check.clean) {
        for (const v of check.violations) {
          violations.push(`${currentPath}: prohibited PII (${v.type})`);
        }
      }
      if (/\b\d{6}\b/.test(node) && /otp/i.test(currentPath)) {
        violations.push(`${currentPath}: OTP value is prohibited`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${currentPath}[${i}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        if (SENSITIVE_KEY_REGEX.test(key.trim())) {
          violations.push(`${currentPath}.${key}: sensitive field is prohibited`);
        }
        walk(val, `${currentPath}.${key}`);
      }
    }
  }
  walk(payload, path);
  return { valid: violations.length === 0, violations };
}

export function verifyGreenAssetSourceProvenance(sourceMeta = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof sourceMeta?.[f] !== 'string' || sourceMeta[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && sourceMeta?.verified !== false;
  return {
    source: sanitizeGreenAssetText(sourceMeta?.source || 'Unverified plantation record', 200),
    jurisdiction: sanitizeGreenAssetText(sourceMeta?.jurisdiction || 'UNSPECIFIED', 64),
    effectiveDate: sanitizeGreenAssetText(sourceMeta?.effectiveDate || '', 40),
    lastVerifiedAt: sanitizeGreenAssetText(sourceMeta?.lastVerifiedAt || '', 64),
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

export function roundGeoCoord(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(3));
}

export function computeDuplicateFingerprint({ batchId, species, lat, lng }) {
  return `${String(batchId || '').trim().toLowerCase()}|${String(species || '').trim().toLowerCase()}|${roundGeoCoord(lat)}|${roundGeoCoord(lng)}`;
}

export function detectDuplicateGreenAsset(existingAssets = [], candidate = {}) {
  const targetFp = computeDuplicateFingerprint(candidate);
  return existingAssets.find((a) => computeDuplicateFingerprint(a) === targetFp) || null;
}

export function registerGreenAsset(existingAssets = [], input = {}, actorId = 'steward') {
  if (!input || typeof input !== 'object') {
    return { valid: false, statusCode: 400, errors: ['Payload must be a JSON object.'], asset: null };
  }

  const piiCheck = validateGreenAssetZeroPii(input, 'asset');
  if (!piiCheck.valid) {
    return { valid: false, statusCode: 400, errors: piiCheck.violations, asset: null };
  }

  const errors = [];
  const batchId = sanitizeGreenAssetText(input.batchId, 64);
  const species = sanitizeGreenAssetText(input.species, 80);
  const steward = sanitizeGreenAssetText(input.steward, 100);
  const wardId = sanitizeGreenAssetText(input.wardId, 40);
  const jurisdiction = sanitizeGreenAssetText(input.jurisdiction || 'IN-UP', 64);
  const lat = roundGeoCoord(input.lat);
  const lng = roundGeoCoord(input.lng);

  if (!batchId) errors.push('batchId is required.');
  if (!species) errors.push('species is required.');
  if (!steward) errors.push('steward is required.');
  if (!wardId) errors.push('wardId is required.');
  if (lat === null || lat < -90 || lat > 90) errors.push('Valid latitude (-90..90) is required.');
  if (lng === null || lng < -180 || lng > 180) errors.push('Valid longitude (-180..180) is required.');

  if (errors.length > 0) {
    return { valid: false, statusCode: 400, errors, asset: null };
  }

  const duplicate = detectDuplicateGreenAsset(existingAssets, { batchId, species, lat, lng });
  if (duplicate) {
    return {
      valid: false,
      statusCode: 409,
      errors: [`Duplicate green asset detected for batch '${batchId}', species '${species}' at (${lat}, ${lng}).`],
      asset: null,
    };
  }

  const now = new Date().toISOString();
  const asset = {
    schemaVersion: GREEN_ASSET_SCHEMA_VERSION,
    assetId: `tree-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: GREEN_ASSET_ORIGIN.OFFICIAL_RECORD,
    batchId,
    species,
    steward,
    wardId,
    jurisdiction,
    lat,
    lng,
    plantedDate: sanitizeGreenAssetText(input.plantedDate || now.slice(0, 10), 40),
    lastInspectionDate: sanitizeGreenAssetText(input.lastInspectionDate || '', 40) || null,
    survivalStatus: SURVIVAL_STATUS.PLANTED_UNVERIFIED,
    officialSource: verifyGreenAssetSourceProvenance(input.officialSource || {}),
    evidenceHistory: [
      {
        evidenceId: `ev-${Date.now()}`,
        origin: GREEN_ASSET_ORIGIN.OFFICIAL_RECORD,
        date: sanitizeGreenAssetText(input.plantedDate || now.slice(0, 10), 40),
        note: `Initial planting registered under batch ${batchId} by ${sanitizeGreenAssetText(actorId, 40)}.`,
        evidenceHash: sanitizeGreenAssetText(input.evidenceHash || 'initial-batch-reg', 80),
      },
    ],
    updatedAt: now,
  };

  return { valid: true, statusCode: 201, errors: [], asset };
}

export function appendGreenAssetEvidence(asset, input, actorId = 'citizen') {
  if (!asset) throw new Error('Green asset not found.');
  const piiCheck = validateGreenAssetZeroPii(input, 'evidence');
  if (!piiCheck.valid) {
    throw new Error(`Privacy violation: ${piiCheck.violations[0]}`);
  }
  const note = sanitizeGreenAssetText(input?.note || '', 400);
  if (note.length < 5) throw new Error('Evidence note must be at least 5 characters.');

  const now = new Date().toISOString();
  const entry = {
    evidenceId: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: GREEN_ASSET_ORIGIN.CITIZEN_OBSERVATION,
    date: sanitizeGreenAssetText(input?.date || now.slice(0, 10), 40),
    note,
    evidenceHash: sanitizeGreenAssetText(input?.evidenceHash || 'citizen-obs', 80),
    observerRef: `obs-${String(actorId).slice(0, 10)}`,
  };

  return {
    ...asset,
    evidenceHistory: [entry, ...(asset.evidenceHistory || [])],
    updatedAt: now,
  };
}

export function verifyGreenAssetSurvival(
  asset,
  { actorId, role = 'admin', survivalStatus, inspectionDate, note = '', officialSource = {} } = {}
) {
  if (!asset) throw new Error('Green asset not found.');
  if (role !== 'admin') throw new Error('Forbidden: admin role required to verify tree survival.');
  if (!Object.values(SURVIVAL_STATUS).includes(survivalStatus)) {
    throw new Error(`Invalid survivalStatus '${survivalStatus}'.`);
  }

  const piiCheck = validateGreenAssetZeroPii({ note, officialSource }, 'verification');
  if (!piiCheck.valid) throw new Error(piiCheck.violations[0]);

  const verifiedSource = verifyGreenAssetSourceProvenance(officialSource);
  const now = new Date().toISOString();
  const inspDate = sanitizeGreenAssetText(inspectionDate || now.slice(0, 10), 40);

  const entry = {
    evidenceId: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origin: GREEN_ASSET_ORIGIN.OFFICIAL_RECORD,
    date: inspDate,
    note: sanitizeGreenAssetText(note || `Survival status verified as ${survivalStatus}.`, 400),
    evidenceHash: `verify-${sanitizeGreenAssetText(actorId, 32)}`,
  };

  return {
    ...asset,
    survivalStatus,
    lastInspectionDate: inspDate,
    officialSource: verifiedSource,
    evidenceHistory: [entry, ...(asset.evidenceHistory || [])],
    updatedAt: now,
  };
}

export function aggregateGreenAssetSummary(assets = [], { wardId = 'all', batchId = 'all', species = 'all' } = {}) {
  const filtered = assets.filter((a) => {
    if (wardId !== 'all' && a.wardId !== wardId) return false;
    if (batchId !== 'all' && a.batchId !== batchId) return false;
    if (species !== 'all' && a.species !== species) return false;
    return true;
  });

  const totalPlantedCount = filtered.length;
  const verifiedSurvivingCount = filtered.filter((a) => a.survivalStatus === SURVIVAL_STATUS.VERIFIED_SURVIVING).length;
  const unverifiedPlantedCount = filtered.filter((a) => a.survivalStatus === SURVIVAL_STATUS.PLANTED_UNVERIFIED).length;
  const needsReplacementCount = filtered.filter((a) => a.survivalStatus === SURVIVAL_STATUS.NEEDS_REPLACEMENT).length;
  const replacedCount = filtered.filter((a) => a.survivalStatus === SURVIVAL_STATUS.REPLACED).length;
  const survivalRate =
    totalPlantedCount > 0 ? Number((verifiedSurvivingCount / totalPlantedCount).toFixed(4)) : 0;

  return {
    totalPlantedCount,
    verifiedSurvivingCount,
    unverifiedPlantedCount,
    needsReplacementCount,
    replacedCount,
    survivalRate,
    assets: filtered,
    aiAdvisory: {
      origin: GREEN_ASSET_ORIGIN.AI_ADVISORY,
      note:
        unverifiedPlantedCount > 0
          ? `AI / Community Advisory (Non-binding): ${unverifiedPlantedCount} planted sapling(s) await independent survival verification.`
          : 'AI / Community Advisory (Non-binding): All filtered saplings have verified inspection records.',
    },
  };
}

export function getBuiltInGreenAssets() {
  const now = '2026-11-20T09:00:00.000Z';
  return [
    {
      schemaVersion: GREEN_ASSET_SCHEMA_VERSION,
      assetId: 'tree-seed-neem-01',
      origin: GREEN_ASSET_ORIGIN.OFFICIAL_RECORD,
      batchId: 'MONSOON-2026-W14',
      species: 'Azadirachta indica (Neem)',
      steward: 'Municipal Horticulture Wing',
      wardId: 'ward-14',
      jurisdiction: 'IN-UP',
      lat: 26.847,
      lng: 80.946,
      plantedDate: '2026-07-15',
      lastInspectionDate: '2026-11-10',
      survivalStatus: SURVIVAL_STATUS.VERIFIED_SURVIVING,
      officialSource: verifyGreenAssetSourceProvenance({
        source: 'LMC Monsoon Plantation Survival Audit #14',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-07-15',
        lastVerifiedAt: now,
      }),
      evidenceHistory: [
        {
          evidenceId: 'ev-seed-1',
          origin: GREEN_ASSET_ORIGIN.OFFICIAL_RECORD,
          date: '2026-11-10',
          note: 'Sapling height 1.4m, tree guard intact.',
          evidenceHash: 'hash-insp-01',
        },
      ],
      updatedAt: now,
    },
    {
      schemaVersion: GREEN_ASSET_SCHEMA_VERSION,
      assetId: 'tree-seed-peepal-02',
      origin: GREEN_ASSET_ORIGIN.OFFICIAL_RECORD,
      batchId: 'MONSOON-2026-W14',
      species: 'Ficus religiosa (Peepal)',
      steward: 'Ward 14 Eco-Club',
      wardId: 'ward-14',
      jurisdiction: 'IN-UP',
      lat: 26.849,
      lng: 80.948,
      plantedDate: '2026-07-18',
      lastInspectionDate: null,
      survivalStatus: SURVIVAL_STATUS.PLANTED_UNVERIFIED,
      officialSource: verifyGreenAssetSourceProvenance({ source: 'Initial planting register' }), // Unverified
      evidenceHistory: [
        {
          evidenceId: 'ev-seed-2',
          origin: GREEN_ASSET_ORIGIN.CITIZEN_OBSERVATION,
          date: '2026-11-12',
          note: 'Needs watering check near park gate.',
          evidenceHash: 'citizen-obs-02',
        },
      ],
      updatedAt: now,
    },
  ];
}

export function migrateGreenAssetStoreState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: GREEN_ASSET_SCHEMA_VERSION,
    assets: Array.isArray(safe.assets) ? safe.assets : getBuiltInGreenAssets(),
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
